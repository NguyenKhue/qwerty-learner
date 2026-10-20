// @vitest-environment node
import { type Db, openDb } from './adapter'
import type { DexieExport, DexieTableName } from './exchange'
import { exportDexieJson, importDexieJson, snapshotDb } from './exchange'
import * as chapterRecords from './repo/chapterRecords'
import * as wordRecords from './repo/wordRecords'
import { ensureSchema } from './schema'
import type { IChapterRecord, IWordRecord } from '@/utils/db/record'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const TABLE_NAMES: DexieTableName[] = ['wordRecords', 'chapterRecords', 'reviewRecords', 'customDicts', 'cardProgress', 'reviewLog']

/** The schema strings of `RecordDB` version 5 in `src/test/legacyDb.ts`. */
const SCHEMAS: Record<DexieTableName, string> = {
  wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
  chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
  reviewRecords: '++id,dict,createTime,isFinished',
  customDicts: 'id,name,updatedAt,createdAt',
  cardProgress: '[dict+word],dict,due',
  reviewLog: '++id,at,dict',
}

const COUNTS = { wordRecords: 2, chapterRecords: 1, reviewRecords: 1, customDicts: 1, cardProgress: 1, reviewLog: 1 }

const wordRecord = (overrides: Partial<IWordRecord> = {}): IWordRecord => ({
  word: 'apple',
  timeStamp: 1000,
  dict: 'd',
  chapter: 0,
  timing: [10, 20],
  wrongCount: 0,
  mistakes: {},
  ...overrides,
})

const chapterRecord = (overrides: Partial<IChapterRecord> = {}): IChapterRecord => ({
  dict: 'd',
  chapter: 0,
  timeStamp: 3000,
  time: 30,
  correctCount: 20,
  wrongCount: 1,
  wordCount: 7,
  correctWordIndexes: [0, 1],
  wordNumber: 7,
  wordRecordIds: [],
  ...overrides,
})

/** Rows of every table, with a chapter that points at word ids 7 and 9. */
function fixtureRows(): Record<DexieTableName, Row[]> {
  return {
    wordRecords: [
      { id: 7, word: 'apple', timeStamp: 1000, dict: 'd', chapter: 0, wrongCount: 1, timing: [10, 20], mistakes: { 1: ['x'] } },
      { id: 9, word: 'pear', timeStamp: 2000, dict: 'd', chapter: null, wrongCount: 0, timing: [30], mistakes: {} },
    ],
    chapterRecords: [
      {
        id: 4,
        dict: 'd',
        chapter: 0,
        timeStamp: 3000,
        time: 30,
        correctCount: 20,
        wrongCount: 1,
        wordCount: 7,
        correctWordIndexes: [0, 1],
        wordNumber: 7,
        wordRecordIds: [7, 9],
      },
    ],
    reviewRecords: [
      {
        id: 2,
        dict: 'd',
        index: 1,
        createTime: 4000,
        isFinished: false,
        words: [{ name: 'apple', trans: ['apple'] }],
      },
    ],
    customDicts: [
      {
        id: 'set1',
        name: 'Mine',
        description: '',
        words: [{ name: 'apple', trans: ['apple'] }],
        createdAt: 5000,
        updatedAt: 6000,
      },
    ],
    cardProgress: [
      {
        dict: 'd',
        word: 'apple',
        state: 'review',
        due: 7000,
        interval: 1,
        ease: 2.5,
        reps: 2,
        lapses: 0,
        firstSeen: 1000,
        lastReviewed: 7000,
      },
    ],
    reviewLog: [{ id: 3, at: 8000, dict: 'd', word: 'apple', kind: 'flashcard', grade: 'good' }],
  }
}

/** Builds the documented Dexie export object. */
function buildExport(source: Record<DexieTableName, Row[]> = fixtureRows(), databaseName = 'RecordDB'): DexieExport {
  return {
    formatName: 'dexie',
    formatVersion: 1,
    data: {
      databaseName,
      databaseVersion: 5,
      tables: TABLE_NAMES.map((name) => ({ name, schema: SCHEMAS[name], rowCount: source[name].length })),
      data: TABLE_NAMES.map((name) => ({ tableName: name, inbound: true, rows: source[name] })),
    },
  }
}

function gzipped(file: DexieExport): Uint8Array {
  return new Uint8Array(gzipSync(JSON.stringify(file)))
}

function readExport(db: Db): DexieExport {
  return JSON.parse(gunzipSync(exportDexieJson(db)).toString('utf8')) as DexieExport
}

