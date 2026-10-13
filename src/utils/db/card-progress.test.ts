import { getDictProgress, reviewCard, reviewQuizAnswer } from './card-progress'
import { db } from './database'
import type { ICardProgress } from './record'
import { beforeEach, describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()

beforeEach(async () => {
  await db.cardProgress.clear()
  await db.reviewLog.clear()
})

describe('reviewCard', () => {
  it('creates a row for a new card and returns it', async () => {
    const saved = await reviewCard('custom:a', 'apple', 'good', NOW)
    expect(saved).toMatchObject({ dict: 'custom:a', word: 'apple', state: 'review', interval: 1, reps: 1, firstSeen: NOW })
    expect(await db.cardProgress.get(['custom:a', 'apple'])).toEqual(saved)
  })

  it('updates the same row on the next review and keeps firstSeen', async () => {
    await reviewCard('custom:a', 'apple', 'good', NOW)
    const later = NOW + 3 * 86400000
    const saved = await reviewCard('custom:a', 'apple', 'good', later)
    expect(saved).toMatchObject({ reps: 2, firstSeen: NOW, lastReviewed: later, interval: 3 })
    expect(await db.cardProgress.count()).toBe(1)
  })

  it('keeps the same word in different dictionaries apart', async () => {
    await reviewCard('custom:a', 'apple', 'easy', NOW)
    await reviewCard('custom:b', 'apple', 'again', NOW)
    expect((await db.cardProgress.get(['custom:a', 'apple']))?.state).toBe('review')
    expect((await db.cardProgress.get(['custom:b', 'apple']))?.state).toBe('learning')
  })
})

describe('getDictProgress', () => {
  it('returns only the rows of the given dictionary', async () => {
    await reviewCard('custom:a', 'apple', 'good', NOW)
    await reviewCard('custom:a', 'pear', 'good', NOW)
    await reviewCard('custom:b', 'plum', 'good', NOW)
    const rows = await getDictProgress('custom:a')
    expect(rows.map((r) => r.word).sort()).toEqual(['apple', 'pear'])
    expect(await getDictProgress('custom:none')).toEqual([])
  })
})

describe('reviewQuizAnswer', () => {
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
    firstSeen: NOW - 5 * 86400000,
    lastReviewed: NOW - 86400000,
    ...over,
  })

  it('a wrong answer on a never-studied word introduces it as a learning card', async () => {
    const saved = await reviewQuizAnswer(dict, 'apple', false, NOW)
    expect(saved).toMatchObject({ state: 'learning', reps: 1, firstSeen: NOW })
    expect(await db.cardProgress.count()).toBe(1)
  })

  it('a correct answer on a never-studied word writes nothing', async () => {
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toBeNull()
    expect(await db.cardProgress.count()).toBe(0)
  })

  it('a correct answer on a due card is graded good', async () => {
    await db.cardProgress.put(row())
    const saved = await reviewQuizAnswer(dict, 'apple', true, NOW)
    expect(saved).toMatchObject({ state: 'review', reps: 5, lapses: 0 })
    expect((await db.cardProgress.get([dict, 'apple']))?.reps).toBe(5)
  })

  it('a correct answer on a card that is not due yet changes nothing', async () => {
    const card = row({ due: NOW + 86400000 })
    await db.cardProgress.put(card)
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toBeNull()
    expect(await db.cardProgress.get([dict, 'apple'])).toEqual(card)
  })

  it('a wrong answer on a due card is graded again and counts a lapse', async () => {
    await db.cardProgress.put(row())
    expect(await reviewQuizAnswer(dict, 'apple', false, NOW)).toMatchObject({ state: 'learning', lapses: 1, reps: 5 })
  })

  it('decides from the row as it is now, not from a snapshot taken earlier (another tab may have changed it)', async () => {
    await db.cardProgress.put(row({ due: NOW + 86400000 }))
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toBeNull()
    // another tab studied the card in the meantime and it is due again
    await db.cardProgress.put(row({ due: NOW - 1 }))
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toMatchObject({ reps: 5 })
  })
})

describe('built-in dictionaries', () => {
  it('keep their own progress, keyed by the built-in id', async () => {
    await reviewCard('cet4', 'abandon', 'good', NOW)
    expect(await getDictProgress('cet4')).toHaveLength(1)
    expect((await getDictProgress('cet4'))[0]).toMatchObject({ dict: 'cet4', word: 'abandon', reps: 1 })
    expect(await getDictProgress('cet6')).toEqual([])
  })

  it('apply quiz answers like custom sets do', async () => {
    const wrong = await reviewQuizAnswer('cet4', 'abandon', false, NOW)
    expect(wrong).toMatchObject({ dict: 'cet4', word: 'abandon', state: 'learning' })
    const later = NOW + 5 * 86400000
    await reviewCard('cet4', 'ability', 'good', NOW)
    expect(await reviewQuizAnswer('cet4', 'ability', true, NOW + 1000)).toBeNull()
    expect((await reviewQuizAnswer('cet4', 'ability', true, later))?.reps).toBe(2)
  })
})

describe('review log', () => {
  it('records one entry for each graded flashcard', async () => {
    await reviewCard('d', 'a', 'good', NOW)
    await reviewCard('d', 'a', 'good', NOW + 1000)
    const rows = await db.reviewLog.toArray()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ at: NOW, dict: 'd', word: 'a', kind: 'flashcard' })
  })

  it('records a quiz answer only when it touches the schedule', async () => {
    expect(await reviewQuizAnswer('d', 'new', true, NOW)).toBeNull()
    expect(await db.reviewLog.count()).toBe(0)
    await reviewQuizAnswer('d', 'new', false, NOW)
    expect(await db.reviewLog.toArray()).toEqual([expect.objectContaining({ at: NOW, dict: 'd', word: 'new', kind: 'quiz' })])
  })

  it('leaves no entry behind when the card could not be saved', async () => {
    const original = db.cardProgress.put.bind(db.cardProgress)
    db.cardProgress.put = (() => Promise.reject(new Error('disk full'))) as typeof db.cardProgress.put
    try {
      await expect(reviewCard('d', 'a', 'good', NOW)).rejects.toThrow()
    } finally {
      db.cardProgress.put = original
    }
    expect(await db.reviewLog.count()).toBe(0)
    expect(await db.cardProgress.count()).toBe(0)
  })
})
