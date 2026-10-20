// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import * as cardProgress from '../repo/cardProgress'
import * as reviewLog from '../repo/reviewLog'
import { ensureSchema } from '../schema'
import { handlers as cardHandlers } from './cards'
import { ProcedureError } from './support'
import type { ICardProgress } from '@/utils/db/record'
import type { Grade } from '@/utils/srs/scheduler'
import { beforeEach, describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const DAY = 86400000

let db: Db
beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

const ctx = () => ({ db, now: () => NOW })
const call = (name: keyof typeof cardHandlers, ...args: unknown[]) => cardHandlers[name]!(ctx(), args)
const review = (dict: string, word: string, grade: Grade, at?: number) => call('cards.review', dict, word, grade, at) as ICardProgress
const quiz = (dict: string, word: string, correct: boolean, at?: number) =>
  call('cards.reviewQuiz', dict, word, correct, at) as ICardProgress | null
const logRows = () => reviewLog.since(db, 0)
const cardCount = () => db.get<{ n: number }>('SELECT COUNT(*) AS n FROM card_progress')!.n

describe('cards.review', () => {
  it('creates a row for a new card and returns it', () => {
    const saved = review('custom:a', 'apple', 'good', NOW)
    expect(saved).toMatchObject({ dict: 'custom:a', word: 'apple', state: 'review', interval: 1, reps: 1, firstSeen: NOW })
    expect(cardProgress.get(db, 'custom:a', 'apple')).toEqual(saved)
  })

  it('updates the same row on the next review and keeps firstSeen', () => {
    review('custom:a', 'apple', 'good', NOW)
    const later = NOW + 3 * DAY
    const saved = review('custom:a', 'apple', 'good', later)
    expect(saved).toMatchObject({ reps: 2, firstSeen: NOW, lastReviewed: later, interval: 3 })
    expect(cardCount()).toBe(1)
  })

  it('keeps the same word in different dictionaries apart', () => {
    review('custom:a', 'apple', 'easy', NOW)
    review('custom:b', 'apple', 'again', NOW)
    expect(cardProgress.get(db, 'custom:a', 'apple')?.state).toBe('review')
    expect(cardProgress.get(db, 'custom:b', 'apple')?.state).toBe('learning')
  })

  it('uses the server clock when no time is given', () => {
    expect(review('d', 'w', 'good').firstSeen).toBe(NOW)
  })

  it('records one log entry for each graded flashcard', () => {
    review('d', 'a', 'good', NOW)
    review('d', 'a', 'good', NOW + 1000)
    const rows = logRows()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ at: NOW, dict: 'd', word: 'a', kind: 'flashcard', grade: 'good' })
  })

  it('leaves no card and no log entry behind when the log cannot be written', () => {
    db.exec('DROP TABLE review_log')
    expect(() => review('d', 'a', 'good', NOW)).toThrow()
    expect(cardCount()).toBe(0)
  })

  it('leaves the card as it was when a later review cannot write the log', () => {
    const first = review('d', 'a', 'good', NOW)
    db.exec('DROP TABLE review_log')
    expect(() => review('d', 'a', 'good', NOW + 3 * DAY)).toThrow()
    expect(cardProgress.get(db, 'd', 'a')).toEqual(first)
  })

  it('rejects a grade that does not exist and arguments of the wrong shape', () => {
    expect(() => call('cards.review', 'd', 'w', 'bogus')).toThrow(ProcedureError)
    expect(() => call('cards.review', 'd')).toThrow(ProcedureError)
    expect(() => call('cards.review', 5, 'w', 'good')).toThrow(ProcedureError)
    expect(() => call('cards.review', 'd', 'w', 'good', 'later')).toThrow(ProcedureError)
    expect(cardCount()).toBe(0)
  })
})

