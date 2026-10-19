import type { Word, WordExample } from '@/typings'
import { formatExamples, mergeExamples, normalizeExamples, parseExamples } from '@/utils/examples/format'

export type ParseError = { line: number; message: string }
export type ParseResult = { words: Word[]; errors: ParseError[]; duplicates: string[] }
export type EditableRow = { name: string; trans: string; usphone: string; ukphone: string; detail?: string; examples?: string }

const MISSING_WORD = 'Missing word'
const HEADER_NAMES = ['name', 'word', 'headword', 'term']

type Field = 'name' | 'trans' | 'usphone' | 'ukphone' | 'detail' | 'examples'
const FIELD_ALIASES: Record<Field, string[]> = {
  name: HEADER_NAMES,
  trans: ['trans', 'meaning', 'meanings', 'translation'],
  usphone: ['usphone'],
  ukphone: ['ukphone'],
  detail: ['detail', 'details'],
  examples: ['examples', 'example', 'sentences'],
}
const FIELDS: Field[] = ['name', 'trans', 'usphone', 'ukphone', 'detail', 'examples']
const noMeaning = (name: string) => `"${name}" has no meaning`

// Excel and Notepad prepend a byte order mark to UTF-8 files
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function splitTrans(value: string): string[] {
  return value
    .split(/[;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Editor cells hold one meaning per line; unlike CSV cells, a `;` inside a meaning is kept. */
export function splitMeanings(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

/** Examples from a CSV cell or editor field: one `sentence | translation` per line, deduplicated by text. */
function examplesFromText(text: string): WordExample[] {
  return normalizeExamples(parseExamples(text))
}

/** True when text was decoded with the wrong encoding (e.g. an ANSI CSV read as UTF-8). */
export function hasReplacementChars(text: string): boolean {
  return text.indexOf('\uFFFD') !== -1
}

export function normalizeWords(words: Word[]): { words: Word[]; duplicates: string[] } {
  const byName = new Map<string, Word>()
  const duplicates: string[] = []
  words.forEach((word) => {
    const name = word.name.trim()
    const existing = byName.get(name)
    if (existing) {
      if (duplicates.indexOf(name) === -1) duplicates.push(name)
      word.trans.forEach((t) => {
        if (existing.trans.indexOf(t) === -1) existing.trans.push(t)
      })
      if (!existing.detail && word.detail) existing.detail = word.detail
      const examples = mergeExamples(existing.examples, word.examples)
      if (examples) existing.examples = examples
      else delete existing.examples
      return
    }
    byName.set(name, { ...word, name, trans: word.trans.slice() })
  })
  return { words: Array.from(byName.values()), duplicates }
}

// Excel writes `;` instead of `,` when the locale's decimal separator is a comma (vi-VN, most of Europe)
function detectDelimiter(text: string): string {
  const firstLine = stripBom(text)
    .split('\n')
    .find((line) => line.trim() !== '')
  return firstLine !== undefined && firstLine.indexOf(';') !== -1 && firstLine.indexOf(',') === -1 ? ';' : ','
}

type CsvScan = { rows: { cells: string[]; line: number }[]; unterminatedLine: number | null }

function scanCsv(input: string, delimiter: string): CsvScan {
  const text = stripBom(input)
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1
  let i = 0

  const pushRow = () => {
    cells.push(cell)
    rows.push({ cells, line: rowLine })
    cells = []
    cell = ''
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      if (ch === '\n') line++
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delimiter) {
      cells.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      line++
      rowLine = line
      i++
      continue
    }
    cell += ch
    i++
  }
  // The row that was open when the file ended inside quotes swallowed everything after it: report it instead of keeping it
  const unterminatedLine = inQuotes ? rowLine : null
  if (cell !== '' || cells.length > 0) pushRow()
  return { rows: unterminatedLine === null ? rows : rows.slice(0, -1), unterminatedLine }
}

export function parseCsvRows(input: string, delimiter = ','): { cells: string[]; line: number }[] {
  return scanCsv(input, delimiter).rows
}

const fieldOf = (cell: string): Field | null => {
  const name = cell.trim().toLowerCase()
  return FIELDS.filter((field) => FIELD_ALIASES[field].indexOf(name) !== -1)[0] ?? null
}

/** A header row starts with a word column name, or names a word column plus at least one other known column (any order). */
function isHeaderRow(cells: string[]): boolean {
  if (cells.length === 0) return false
  if (fieldOf(cells[0]) === 'name') return true
  const fields = cells.map(fieldOf)
  return fields.indexOf('name') !== -1 && fields.filter((field) => field !== null).length >= 2
}

/** Column index of each field: positional by default (name, trans, usphone, ukphone, detail, examples); columns named in the header win. */
function columnsFromHeader(cells: string[]): Record<Field, number> {
  const columns: Record<Field, number> = { name: 0, trans: 1, usphone: 2, ukphone: 3, detail: 4, examples: 5 }
  const named: Partial<Record<Field, number>> = {}
  cells.forEach((cell, index) => {
    const field = fieldOf(cell)
    if (field && named[field] === undefined) named[field] = index
  })
  const taken = FIELDS.map((field) => named[field]).filter((index): index is number => index !== undefined)
  FIELDS.forEach((field) => {
    const index = named[field]
    // A field the header does not name keeps its positional column unless a named field already uses it
    columns[field] = index !== undefined ? index : taken.indexOf(columns[field]) === -1 ? columns[field] : -1
  })
  return columns
}

export function parseWordsCsv(text: string): ParseResult {
  const scan = scanCsv(text, detectDelimiter(text))
  const rows = scan.rows.filter((row) => row.cells.some((c) => c.trim() !== ''))
  const hasHeader = rows.length > 0 && isHeaderRow(rows[0].cells)
  const positional: Record<Field, number> = { name: 0, trans: 1, usphone: 2, ukphone: 3, detail: 4, examples: 5 }
  const columns = hasHeader ? columnsFromHeader(rows[0].cells) : positional
  const start = hasHeader ? 1 : 0
  const words: Word[] = []
  const errors: ParseError[] = []

  rows.slice(start).forEach(({ cells, line }) => {
    const cell = (field: Field): string => (columns[field] >= 0 ? (cells[columns[field]] ?? '').trim() : '')
    const name = cell('name')
    const trans = cell('trans')
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    const meanings = splitTrans(trans)
    if (meanings.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    const word: Word = { name, trans: meanings, usphone: cell('usphone'), ukphone: cell('ukphone') }
    const detail = cell('detail')
    if (detail) word.detail = detail
    const examples = examplesFromText(cell('examples'))
    if (examples.length > 0) word.examples = examples
    words.push(word)
  })

  if (scan.unterminatedLine !== null) {
    errors.push({ line: scan.unterminatedLine, message: 'Unterminated quote: the rest of the file was read as one cell' })
  }

  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}

export function parseWordsJson(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(stripBom(text))
  } catch {
    return { words: [], errors: [{ line: 1, message: 'Invalid JSON' }], duplicates: [] }
  }
  if (!Array.isArray(data)) {
    return { words: [], errors: [{ line: 1, message: 'JSON must be an array of words' }], duplicates: [] }
  }

  const words: Word[] = []
  const errors: ParseError[] = []
  data.forEach((item: unknown, index: number) => {
    const line = index + 1
    if (!item || typeof item !== 'object') {
      errors.push({ line, message: 'Not an object' })
      return
    }
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    const rawTrans: unknown[] = Array.isArray(o.trans) ? o.trans : typeof o.trans === 'string' ? [o.trans] : []
    const trans = rawTrans
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
    if (trans.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    const word: Word = {
      name,
      trans,
      usphone: typeof o.usphone === 'string' ? o.usphone.trim() : '',
      ukphone: typeof o.ukphone === 'string' ? o.ukphone.trim() : '',
    }
    if (typeof o.notation === 'string' && o.notation) word.notation = o.notation
    if (typeof o.detail === 'string' && o.detail.trim()) word.detail = o.detail.trim()
    const examples = normalizeExamples(o.examples)
    if (examples.length > 0) word.examples = examples
    words.push(word)
  })

  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}

export function parseWordsFile(fileName: string, text: string): ParseResult {
  return fileName.toLowerCase().endsWith('.json') ? parseWordsJson(text) : parseWordsCsv(text)
}

export function rowsToWords(rows: EditableRow[]): ParseResult {
  const words: Word[] = []
  const errors: ParseError[] = []
  rows.forEach((row, index) => {
    const line = index + 1
    const name = row.name.trim()
    const meanings = splitMeanings(row.trans)
    const phones = row.usphone.trim() + row.ukphone.trim()
    if (!name && meanings.length === 0 && !phones) return
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    if (meanings.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    const word: Word = { name, trans: meanings, usphone: row.usphone.trim(), ukphone: row.ukphone.trim() }
    const detail = (row.detail ?? '').trim()
    if (detail) word.detail = detail
    const examples = examplesFromText(row.examples ?? '')
    if (examples.length > 0) word.examples = examples
    words.push(word)
  })
  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}

/** Inverse of `rowsToWords`: editor cells hold one meaning per line and keep the detail and examples, so opening a set never loses them. */
export function wordsToRows(words: Word[]): EditableRow[] {
  return words.map((word) => ({
    name: word.name,
    trans: word.trans.join('\n'),
    usphone: word.usphone,
    ukphone: word.ukphone,
    detail: word.detail ?? '',
    examples: formatExamples(word.examples),
  }))
}
