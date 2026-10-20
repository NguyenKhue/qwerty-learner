import type { Db } from './adapter'
import type { CardProgressRow } from './repo/cardProgress'
import { rowToCardProgress } from './repo/cardProgress'
import type { ChapterRecordRow } from './repo/chapterRecords'
import { rowToChapterRecord } from './repo/chapterRecords'
import type { CustomDictRow } from './repo/customDicts'
import { rowToCustomDict } from './repo/customDicts'
import type { ReviewLogRow } from './repo/reviewLog'
import { rowToReviewLogEntry } from './repo/reviewLog'
import type { ReviewRecordRow } from './repo/reviewRecords'
import { rowToReviewRecord } from './repo/reviewRecords'
import type { WordRecordRow } from './repo/wordRecords'
import { rowToWordRecord } from './repo/wordRecords'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

const DATABASE_NAME = 'RecordDB'
const DATABASE_VERSION = 5

/** A plain JSON row of the documented Dexie export. */
type JsonRow = Record<string, unknown>

export type DexieTableName = 'wordRecords' | 'chapterRecords' | 'reviewRecords' | 'customDicts' | 'cardProgress' | 'reviewLog'

/** The documented Dexie export file (plain JSON, all rows as objects). */
export type DexieExport = {
  formatName: 'dexie'
  formatVersion: 1
  data: {
    databaseName: string
    databaseVersion: number
    tables: { name: string; schema: string; rowCount: number }[]
    data: { tableName: string; inbound: boolean; rows: JsonRow[] }[]
  }
}

export type ImportCounts = { counts: Record<string, number>; warnings: string[] }

type TableSpec = {
  name: DexieTableName
  table: string
  schema: string
  /** Builds this table's export rows. */
  rows: (db: Db) => JsonRow[]
  /** Describes why a row cannot be imported, or null when it is fine. */
  check: (row: JsonRow) => string | null
  insert: (db: Db, row: JsonRow) => void
  /** The primary key as text, used to reject duplicates before any write. */
  key: (row: JsonRow) => string
}

/** Copies a record into a plain row so no class instances or getters reach the JSON. */
function jsonRow(record: object): JsonRow {
  return { ...record } as JsonRow
}

function isObject(value: unknown): value is JsonRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveId(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value > 0
}

function checkId(row: JsonRow): string | null {
  return isPositiveId(row.id) ? null : 'id must be a positive integer'
}

function checkWordRecord(row: JsonRow): string | null {
  const id = checkId(row)
  if (id) return id
  if (!isString(row.word) || !isString(row.dict)) return 'word and dict must be strings'
  if (!isNumber(row.timeStamp) || !isNumber(row.wrongCount)) return 'timeStamp and wrongCount must be numbers'
  if (row.chapter !== null && row.chapter !== undefined && !isNumber(row.chapter)) return 'chapter must be a number or null'
  if (!Array.isArray(row.timing)) return 'timing must be an array'
  if (!isObject(row.mistakes)) return 'mistakes must be an object'
  return null
}

function checkChapterRecord(row: JsonRow): string | null {
  const id = checkId(row)
  if (id) return id
  if (!isString(row.dict)) return 'dict must be a string'
  if (![row.timeStamp, row.time, row.correctCount, row.wrongCount, row.wordCount, row.wordNumber].every(isNumber)) {
    return 'the numeric fields must be numbers'
  }
  if (row.chapter !== null && row.chapter !== undefined && !isNumber(row.chapter)) return 'chapter must be a number or null'
  if (!Array.isArray(row.correctWordIndexes) || !Array.isArray(row.wordRecordIds)) return 'the index lists must be arrays'
  return null
}

function checkReviewRecord(row: JsonRow): string | null {
  const id = checkId(row)
  if (id) return id
  if (!isString(row.dict)) return 'dict must be a string'
  if (!isNumber(row.index) || !isNumber(row.createTime)) return 'index and createTime must be numbers'
  if (typeof row.isFinished !== 'boolean') return 'isFinished must be a boolean'
  if (!Array.isArray(row.words)) return 'words must be an array'
  return null
}

