// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as reviewRecords from './reviewRecords'
import type { StoredReviewRecord } from '@/data/contract'
import type { IReviewRecord } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const words = (names: string[]) => names.map((name) => ({ name })) as unknown as StoredReviewRecord['words']

const record = (overrides: Partial<IReviewRecord> = {}): IReviewRecord => ({
  dict: 'd',
  index: 0,
  createTime: 1000,
  isFinished: false,
  words: words(['apple', 'pear']),
  ...overrides,
})

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('review_records', () => {
  it('inserts a record without an id and returns the new id', () => {
    const id = reviewRecords.put(db, record())
    expect(id).toBeGreaterThan(0)
    const [stored] = db.all<reviewRecords.ReviewRecordRow>('SELECT * FROM review_records')
    expect(stored.id).toBe(id)
  })

  it('replaces the row with the same id instead of inserting another', () => {
    const id = reviewRecords.put(db, record())
    const returned = reviewRecords.put(db, record({ id, index: 5, isFinished: true, words: words(['banana']) }))
    expect(returned).toBe(id)
    const rows = db.all<reviewRecords.ReviewRecordRow>('SELECT * FROM review_records')
    expect(rows).toHaveLength(1)
    expect(rows[0].position).toBe(5)
    expect(rows[0].is_finished).toBe(1)
    expect(rows[0].words).toBe('[{"name":"banana"}]')
  })

  it('returns the newest unfinished record of the dict and parses its words', () => {
    reviewRecords.put(db, record({ createTime: 1000 }))
    const newest = reviewRecords.put(db, record({ createTime: 2000, index: 3, words: words(['apple', 'pear', 'fig']) }))
    reviewRecords.put(db, record({ dict: 'e', createTime: 3000 }))
    const latest = reviewRecords.latestUnfinished(db, 'd')
    expect(latest?.id).toBe(newest)
    expect(latest?.index).toBe(3)
    expect(latest?.isFinished).toBe(false)
    expect(latest?.words).toEqual(words(['apple', 'pear', 'fig']))
  })

  it('returns null when the newest record of the dict is finished, even if an older one is not', () => {
    reviewRecords.put(db, record({ createTime: 1000, isFinished: false }))
    reviewRecords.put(db, record({ createTime: 2000, isFinished: true }))
    expect(reviewRecords.latestUnfinished(db, 'd')).toBe(null)
    expect(reviewRecords.latestUnfinished(db, 'missing')).toBe(null)
  })

  it('deletes every record of one dict and reports the count', () => {
    reviewRecords.put(db, record())
    reviewRecords.put(db, record())
    reviewRecords.put(db, record({ dict: 'e' }))
    expect(reviewRecords.deleteByDict(db, 'd')).toBe(2)
    expect(reviewRecords.deleteByDict(db, 'missing')).toBe(0)
    expect(reviewRecords.latestUnfinished(db, 'e')?.dict).toBe('e')
  })
})
