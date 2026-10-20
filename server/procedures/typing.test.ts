// @vitest-environment node
import type { Db } from '../adapter'
import { openDb } from '../adapter'
import { insert as insertReviewLog } from '../repo/reviewLog'
import { ensureSchema } from '../schema'
import type { Ctx } from './support'
import { ProcedureError } from './support'
import { handlers } from './typing'
import type { StoredChapterRecord, StoredWordRecord } from '@/data/contract'
import type { IChapterRecord, IWordRecord } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let db: Db
let ctx: Ctx

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
  ctx = { db, now: () => 0 }
})

afterEach(() => {
  db.close()
})

/** A valid word record, with fields overridden per test. */
function word(overrides: Partial<IWordRecord> = {}): IWordRecord {
  return {
    word: 'apple',
    dict: 'dict',
    chapter: 0,
    timeStamp: 1000,
    timing: [100, 120],
    wrongCount: 0,
    mistakes: {},
    ...overrides,
  }
}

/** A valid chapter record, with fields overridden per test. */
function chapter(overrides: Partial<IChapterRecord> = {}): IChapterRecord {
  return {
    dict: 'dict',
    chapter: 0,
    timeStamp: 1000,
    time: 30,
    correctCount: 100,
    wrongCount: 0,
    wordCount: 20,
    correctWordIndexes: [0, 1],
    wordNumber: 20,
    wordRecordIds: [],
    ...overrides,
  }
}

/** Calls a handler directly, as the HTTP layer would. */
function run(name: keyof typeof handlers, args: unknown[] = []): unknown {
  return handlers[name]!(ctx, args)
}