describe('cards.byDict', () => {
  it('returns only the rows of the given dictionary', () => {
    review('custom:a', 'apple', 'good', NOW)
    review('custom:a', 'pear', 'good', NOW)
    review('custom:b', 'plum', 'good', NOW)
    const rows = call('cards.byDict', 'custom:a') as ICardProgress[]
    expect(rows.map((r) => r.word).sort()).toEqual(['apple', 'pear'])
    expect(call('cards.byDict', 'custom:none')).toEqual([])
  })

  it('keeps the progress of a built-in dictionary under its own id', () => {
    review('cet4', 'abandon', 'good', NOW)
    expect(call('cards.byDict', 'cet4')).toHaveLength(1)
    expect((call('cards.byDict', 'cet4') as ICardProgress[])[0]).toMatchObject({ dict: 'cet4', word: 'abandon', reps: 1 })
    expect(call('cards.byDict', 'cet6')).toEqual([])
  })
})

describe('cards.reviewQuiz', () => {
  const dict = 'custom:q'
  const row = (over: Partial<ICardProgress> = {}): ICardProgress => ({
    dict,
    word: 'apple',
    state: 'review',
    due: NOW - 1000,
    interval: 3,
    ease: 2.5,
    reps: 4,
    lapses: 0,
    firstSeen: NOW - 5 * DAY,
    lastReviewed: NOW - DAY,
    ...over,
  })

  it('a wrong answer on a never-studied word introduces it as a learning card', () => {
    expect(quiz(dict, 'apple', false, NOW)).toMatchObject({ state: 'learning', reps: 1, firstSeen: NOW })
    expect(cardCount()).toBe(1)
  })

  it('a correct answer on a never-studied word writes nothing', () => {
    expect(quiz(dict, 'apple', true, NOW)).toBeNull()
    expect(cardCount()).toBe(0)
    expect(logRows()).toEqual([])
  })

  it('a correct answer on a due card is graded good', () => {
    cardProgress.put(db, row())
    expect(quiz(dict, 'apple', true, NOW)).toMatchObject({ state: 'review', reps: 5, lapses: 0 })
    expect(cardProgress.get(db, dict, 'apple')?.reps).toBe(5)
  })

  it('a correct answer on a card that is not due yet changes nothing', () => {
    const card = row({ due: NOW + DAY })
    cardProgress.put(db, card)
    expect(quiz(dict, 'apple', true, NOW)).toBeNull()
    expect(cardProgress.get(db, dict, 'apple')).toEqual(card)
  })

  it('a wrong answer on a due card is graded again and counts a lapse', () => {
    cardProgress.put(db, row())
    expect(quiz(dict, 'apple', false, NOW)).toMatchObject({ state: 'learning', lapses: 1, reps: 5 })
  })

  it('decides from the row as it is now, not from a snapshot taken earlier', () => {
    cardProgress.put(db, row({ due: NOW + DAY }))
    expect(quiz(dict, 'apple', true, NOW)).toBeNull()
    cardProgress.put(db, row({ due: NOW - 1 }))
    expect(quiz(dict, 'apple', true, NOW)).toMatchObject({ reps: 5 })
  })

  it('applies quiz answers to built-in dictionaries like to custom sets', () => {
    expect(quiz('cet4', 'abandon', false, NOW)).toMatchObject({ dict: 'cet4', word: 'abandon', state: 'learning' })
    review('cet4', 'ability', 'good', NOW)
    expect(quiz('cet4', 'ability', true, NOW + 1000)).toBeNull()
    expect(quiz('cet4', 'ability', true, NOW + 5 * DAY)?.reps).toBe(2)
  })

  it('records a quiz answer in the log only when it touches the schedule', () => {
    expect(quiz('d', 'new', true, NOW)).toBeNull()
    expect(logRows()).toEqual([])
    quiz('d', 'new', false, NOW)
    expect(logRows()).toEqual([expect.objectContaining({ at: NOW, dict: 'd', word: 'new', kind: 'quiz' })])
  })

  it('leaves no card behind when the log cannot be written', () => {
    db.exec('DROP TABLE review_log')
    expect(() => quiz('d', 'new', false, NOW)).toThrow()
    expect(cardCount()).toBe(0)
  })
})