let db: Db
const dirs: string[] = []

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => {
  db.close()
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** Imports a bad file and asserts the prefix, no backup and an untouched database. */
function expectInvalid(file: DexieExport | Uint8Array): void {
  wordRecords.insert(db, wordRecord({ word: 'existing' }))
  chapterRecords.insert(db, chapterRecord({ dict: 'existing' }))
  const backup = vi.fn()
  const bytes = file instanceof Uint8Array ? file : gzipped(file)

  expect(() => importDexieJson(db, bytes, backup)).toThrow(/^IMPORT_INVALID:/)
  expect(backup).not.toHaveBeenCalled()
  expect(wordRecords.count(db)).toBe(1)
  expect(chapterRecords.count(db)).toBe(1)
  expect(wordRecords.between(db, 0, 5000)[0].word).toBe('existing')
}

describe('importDexieJson', () => {
  it('imports the counts, the ids and the chapter references, and continues after the highest id', () => {
    const result = importDexieJson(db, gzipped(buildExport()), vi.fn())

    expect(result.counts).toEqual(COUNTS)
    expect(result.warnings).toEqual([])
    expect(wordRecords.between(db, 0, 5000).map((row) => row.id)).toEqual([7, 9])
    expect(chapterRecords.byDict(db, 'd')[0].wordRecordIds).toEqual([7, 9])
    expect(wordRecords.insert(db, wordRecord({ word: 'next' }))).toBe(10)
  })

  it('calls the backup exactly once before the first change', () => {
    const backup = vi.fn(() => {
      expect(wordRecords.count(db)).toBe(0)
      expect(chapterRecords.count(db)).toBe(0)
    })

    importDexieJson(db, gzipped(buildExport()), backup)

    expect(backup).toHaveBeenCalledTimes(1)
    expect(wordRecords.count(db)).toBe(2)
    expect(chapterRecords.count(db)).toBe(1)
  })

  it('skips unknown tables and reports them in warnings', () => {
    const file = buildExport()
    file.data.tables.push({ name: 'revisionDictRecords', schema: '++id,dict', rowCount: 1 })
    file.data.data.push({ tableName: 'revisionDictRecords', inbound: true, rows: [{ id: 1, dict: 'd' }] })

    const result = importDexieJson(db, gzipped(file), vi.fn())

    expect(result.counts).toEqual(COUNTS)
    expect(result.warnings).toEqual(['Skipped unknown table "revisionDictRecords"'])
  })

  it('rejects malformed gzip without a backup or a change', () => {
    expectInvalid(new Uint8Array([1, 2, 3]))
  })

  it('rejects another database name without a backup or a change', () => {
    expectInvalid(buildExport(fixtureRows(), 'OtherDB'))
  })

  it('rejects a row of the wrong shape without a backup or a change', () => {
    const broken = fixtureRows()
    broken.wordRecords = [{ ...broken.wordRecords[0], id: '7' }]
    expectInvalid(buildExport(broken))
  })
})

describe('exportDexieJson', () => {
  it('writes the documented format with the version 5 schema strings', () => {
    importDexieJson(db, gzipped(buildExport()), vi.fn())

    const file = readExport(db)

    expect(file.formatName).toBe('dexie')
    expect(file.formatVersion).toBe(1)
    expect(file.data.databaseName).toBe('RecordDB')
    expect(file.data.databaseVersion).toBe(5)
    expect(file.data.tables.map((table) => table.name)).toEqual(TABLE_NAMES)
    expect(file.data.tables.map((table) => table.schema)).toEqual(TABLE_NAMES.map((name) => SCHEMAS[name]))
    expect(file.data.tables.map((table) => table.rowCount)).toEqual(Object.values(COUNTS))
    const words = file.data.data.find((entry) => entry.tableName === 'wordRecords')
    expect(words?.rows.map((row) => row.id)).toEqual([7, 9])
  })

  it('round trips through import and export back to the same data', () => {
    importDexieJson(db, gzipped(buildExport()), vi.fn())
    const bytes = exportDexieJson(db)

    const other = openDb(':memory:')
    try {
      ensureSchema(other)
      const result = importDexieJson(other, bytes, vi.fn())
      expect(result.counts).toEqual(COUNTS)
      expect(wordRecords.between(other, 0, 5000).map((row) => row.id)).toEqual([7, 9])
      expect(chapterRecords.byDict(other, 'd')[0].wordRecordIds).toEqual([7, 9])
      // Exported again unchanged, it is the same file
      expect(gunzipSync(exportDexieJson(other)).toString('utf8')).toBe(gunzipSync(bytes).toString('utf8'))
      expect(wordRecords.insert(other, wordRecord({ word: 'next' }))).toBe(10)
    } finally {
      other.close()
    }
  })
})

describe('snapshotDb', () => {
  it('writes a timestamped copy that opens with the rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qwerty-snapshot-'))
    dirs.push(dir)
    wordRecords.insert(db, wordRecord({ word: 'kept' }))

    const path = snapshotDb(db, dir)

    expect(path.startsWith(dir)).toBe(true)
    expect(basename(path)).toMatch(/^qwerty-snapshot-.+\.db$/)
    expect(existsSync(path)).toBe(true)

    const copy = openDb(path)
    try {
      expect(wordRecords.count(copy)).toBe(1)
      expect(wordRecords.between(copy, 0, 5000)[0].word).toBe('kept')
    } finally {
      copy.close()
    }
  })
})
