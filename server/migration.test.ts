// @vitest-environment node
import { openDb } from './adapter'
import type { Db } from './adapter'
import { createMigrationManager } from './migration'
import type { MigrationError, MigrationManager } from './migration'
import * as cardProgress from './repo/cardProgress'
import * as chapterRecords from './repo/chapterRecords'
import * as customDicts from './repo/customDicts'
import * as meta from './repo/meta'
import * as wordRecords from './repo/wordRecords'
import { ensureSchema } from './schema'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let dir: string
let db: Db
let manager: MigrationManager
let clock: number

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'qwerty-migration-'))
  db = openDb(':memory:')
  ensureSchema(db)
  clock = 1_700_000_000_000
  manager = createMigrationManager({ db, dir, now: () => clock })
})
afterEach(() => {
  manager.closeAll()
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

/** The staging databases (SQLite's own -wal and -shm companions are not counted). */
const staging = () => readdirSync(dir).filter((name) => name.startsWith('staging-') && name.endsWith('.db'))
/** Every file of staging, companions included. */
const stagingLeftovers = () => readdirSync(dir).filter((name) => name.startsWith('staging-'))
const failure = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error as MigrationError
  }
  throw new Error('expected a failure')
}

const wordRow = (id: number, word = 'w') => ({
  id,
  word,
  timeStamp: 100 + id,
  dict: 'd',
  chapter: 0,
  timing: [1, 2],
  wrongCount: 0,
  mistakes: { 1: ['x'] },
})
const chapterRow = (id: number, wordRecordIds: number[]) => ({
  id,
  dict: 'd',
  chapter: 0,
  timeStamp: 1,
  time: 5,
  correctCount: 3,
  wrongCount: 0,
  wordCount: 2,
  correctWordIndexes: [0],
  wordNumber: 2,
  wordRecordIds,
})
const setRow = {
  id: 'abc',
  name: 'Mine',
  description: '',
  words: [{ name: 'x', trans: ['n. x'], usphone: '', ukphone: '' }],
  createdAt: 1,
  updatedAt: 2,
}
const cardRow = {
  dict: 'custom:abc',
  word: 'x',
  state: 'review',
  due: 5,
  interval: 2,
  ease: 2.5,
  reps: 3,
  lapses: 0,
  firstSeen: 1,
  lastReviewed: 2,
}
const logRow = { id: 4, at: 9, dict: 'd', word: 'w', kind: 'flashcard', grade: 'good' }
const reviewRow = { id: 2, dict: 'd', index: 1, createTime: 3, isFinished: false, words: [] }

const COUNTS = { wordRecords: 2, chapterRecords: 1, reviewRecords: 1, customDicts: 1, cardProgress: 1, reviewLog: 1 }

function stageEverything(session: string) {
  manager.batch(session, 'wordRecords', [wordRow(7, 'a'), wordRow(9, 'b')])
  manager.batch(session, 'chapterRecords', [chapterRow(3, [7, 9])])
  manager.batch(session, 'reviewRecords', [reviewRow])
  manager.batch(session, 'customDicts', [setRow])
  manager.batch(session, 'cardProgress', [cardRow])
  manager.batch(session, 'reviewLog', [logRow])
}

