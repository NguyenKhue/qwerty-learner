// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as cardProgress from './cardProgress'
import type { ICardProgress } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const card = (overrides: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: 'apple',
  state: 'learning',
  due: 1000,
  interval: 1,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: 500,
  lastReviewed: 900,
  ...overrides,
})

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('card_progress', () => {
  it('inserts a card and reads it back', () => {
    cardProgress.put(db, card())
    expect(cardProgress.get(db, 'd', 'apple')).toEqual(card())
    expect(cardProgress.get(db, 'd', 'missing')).toBe(null)
  })

  it('replaces a card with the same dict and word', () => {
    cardProgress.put(db, card())
    cardProgress.put(db, card({ state: 'review', reps: 4, interval: 7, ease: 2.7, lastReviewed: 5000 }))
    const rows = cardProgress.byDict(db, 'd')
    expect(rows).toHaveLength(1)
    expect(rows[0].state).toBe('review')
    expect(rows[0].reps).toBe(4)
    expect(rows[0].interval).toBe(7)
    expect(rows[0].ease).toBe(2.7)
  })

  it('returns only the dict asked for, ordered by word', () => {
    cardProgress.put(db, card({ word: 'pear' }))
    cardProgress.put(db, card({ word: 'apple' }))
    cardProgress.put(db, card({ dict: 'e', word: 'fig' }))
    expect(cardProgress.byDict(db, 'd').map((row) => row.word)).toEqual(['apple', 'pear'])
    expect(cardProgress.byDict(db, 'e').map((row) => row.word)).toEqual(['fig'])
    expect(cardProgress.byDict(db, 'missing')).toEqual([])
  })

  it('deletes one card or a whole dict and reports the count', () => {
    cardProgress.put(db, card({ word: 'apple' }))
    cardProgress.put(db, card({ word: 'pear' }))
    cardProgress.put(db, card({ dict: 'e', word: 'fig' }))
    expect(cardProgress.delete(db, 'd', 'apple')).toBe(1)
    expect(cardProgress.delete(db, 'd', 'apple')).toBe(0)
    expect(cardProgress.deleteByDict(db, 'd')).toBe(1)
    expect(cardProgress.byDict(db, 'e')).toHaveLength(1)
  })

  it('moves a dict, leaving rows whose target key already exists untouched', () => {
    cardProgress.put(db, card({ dict: 'from', word: 'apple', reps: 1 }))
    cardProgress.put(db, card({ dict: 'from', word: 'pear', reps: 2 }))
    cardProgress.put(db, card({ dict: 'to', word: 'apple', reps: 9 }))
    expect(cardProgress.moveDict(db, 'from', 'to')).toBe(1)
    expect(cardProgress.byDict(db, 'from')).toEqual([card({ dict: 'from', word: 'apple', reps: 1 })])
    const target = cardProgress.byDict(db, 'to')
    expect(target.map((row) => row.word)).toEqual(['apple', 'pear'])
    expect(target.find((row) => row.word === 'apple')?.reps).toBe(9)
    expect(cardProgress.moveDict(db, 'missing', 'to')).toBe(0)
  })
})