/** Calls a handler and asserts the contract's BAD_REQUEST error. */
function expectBadRequest(name: keyof typeof handlers, args: unknown[]): void {
  let error: unknown
  try {
    run(name, args)
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(ProcedureError)
  expect((error as ProcedureError).code).toBe('BAD_REQUEST')
}

/** Adds a word record through the handler and returns its id. */
function addWord(overrides: Partial<IWordRecord> = {}): number {
  return run('words.add', [word(overrides)]) as number
}

/** Adds a chapter record through the handler and returns its id. */
function addChapter(overrides: Partial<IChapterRecord> = {}): number {
  return run('chapters.add', [chapter(overrides)]) as number
}

describe('typing procedures', () => {
  it('returns positive, increasing ids from words.add and stores the record', () => {
    const first = addWord({ word: 'apple', timeStamp: 1000 })
    const second = addWord({ word: 'pear', timeStamp: 2000 })

    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)

    const stored = run('words.between', [1000, 2000]) as StoredWordRecord[]
    expect(stored.map((record) => record.word)).toEqual(['apple'])
    expect(stored[0].id).toBe(first)
    expect(stored[0].timing).toEqual([100, 120])
    expect(stored[0].mistakes).toEqual({})
  })

  it('words.between includes start, excludes end and orders by timestamp', () => {
    addWord({ word: 'late', timeStamp: 3000 })
    addWord({ word: 'early', timeStamp: 1000 })
    addWord({ word: 'middle', timeStamp: 2000 })

    const records = run('words.between', [1000, 3000]) as StoredWordRecord[]
    expect(records.map((record) => record.word)).toEqual(['early', 'middle'])
  })

  it('words.wrong and words.wrongByDict return only records with mistakes', () => {
    addWord({ word: 'apple', dict: 'a', wrongCount: 2 })
    addWord({ word: 'pear', dict: 'a', wrongCount: 0 })
    addWord({ word: 'plum', dict: 'b', wrongCount: 1 })

    const wrong = run('words.wrong') as StoredWordRecord[]
    expect(wrong.map((record) => record.word).sort()).toEqual(['apple', 'plum'])

    const wrongInA = run('words.wrongByDict', ['a']) as StoredWordRecord[]
    expect(wrongInA.map((record) => record.word)).toEqual(['apple'])
  })

  it('words.revisionCount counts distinct words with a wrong record in the dict', () => {
    addWord({ word: 'apple', dict: 'a', wrongCount: 1 })
    addWord({ word: 'apple', dict: 'a', wrongCount: 2 })
    addWord({ word: 'pear', dict: 'a', wrongCount: 1 })
    addWord({ word: 'apple', dict: 'b', wrongCount: 1 })

    expect(run('words.revisionCount', ['a'])).toBe(2)
    expect(run('words.revisionCount', ['b'])).toBe(1)
    expect(run('words.revisionCount', ['c'])).toBe(0)
  })

  it('words.deleteByWord only deletes records matching both word and dict and returns the count', () => {
    addWord({ word: 'apple', dict: 'a' })
    addWord({ word: 'apple', dict: 'a' })
    addWord({ word: 'apple', dict: 'b' })
    addWord({ word: 'pear', dict: 'a' })

    expect(run('words.deleteByWord', ['apple', 'a'])).toBe(2)

    const remaining = run('words.between', [0, 10000]) as StoredWordRecord[]
    expect(remaining.map((record) => `${record.dict}:${record.word}`).sort()).toEqual(['a:pear', 'b:apple'])
  })

  it('returns positive, increasing ids from chapters.add and reads them back', () => {
    const first = addChapter({ chapter: 0, wordRecordIds: [7, 9] })
    const second = addChapter({ chapter: 1, timeStamp: 2000 })

    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)

    const all = run('chapters.byDict', ['dict']) as StoredChapterRecord[]
    expect(all.map((record) => record.chapter)).toEqual([0, 1])
    expect(all[0].wordRecordIds).toEqual([7, 9])
    expect(all[0].correctWordIndexes).toEqual([0, 1])

    const onlyChapterOne = run('chapters.byDictChapter', ['dict', 1]) as StoredChapterRecord[]
    expect(onlyChapterOne.map((record) => record.id)).toEqual([second])
  })

  it('stats.summary is zeroed on an empty database', () => {
    expect(run('stats.summary')).toEqual({ chapterCount: 0, wordCount: 0, firstWordTimestamp: null, sumWrongCount: 0 })
  })

  it('stats.summary returns the first timestamp and the summed wrong counts', () => {
    addWord({ timeStamp: 3000 })
    addWord({ timeStamp: 1000 })
    addChapter({ wrongCount: 2 })
    addChapter({ wrongCount: 3 })

    expect(run('stats.summary')).toEqual({ chapterCount: 2, wordCount: 2, firstWordTimestamp: 1000, sumWrongCount: 5 })
  })

  it('activity.times returns review times in ms and typed times in seconds at or after from', () => {
    const fromMs = 1_700_000_000_000
    const fromSeconds = Math.floor(fromMs / 1000)

    insertReviewLog(db, { at: fromMs - 1, dict: 'a', word: 'old', kind: 'flashcard', grade: 'good' })
    insertReviewLog(db, { at: fromMs, dict: 'a', word: 'now', kind: 'flashcard', grade: 'good' })
    insertReviewLog(db, { at: fromMs + 5, dict: 'a', word: 'later', kind: 'quiz' })

    addWord({ word: 'old', timeStamp: fromSeconds - 1 })
    addWord({ word: 'now', timeStamp: fromSeconds })
    addWord({ word: 'later', timeStamp: fromSeconds + 5 })

    expect(run('activity.times', [fromMs])).toEqual({
      reviewTimes: [fromMs, fromMs + 5],
      typedSeconds: [fromSeconds, fromSeconds + 5],
    })
  })

  it('log.hardWordsSince returns distinct again or hard words of the dict at or after since', () => {
    insertReviewLog(db, { at: 500, dict: 'a', word: 'eel', kind: 'flashcard', grade: 'again' })
    insertReviewLog(db, { at: 1000, dict: 'a', word: 'cat', kind: 'flashcard', grade: 'again' })
    insertReviewLog(db, { at: 1500, dict: 'b', word: 'yak', kind: 'flashcard', grade: 'again' })
    insertReviewLog(db, { at: 2000, dict: 'a', word: 'dog', kind: 'flashcard', grade: 'hard' })
    insertReviewLog(db, { at: 2500, dict: 'a', word: 'cat', kind: 'flashcard', grade: 'again' })
    insertReviewLog(db, { at: 3000, dict: 'a', word: 'fox', kind: 'flashcard', grade: 'good' })

    expect(run('log.hardWordsSince', ['a', 1000])).toEqual(['cat', 'dog'])
    expect(run('log.hardWordsSince', ['b', 1000])).toEqual(['yak'])
    expect(run('log.hardWordsSince', ['a', 4000])).toEqual([])
  })
})