const mainCount = (table: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n

describe('begin', () => {
  it('opens a staging file next to the database and returns a session', () => {
    const { session } = manager.begin()
    expect(session).toMatch(/^[0-9a-f]{16}$/)
    expect(staging()).toHaveLength(1)
  })

  it('refuses when the folder already holds learning data', () => {
    wordRecords.insert(db, { word: 'w', timeStamp: 1, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} })
    expect(failure(() => manager.begin()).code).toBe('CONFLICT')
    expect(stagingLeftovers()).toEqual([])
  })

  it('refuses after a migration, even when the folder is empty again', () => {
    meta.set(db, 'migratedAt', '1')
    expect(failure(() => manager.begin()).code).toBe('CONFLICT')
  })

  it('keeps two sessions apart', () => {
    const first = manager.begin().session
    const second = manager.begin().session
    manager.batch(first, 'wordRecords', [wordRow(1)])
    manager.batch(second, 'wordRecords', [wordRow(2), wordRow(3)])
    expect(
      manager.commit(
        first,
        { ...COUNTS, wordRecords: 1, chapterRecords: 0, reviewRecords: 0, customDicts: 0, cardProgress: 0, reviewLog: 0 },
        {},
      ).counts.wordRecords,
    ).toBe(1)
    expect(
      failure(() =>
        manager.commit(
          second,
          { ...COUNTS, wordRecords: 2, chapterRecords: 0, reviewRecords: 0, customDicts: 0, cardProgress: 0, reviewLog: 0 },
          {},
        ),
      ).code,
    ).toBe('CONFLICT')
    expect(wordRecords.between(db, 0, 1e9).map((row) => row.id)).toEqual([1])
  })
})

describe('batch', () => {
  it('refuses an unknown session, an unknown table and rows of the wrong shape, and stores nothing from a bad batch', () => {
    const { session } = manager.begin()
    expect(failure(() => manager.batch('nope', 'wordRecords', [wordRow(1)])).code).toBe('NOT_FOUND')
    expect(failure(() => manager.batch(session, 'meta', [])).code).toBe('BAD_REQUEST')
    expect(failure(() => manager.batch(session, 'wordRecords', [wordRow(1), { id: 2 }])).code).toBe('BAD_REQUEST')
    expect(failure(() => manager.batch(session, 'wordRecords', 'no' as never)).code).toBe('BAD_REQUEST')
    manager.batch(session, 'wordRecords', [wordRow(5)])
    expect(
      manager.commit(session, { wordRecords: 1, chapterRecords: 0, reviewRecords: 0, customDicts: 0, cardProgress: 0, reviewLog: 0 }, {})
        .counts.wordRecords,
    ).toBe(1)
  })

  it('refuses the same row twice, in one batch or across batches', () => {
    const { session } = manager.begin()
    expect(failure(() => manager.batch(session, 'wordRecords', [wordRow(1), wordRow(1)])).code).toBe('BAD_REQUEST')
    manager.batch(session, 'wordRecords', [wordRow(1)])
    expect(failure(() => manager.batch(session, 'wordRecords', [wordRow(1)])).code).toBe('CONFLICT')
  })
})

