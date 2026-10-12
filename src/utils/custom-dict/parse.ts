import type { Word } from '@/typings'

export type ParseError = { line: number; message: string }
export type ParseResult = { words: Word[]; errors: ParseError[]; duplicates: string[] }
export type EditableRow = { name: string; trans: string; usphone: string; ukphone: string }

const MISSING_WORD = 'Missing word'
const HEADER_NAMES = ['name', 'word', 'headword', 'term']
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

export function parseWordsCsv(text: string): ParseResult {
  const scan = scanCsv(text, detectDelimiter(text))
  const rows = scan.rows.filter((row) => row.cells.some((c) => c.trim() !== ''))
  const start = rows.length > 0 && HEADER_NAMES.indexOf(rows[0].cells[0].trim().toLowerCase()) !== -1 ? 1 : 0
  const words: Word[] = []
  const errors: ParseError[] = []

  rows.slice(start).forEach(({ cells, line }) => {
    const [name = '', trans = '', usphone = '', ukphone = ''] = cells.map((c) => c.trim())
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    const meanings = splitTrans(trans)
    if (meanings.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    words.push({ name, trans: meanings, usphone, ukphone })
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
    words.push({ name, trans: meanings, usphone: row.usphone.trim(), ukphone: row.ukphone.trim() })
  })
  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}
