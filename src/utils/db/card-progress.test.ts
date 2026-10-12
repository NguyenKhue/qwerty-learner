import { getDictProgress, reviewCard } from './card-progress'
import { db } from './database'
import { beforeEach, describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()

beforeEach(async () => {
  await db.cardProgress.clear()
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