describe('typing procedure argument validation', () => {
  it('uses the ProcedureError name and code', () => {
    let error: unknown
    try {
      run('words.between', [])
    } catch (caught) {
      error = caught
    }
    expect(error).toBeInstanceOf(ProcedureError)
    expect((error as ProcedureError).name).toBe('ProcedureError')
    expect((error as ProcedureError).code).toBe('BAD_REQUEST')
  })

  it('rejects a missing argument of every procedure that takes one', () => {
    const names: Array<keyof typeof handlers> = [
      'words.add',
      'words.deleteByWord',
      'words.between',
      'words.wrongByDict',
      'words.revisionCount',
      'chapters.add',
      'chapters.byDict',
      'chapters.byDictChapter',
      'activity.times',
      'log.hardWordsSince',
    ]
    for (const name of names) expectBadRequest(name, [])
  })

  it('rejects a wrong argument type for every procedure that takes one', () => {
    const cases: Array<[keyof typeof handlers, unknown[]]> = [
      ['words.add', [{}]],
      ['words.add', [{ ...word(), word: 1 }]],
      ['words.add', [{ ...word(), dict: null }]],
      ['words.add', [{ ...word(), timeStamp: '1000' }]],
      ['words.add', [{ ...word(), timeStamp: Number.NaN }]],
      ['words.add', [{ ...word(), chapter: '0' }]],
      ['words.add', [{ ...word(), chapter: undefined }]],
      ['words.add', [{ ...word(), timing: 100 }]],
      ['words.add', [{ ...word(), wrongCount: '0' }]],
      ['words.add', [{ ...word(), mistakes: [] }]],
      ['words.deleteByWord', [1, 'dict']],
      ['words.deleteByWord', ['apple', 2]],
      ['words.between', ['1000', 2000]],
      ['words.between', [1000, Number.NaN]],
      ['words.wrongByDict', [1]],
      ['words.revisionCount', [null]],
      ['chapters.add', [{}]],
      ['chapters.add', [{ ...chapter(), dict: 1 }]],
      ['chapters.add', [{ ...chapter(), timeStamp: '1000' }]],
      ['chapters.add', [{ ...chapter(), time: null }]],
      ['chapters.add', [{ ...chapter(), correctCount: '100' }]],
      ['chapters.add', [{ ...chapter(), wrongCount: Number.POSITIVE_INFINITY }]],
      ['chapters.add', [{ ...chapter(), wordCount: '20' }]],
      ['chapters.add', [{ ...chapter(), wordNumber: undefined }]],
      ['chapters.add', [{ ...chapter(), correctWordIndexes: 0 }]],
      ['chapters.add', [{ ...chapter(), wordRecordIds: {} }]],
      ['chapters.add', [{ ...chapter(), chapter: '0' }]],
      ['chapters.byDict', [1]],
      ['chapters.byDictChapter', ['dict', '1']],
      ['activity.times', ['1000']],
      ['log.hardWordsSince', [1, 1000]],
      ['log.hardWordsSince', ['a', null]],
    ]
    for (const [name, args] of cases) expectBadRequest(name, args)
  })

  it('accepts a null chapter on word and chapter records', () => {
    expect(addWord({ chapter: null })).toBeGreaterThan(0)
    expect(addChapter({ chapter: null })).toBeGreaterThan(0)
  })
})