function checkCustomDict(row: JsonRow): string | null {
  if (!isString(row.id) || row.id === '') return 'id must be a non-empty string'
  if (!isString(row.name) || !isString(row.description)) return 'name and description must be strings'
  if (!Array.isArray(row.words)) return 'words must be an array'
  if (!isNumber(row.createdAt) || !isNumber(row.updatedAt)) return 'createdAt and updatedAt must be numbers'
  return null
}

function checkCardProgress(row: JsonRow): string | null {
  if (!isString(row.dict) || !isString(row.word)) return 'dict and word must be strings'
  if (row.state !== 'learning' && row.state !== 'review') return 'state must be "learning" or "review"'
  if (![row.due, row.interval, row.ease, row.reps, row.lapses, row.firstSeen, row.lastReviewed].every(isNumber)) {
    return 'the numeric fields must be numbers'
  }
  return null
}

function checkReviewLog(row: JsonRow): string | null {
  const id = checkId(row)
  if (id) return id
  if (!isNumber(row.at)) return 'at must be a number'
  if (!isString(row.dict) || !isString(row.word)) return 'dict and word must be strings'
  if (row.kind !== 'flashcard' && row.kind !== 'quiz') return 'kind must be "flashcard" or "quiz"'
  if (row.grade !== undefined && row.grade !== null && !['again', 'hard', 'good', 'easy'].includes(row.grade as string)) {
    return 'grade must be again, hard, good, easy or missing'
  }
  return null
}

function insertWordRecord(db: Db, row: JsonRow): void {
  db.run(
    `INSERT INTO word_records (id, word, timestamp, dict, chapter, wrong_count, timing, mistakes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.word,
      row.timeStamp,
      row.dict,
      row.chapter ?? null,
      row.wrongCount,
      JSON.stringify(row.timing),
      JSON.stringify(row.mistakes),
    ],
  )
}

function insertChapterRecord(db: Db, row: JsonRow): void {
  db.run(
    `INSERT INTO chapter_records
       (id, dict, chapter, timestamp, time, correct_count, wrong_count, word_count, correct_word_indexes, word_number, word_record_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.dict,
      row.chapter ?? null,
      row.timeStamp,
      row.time,
      row.correctCount,
      row.wrongCount,
      row.wordCount,
      JSON.stringify(row.correctWordIndexes),
      row.wordNumber,
      JSON.stringify(row.wordRecordIds),
    ],
  )
}

function insertReviewRecord(db: Db, row: JsonRow): void {
  db.run(
    `INSERT INTO review_records (id, dict, position, create_time, is_finished, words)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.dict, row.index, row.createTime, row.isFinished ? 1 : 0, JSON.stringify(row.words)],
  )
}

function insertCustomDict(db: Db, row: JsonRow): void {
  db.run('INSERT INTO custom_dicts (id, name, description, words, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    row.id,
    row.name,
    row.description,
    JSON.stringify(row.words),
    row.createdAt,
    row.updatedAt,
  ])
}

function insertCardProgress(db: Db, row: JsonRow): void {
  db.run(
    `INSERT INTO card_progress (dict, word, state, due, interval, ease, reps, lapses, first_seen, last_reviewed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.dict, row.word, row.state, row.due, row.interval, row.ease, row.reps, row.lapses, row.firstSeen, row.lastReviewed],
  )
}

function insertReviewLog(db: Db, row: JsonRow): void {
  db.run('INSERT INTO review_log (id, at, dict, word, kind, grade) VALUES (?, ?, ?, ?, ?, ?)', [
    row.id,
    row.at,
    row.dict,
    row.word,
    row.kind,
    row.grade ?? null,
  ])
}

