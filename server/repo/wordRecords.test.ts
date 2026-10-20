// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as wordRecords from './wordRecords'
import type { IWordRecord, LetterMistakes } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const record = (overrides: Partial<IWordRecord> = {}): IWordRecord => ({
  word: 'apple',
  timeStamp: 1000,
  dict: 'd',
  chapter: 0,
  timing: [10, 20],
  wrongCount: 0,
  mistakes: {},
  ...overrides,
})

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('word_records', () => {
  it('inserts records with increasing ids', () => {
    const first = wordRecords.insert(db, record())
    const second = wordRecords.insert(db, record({ word: 'pear' }))
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
  })

  it('continues after an explicit high id', () => {
    db.run(
      `INSERT INTO word_records (id, word, timestamp, dict, chapter, wrong_count, timing, mistakes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [500, 'high', 1, 'd', null, 0, '[]', '{}'],
    )
    expect(wordRecords.insert(db, record({ word: 'after' }))).toBe(501)
  })

  it('round trips the JSON columns, a null chapter and a sparse mistakes object unchanged', () => {
    const mistakes: LetterMistakes = { 0: ['a', 's'], 3: ['x'] }
    wordRecords.insert(db, record({ chapter: null, timing: [1, 2.5, 3], mistakes }))
    const [stored] = wordRecords.between(db, 0, 2000)
    expect(stored.timing).toEqual([1, 2.5, 3])
    expect(stored.mistakes).toEqual(mistakes)
    expect(stored.chapter).toBe(null)
    expect(stored.timeStamp).toBe(1000)
    expect(stored.wrongCount).toBe(0)
    expect(stored.id).toBeGreaterThan(0)
  })

  it('returns only wrong records, and only the dict asked for', () => {
    wordRecords.insert(db, record({ word: 'clean' }))
    wordRecords.insert(db, record({ word: 'wrong', wrongCount: 2 }))
    wordRecords.insert(db, record({ word: 'other', dict: 'e', wrongCount: 1 }))
    expect(wordRecords.wrong(db).map((row) => row.word)).toEqual(['other', 'wrong'])
    expect(wordRecords.wrongByDict(db, 'd').map((row) => row.word)).toEqual(['wrong'])
    expect(wordRecords.wrongByDict(db, 'missing')).toEqual([])
  })

  it('reads timestamps from a lower bound up to, but not including, an upper bound, in timestamp then id order (as Dexie did)', () => {
    wordRecords.insert(db, record({ word: 'c', timeStamp: 3 }))
    wordRecords.insert(db, record({ word: 'a', timeStamp: 1 }))
    wordRecords.insert(db, record({ word: 'b1', timeStamp: 2 }))
    wordRecords.insert(db, record({ word: 'b2', timeStamp: 2 }))
    expect(wordRecords.between(db, 1, 4).map((row) => row.word)).toEqual(['a', 'b1', 'b2', 'c'])
    expect(wordRecords.between(db, 1, 3).map((row) => row.word)).toEqual(['a', 'b1', 'b2'])
    expect(wordRecords.between(db, 2, 3).map((row) => row.word)).toEqual(['b1', 'b2'])
    expect(wordRecords.between(db, 2, 2)).toEqual([])
    expect(wordRecords.between(db, 4, 9)).toEqual([])
  })

  it('lists the wrong records of a dict by number of mistakes and then by id, the order of the old wrongCount index', () => {
    wordRecords.insert(db, record({ word: 'many', wrongCount: 3 }))
    wordRecords.insert(db, record({ word: 'one-a', wrongCount: 1 }))
    wordRecords.insert(db, record({ word: 'one-b', wrongCount: 1 }))
    expect(wordRecords.wrongByDict(db, 'd').map((row) => row.word)).toEqual(['one-a', 'one-b', 'many'])
  })

  it('counts distinct wrong words per dict', () => {
    wordRecords.insert(db, record({ word: 'apple', wrongCount: 1 }))
    wordRecords.insert(db, record({ word: 'apple', wrongCount: 2 }))
    wordRecords.insert(db, record({ word: 'pear' }))
    wordRecords.insert(db, record({ word: 'banana', wrongCount: 1 }))
    wordRecords.insert(db, record({ word: 'apple', dict: 'e', wrongCount: 1 }))
    expect(wordRecords.revisionCount(db, 'd')).toBe(2)
    expect(wordRecords.revisionCount(db, 'e')).toBe(1)
    expect(wordRecords.revisionCount(db, 'missing')).toBe(0)
  })

  it('reports the count, the oldest timestamp and the typed seconds from a bound', () => {
    expect(wordRecords.count(db)).toBe(0)
    expect(wordRecords.firstByTimestamp(db)).toBe(null)
    wordRecords.insert(db, record({ word: 'late', timeStamp: 3000 }))
    wordRecords.insert(db, record({ word: 'early', timeStamp: 1000 }))
    wordRecords.insert(db, record({ word: 'other', dict: 'e', timeStamp: 2000 }))
    expect(wordRecords.count(db)).toBe(3)
    expect(wordRecords.firstByTimestamp(db)?.word).toBe('early')
    expect(wordRecords.typedSeconds(db, 2000)).toEqual([2000, 3000])
    expect(wordRecords.typedSeconds(db, 5000)).toEqual([])
  })

  it('deletes by word and dict only, and reports the count', () => {
    wordRecords.insert(db, record({ word: 'apple' }))
    wordRecords.insert(db, record({ word: 'apple' }))
    wordRecords.insert(db, record({ word: 'apple', dict: 'e' }))
    wordRecords.insert(db, record({ word: 'pear' }))
    expect(wordRecords.deleteByWordDict(db, 'apple', 'd')).toBe(2)
    expect(wordRecords.count(db)).toBe(2)
    expect(wordRecords.between(db, 0, 5000).filter((row) => row.dict === 'e')).toHaveLength(1)
  })

  it('deletes a whole dict and renames a word within one dict', () => {
    wordRecords.insert(db, record({ word: 'old' }))
    wordRecords.insert(db, record({ word: 'old' }))
    wordRecords.insert(db, record({ word: 'old', dict: 'e' }))
    expect(wordRecords.renameWord(db, 'd', 'old', 'new')).toBe(2)
    expect(wordRecords.count(db)).toBe(3)
    expect(wordRecords.between(db, 0, 5000).filter((row) => row.word === 'new')).toHaveLength(2)
    expect(wordRecords.renameWord(db, 'd', 'old', 'new')).toBe(0)
    expect(wordRecords.deleteByDict(db, 'd')).toBe(2)
    expect(wordRecords.count(db)).toBe(1)
  })

  it('moves every record of one dict to another dict and reports how many, leaving other dicts alone', () => {
    wordRecords.insert(db, record({ dict: 'old' }))
    wordRecords.insert(db, record({ dict: 'old' }))
    wordRecords.insert(db, record({ dict: 'other' }))
    expect(wordRecords.moveDict(db, 'old', 'new')).toBe(2)
    expect(wordRecords.moveDict(db, 'old', 'new')).toBe(0)
    expect(
      wordRecords
        .between(db, 0, 1e12)
        .map((row) => row.dict)
        .sort(),
    ).toEqual(['new', 'new', 'other'])
  })
})
