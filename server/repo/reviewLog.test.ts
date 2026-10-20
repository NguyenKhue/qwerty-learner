// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as reviewLog from './reviewLog'
import type { IReviewLogEntry } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const entry = (overrides: Partial<IReviewLogEntry> = {}): IReviewLogEntry => ({
  at: 1000,
  dict: 'd',
  word: 'apple',
  kind: 'flashcard',
  grade: 'good',
  ...overrides,
})

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('review_log', () => {
  it('inserts entries with increasing ids and round trips a missing grade', () => {
    const first = reviewLog.insert(db, entry())
    const second = reviewLog.insert(db, entry({ word: 'pear', kind: 'quiz', grade: undefined }))
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    const stored = reviewLog.since(db, 0)
    expect(stored).toHaveLength(2)
    expect(stored[0].grade).toBe('good')
    expect(stored[1].grade).toBeUndefined()
    expect(stored[1].kind).toBe('quiz')
  })

  it('returns entries at or after a bound, oldest first and ties by id', () => {
    reviewLog.insert(db, entry({ at: 3000 }))
    reviewLog.insert(db, entry({ at: 1000 }))
    const tied = reviewLog.insert(db, entry({ at: 2000 }))
    reviewLog.insert(db, entry({ at: 2000 }))
    expect(reviewLog.since(db, 2000).map((row) => row.at)).toEqual([2000, 2000, 3000])
    expect(reviewLog.since(db, 2000)[0].id).toBe(tied)
    expect(reviewLog.since(db, 4000)).toEqual([])
  })

  it('returns distinct hard words of one dict at or after a bound', () => {
    reviewLog.insert(db, entry({ word: 'apple', grade: 'again', at: 10 }))
    reviewLog.insert(db, entry({ word: 'pear', grade: 'hard', at: 11 }))
    reviewLog.insert(db, entry({ word: 'apple', grade: 'again', at: 12 }))
    reviewLog.insert(db, entry({ word: 'fig', grade: 'good', at: 13 }))
    reviewLog.insert(db, entry({ word: 'banana', grade: 'easy', at: 14 }))
    reviewLog.insert(db, entry({ word: 'lime', grade: undefined, at: 15 }))
    reviewLog.insert(db, entry({ dict: 'e', word: 'apple', grade: 'again', at: 16 }))
    expect(reviewLog.hardWordsSince(db, 'd', 10)).toEqual(['apple', 'pear'])
    expect(reviewLog.hardWordsSince(db, 'd', 11)).toEqual(['apple', 'pear'])
    expect(reviewLog.hardWordsSince(db, 'd', 12)).toEqual(['apple'])
    expect(reviewLog.hardWordsSince(db, 'd', 13)).toEqual([])
    expect(reviewLog.hardWordsSince(db, 'd', 17)).toEqual([])
    expect(reviewLog.hardWordsSince(db, 'missing', 0)).toEqual([])
  })

  it('returns the logged times at or after a bound', () => {
    reviewLog.insert(db, entry({ at: 10 }))
    reviewLog.insert(db, entry({ at: 20 }))
    reviewLog.insert(db, entry({ at: 30 }))
    expect(reviewLog.times(db, 20)).toEqual([20, 30])
    expect(reviewLog.times(db, 31)).toEqual([])
  })

  it('renames a word within one dict only', () => {
    reviewLog.insert(db, entry({ word: 'apple' }))
    reviewLog.insert(db, entry({ word: 'apple' }))
    reviewLog.insert(db, entry({ word: 'apple', dict: 'e' }))
    expect(reviewLog.renameWord(db, 'd', 'apple', 'apricot')).toBe(2)
    expect(reviewLog.renameWord(db, 'd', 'apple', 'apricot')).toBe(0)
    expect(reviewLog.since(db, 0).filter((row) => row.word === 'apricot')).toHaveLength(2)
    expect(reviewLog.since(db, 0).filter((row) => row.word === 'apple')).toHaveLength(1)
  })

  it('moves every entry to another dict', () => {
    reviewLog.insert(db, entry())
    reviewLog.insert(db, entry({ word: 'pear' }))
    reviewLog.insert(db, entry({ dict: 'e' }))
    expect(reviewLog.moveDict(db, 'd', 'e')).toBe(2)
    expect(reviewLog.since(db, 0).every((row) => row.dict === 'e')).toBe(true)
    expect(reviewLog.moveDict(db, 'missing', 'e')).toBe(0)
  })
})