/** The six tables, with the schema strings of `RecordDB` version 5 and their export/import mapping. */
const TABLES: TableSpec[] = [
  {
    name: 'wordRecords',
    table: 'word_records',
    schema: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
    rows: (db) => db.all<WordRecordRow>('SELECT * FROM word_records ORDER BY id').map((row) => jsonRow(rowToWordRecord(row))),
    check: checkWordRecord,
    insert: insertWordRecord,
    key: (row) => String(row.id),
  },
  {
    name: 'chapterRecords',
    table: 'chapter_records',
    schema: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    rows: (db) => db.all<ChapterRecordRow>('SELECT * FROM chapter_records ORDER BY id').map((row) => jsonRow(rowToChapterRecord(row))),
    check: checkChapterRecord,
    insert: insertChapterRecord,
    key: (row) => String(row.id),
  },
  {
    name: 'reviewRecords',
    table: 'review_records',
    schema: '++id,dict,createTime,isFinished',
    rows: (db) => db.all<ReviewRecordRow>('SELECT * FROM review_records ORDER BY id').map((row) => jsonRow(rowToReviewRecord(row))),
    check: checkReviewRecord,
    insert: insertReviewRecord,
    key: (row) => String(row.id),
  },
  {
    name: 'customDicts',
    table: 'custom_dicts',
    schema: 'id,name,updatedAt,createdAt',
    rows: (db) => db.all<CustomDictRow>('SELECT * FROM custom_dicts ORDER BY id').map((row) => jsonRow(rowToCustomDict(row))),
    check: checkCustomDict,
    insert: insertCustomDict,
    key: (row) => String(row.id),
  },
  {
    name: 'cardProgress',
    table: 'card_progress',
    schema: '[dict+word],dict,due',
    rows: (db) => db.all<CardProgressRow>('SELECT * FROM card_progress ORDER BY dict, word').map((row) => jsonRow(rowToCardProgress(row))),
    check: checkCardProgress,
    insert: insertCardProgress,
    key: (row) => `${String(row.dict)}\u0000${String(row.word)}`,
  },
  {
    name: 'reviewLog',
    table: 'review_log',
    schema: '++id,at,dict',
    rows: (db) => db.all<ReviewLogRow>('SELECT * FROM review_log ORDER BY id').map((row) => jsonRow(rowToReviewLogEntry(row))),
    check: checkReviewLog,
    insert: insertReviewLog,
    key: (row) => String(row.id),
  },
]

const TABLE_BY_NAME = new Map<string, TableSpec>(TABLES.map((spec): [string, TableSpec] => [spec.name, spec]))

/** An `IMPORT_INVALID` error; the caller's message starts with that prefix. */
function invalid(reason: string): Error {
  return new Error(`IMPORT_INVALID: ${reason}`)
}

type ParsedImport = { rows: Map<DexieTableName, JsonRow[]>; warnings: string[] }