describe('commit', () => {
  it('copies everything into the database with its ids, and the next id follows the highest', () => {
    const { session } = manager.begin()
    stageEverything(session)

    const result = manager.commit(session, COUNTS, { seededPersonalSets: JSON.stringify(['myVocab']) })

    expect(result.counts).toEqual(COUNTS)
    expect(wordRecords.between(db, 0, 1e9).map((row) => row.id)).toEqual([7, 9])
    expect(wordRecords.between(db, 0, 1e9)[0].mistakes).toEqual({ 1: ['x'] })
    expect(chapterRecords.byDict(db, 'd')).toEqual([expect.objectContaining({ id: 3, wordRecordIds: [7, 9] })])
    expect(customDicts.get(db, 'abc')?.words[0].name).toBe('x')
    expect(cardProgress.get(db, 'custom:abc', 'x')?.reps).toBe(3)
    expect(wordRecords.insert(db, { word: 'next', timeStamp: 1, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} })).toBe(10)
  })

  it('records the flags, the time and what the browser held, removes the staging file and writes a backup', () => {
    const { session } = manager.begin()
    stageEverything(session)
    manager.commit(session, COUNTS, { seededPersonalSets: JSON.stringify(['myVocab']) })

    const all = meta.getAll(db)
    expect(all.seededPersonalSets).toBe(JSON.stringify(['myVocab']))
    expect(all.migratedAt).toBe(String(clock))
    expect(JSON.parse(all.migratedFrom)).toEqual(COUNTS)
    expect(stagingLeftovers()).toEqual([])
    const backups = readdirSync(join(dir, 'backups'))
    expect(backups).toHaveLength(1)
    expect(backups[0]).toMatch(/^after-migration-.*\.db$/)
  })

  it('does not accept a second commit or a second begin afterwards', () => {
    const { session } = manager.begin()
    stageEverything(session)
    manager.commit(session, COUNTS, {})
    expect(failure(() => manager.commit(session, COUNTS, {})).code).toBe('NOT_FOUND')
    expect(failure(() => manager.begin()).code).toBe('CONFLICT')
  })

  it('refuses when the counts the browser claims differ from what arrived, writes nothing and keeps the staging file', () => {
    const { session } = manager.begin()
    stageEverything(session)
    expect(failure(() => manager.commit(session, { ...COUNTS, wordRecords: 3 }, {})).code).toBe('CONFLICT')
    for (const table of ['word_records', 'chapter_records', 'review_records', 'custom_dicts', 'card_progress', 'review_log'])
      expect(mainCount(table)).toBe(0)
    expect(meta.getAll(db).migratedAt).toBeUndefined()
    expect(staging()).toHaveLength(1)
  })

  it('refuses counts of the wrong shape', () => {
    const { session } = manager.begin()
    expect(failure(() => manager.commit(session, { wordRecords: 'x' } as never, {})).code).toBe('BAD_REQUEST')
    expect(failure(() => manager.commit(session, COUNTS, { flag: 5 } as never)).code).toBe('BAD_REQUEST')
  })

  it('writes nothing at all when a step fails inside the transaction', () => {
    const { session } = manager.begin()
    stageEverything(session)
    db.exec("CREATE TRIGGER refuse_log BEFORE INSERT ON review_log BEGIN SELECT RAISE(ABORT, 'refused'); END")

    expect(() => manager.commit(session, COUNTS, {})).toThrow()

    for (const table of ['word_records', 'chapter_records', 'review_records', 'custom_dicts', 'card_progress', 'review_log'])
      expect(mainCount(table)).toBe(0)
    expect(meta.getAll(db).migratedAt).toBeUndefined()
    // and it can be tried again once the cause is gone
    db.exec('DROP TRIGGER refuse_log')
    expect(manager.commit(session, COUNTS, {}).counts).toEqual(COUNTS)
  })

  it('refuses when the folder got data in the meantime', () => {
    const { session } = manager.begin()
    stageEverything(session)
    wordRecords.insert(db, { word: 'late', timeStamp: 1, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} })
    expect(failure(() => manager.commit(session, COUNTS, {})).code).toBe('CONFLICT')
    expect(mainCount('word_records')).toBe(1)
  })
})

describe('abort and cleanup', () => {
  it('abort removes the staging file and forgets the session, and an unknown session is not an error', () => {
    const { session } = manager.begin()
    manager.abort(session)
    expect(stagingLeftovers()).toEqual([])
    expect(failure(() => manager.batch(session, 'wordRecords', [])).code).toBe('NOT_FOUND')
    expect(() => manager.abort('never-existed')).not.toThrow()
  })

  it('removes staging files left by an earlier server when a manager starts, and nothing else', () => {
    writeFileSync(join(dir, 'staging-old.db'), 'x')
    writeFileSync(join(dir, 'staging-old.db-wal'), 'x')
    writeFileSync(join(dir, 'qwerty.db'), 'keep')
    writeFileSync(join(dir, 'notes.txt'), 'keep')
    createMigrationManager({ db, dir, now: () => clock })
    expect(readdirSync(dir).sort()).toEqual(['notes.txt', 'qwerty.db'])
  })

  it('closeAll removes the staging files of open sessions', () => {
    manager.begin()
    manager.begin()
    manager.closeAll()
    expect(stagingLeftovers()).toEqual([])
    expect(existsSync(dir)).toBe(true)
  })
})
