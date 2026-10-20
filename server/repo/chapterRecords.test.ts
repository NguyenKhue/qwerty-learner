// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as chapterRecords from './chapterRecords'
import type { IChapterRecord } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const record = (overrides: Partial<IChapterRecord> = {}): IChapterRecord => ({
  dict: 'd',
  chapter: 0,
  timeStamp: 1000,
  time: 30,
  correctCount: 200,
  wrongCount: 4,
  wordCount: 20,
  correctWordIndexes: [0, 1, 3],
  wordNumber: 20,
  wordRecordIds: [7, 9],
  ...overrides,
})

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('chapter_records', () => {
  it('inserts records with increasing ids and round trips the JSON columns', () => {
    const first = chapterRecords.insert(db, record({ chapter: null }))
    const second = chapterRecords.insert(db, record({ chapter: 2 }))
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    const [stored] = chapterRecords.byDictChapter(db, 'd', 2)
    expect(stored.id).toBe(second)
    expect(stored.correctWordIndexes).toEqual([0, 1, 3])
    expect(stored.wordRecordIds).toEqual([7, 9])
    expect(stored.chapter).toBe(2)
    expect(stored.time).toBe(30)
    expect(chapterRecords.byDict(db, 'd')[0].chapter).toBe(null)
  })

  it('returns only the dict or chapter asked for, in insertion order', () => {
    const first = chapterRecords.insert(db, record({ chapter: 1 }))
    chapterRecords.insert(db, record({ dict: 'e', chapter: 1 }))
    const second = chapterRecords.insert(db, record({ chapter: 2 }))
    const third = chapterRecords.insert(db, record({ chapter: 1 }))
    expect(chapterRecords.byDict(db, 'd').map((row) => row.id)).toEqual([first, second, third])
    expect(chapterRecords.byDict(db, 'e')).toHaveLength(1)
    expect(chapterRecords.byDictChapter(db, 'd', 1).map((row) => row.id)).toEqual([first, third])
    expect(chapterRecords.byDictChapter(db, 'd', 99)).toEqual([])
  })

  it('counts records and sums the wrong key presses', () => {
    expect(chapterRecords.count(db)).toBe(0)
    expect(chapterRecords.sumWrong(db)).toBe(0)
    chapterRecords.insert(db, record({ wrongCount: 4 }))
    chapterRecords.insert(db, record({ dict: 'e', wrongCount: 6 }))
    expect(chapterRecords.count(db)).toBe(2)
    expect(chapterRecords.sumWrong(db)).toBe(10)
  })

  it('deletes every record of one dict and reports the count', () => {
    chapterRecords.insert(db, record())
    chapterRecords.insert(db, record())
    chapterRecords.insert(db, record({ dict: 'e' }))
    expect(chapterRecords.deleteByDict(db, 'd')).toBe(2)
    expect(chapterRecords.count(db)).toBe(1)
    expect(chapterRecords.deleteByDict(db, 'missing')).toBe(0)
  })

  it('moves every record of one dict to another dict and reports how many, keeping ids', () => {
    const id = chapterRecords.insert(db, record({ dict: 'old' }))
    chapterRecords.insert(db, record({ dict: 'other' }))
    expect(chapterRecords.moveDict(db, 'old', 'new')).toBe(1)
    expect(chapterRecords.byDict(db, 'new').map((row) => row.id)).toEqual([id])
    expect(chapterRecords.byDict(db, 'old')).toEqual([])
    expect(chapterRecords.byDict(db, 'other')).toHaveLength(1)
  })
})