/** Gunzips and validates the whole file; nothing is written here. */
function parseExport(bytes: Uint8Array): ParsedImport {
  let text: string
  try {
    text = gunzipSync(bytes).toString('utf8')
  } catch {
    throw invalid('the file is not gzip')
  }

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw invalid('the file is not JSON')
  }

  if (!isObject(raw)) throw invalid('the export is not an object')
  if (raw.formatName !== 'dexie') throw invalid('formatName must be "dexie"')
  if (raw.formatVersion !== 1) throw invalid('formatVersion must be 1')

  const data = raw.data
  if (!isObject(data)) throw invalid('data is missing')
  if (data.databaseName !== DATABASE_NAME) throw invalid(`databaseName must be "${DATABASE_NAME}"`)
  if (!Array.isArray(data.tables)) throw invalid('data.tables must be an array')
  if (!Array.isArray(data.data)) throw invalid('data.data must be an array')

  const warnings: string[] = []
  const warned = new Set<string>()
  const warnUnknown = (name: string) => {
    if (warned.has(name)) return
    warned.add(name)
    warnings.push(`Skipped unknown table "${name}"`)
  }

  for (const entry of data.tables) {
    if (!isObject(entry) || !isString(entry.name)) throw invalid('every table entry must have a name')
    if (!isString(entry.schema)) throw invalid(`table "${entry.name}" has no schema`)
    if (!isNumber(entry.rowCount)) throw invalid(`table "${entry.name}" has no rowCount`)
    if (!TABLE_BY_NAME.has(entry.name)) warnUnknown(entry.name)
  }

  const rows = new Map<DexieTableName, JsonRow[]>(TABLES.map((spec): [DexieTableName, JsonRow[]] => [spec.name, []]))
  for (const entry of data.data) {
    if (!isObject(entry) || !isString(entry.tableName)) throw invalid('every data entry must have a tableName')
    if (!Array.isArray(entry.rows)) throw invalid(`table "${entry.tableName}" has no rows array`)
    const spec = TABLE_BY_NAME.get(entry.tableName)
    if (!spec) {
      warnUnknown(entry.tableName)
      continue
    }
    const target = rows.get(spec.name)
    if (!target) throw invalid(`table "${spec.name}" cannot be imported`)
    entry.rows.forEach((row, index) => {
      if (!isObject(row)) throw invalid(`${spec.name} row ${index + 1} is not an object`)
      const problem = spec.check(row)
      if (problem) throw invalid(`${spec.name} row ${index + 1}: ${problem}`)
      target.push(row)
    })
  }

  for (const spec of TABLES) {
    const target = rows.get(spec.name) ?? []
    const keys = new Set<string>()
    for (const row of target) {
      const key = spec.key(row)
      if (keys.has(key)) throw invalid(`${spec.name} has more than one row for ${key}`)
      keys.add(key)
    }
  }

  return { rows, warnings }
}

/** Exports every table in the documented Dexie format, gzipped. */
export function exportDexieJson(db: Db): Uint8Array {
  const tables = TABLES.map((spec) => ({ name: spec.name, schema: spec.schema, rows: spec.rows(db) }))
  const file: DexieExport = {
    formatName: 'dexie',
    formatVersion: 1,
    data: {
      databaseName: DATABASE_NAME,
      databaseVersion: DATABASE_VERSION,
      tables: tables.map(({ name, schema, rows }) => ({ name, schema, rowCount: rows.length })),
      data: tables.map(({ name, rows }) => ({ tableName: name, inbound: true, rows })),
    },
  }
  return new Uint8Array(gzipSync(JSON.stringify(file)))
}

/**
 * Validates a gzipped Dexie export, calls `backup`, then replaces all six tables inside one transaction, preserving ids.
 * A malformed file throws `IMPORT_INVALID: ...` before the backup and changes nothing.
 */
export function importDexieJson(db: Db, bytes: Uint8Array, backup: () => void): ImportCounts {
  const parsed = parseExport(bytes)
  backup()
  return db.transaction(() => {
    for (const spec of TABLES) db.run(`DELETE FROM ${spec.table}`)
    // Start the autoincrement counters fresh; inserting the explicit ids then moves each one to that table's highest id.
    const names = TABLES.map((spec) => `'${spec.table}'`).join(', ')
    db.exec(`DELETE FROM sqlite_sequence WHERE name IN (${names})`)

    const counts: Record<string, number> = {}
    for (const spec of TABLES) {
      const rows = parsed.rows.get(spec.name) ?? []
      for (const row of rows) spec.insert(db, row)
      counts[spec.name] = rows.length
    }
    return { counts, warnings: parsed.warnings }
  })
}

/** Writes a `VACUUM INTO` copy named after the current time into `destDir` and returns its path. */
export function snapshotDb(db: Db, destDir: string): string {
  mkdirSync(destDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/:/g, '-')
  const path = join(destDir, `qwerty-snapshot-${stamp}.db`)
  db.backupTo(path)
  return path
}
