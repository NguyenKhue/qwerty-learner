import * as cardProgress from '../../../server/repo/cardProgress'
import * as reviewLog from '../../../server/repo/reviewLog'
import { getDictProgress, getHardWordsToday, reviewCard, reviewQuizAnswer } from './card-progress'
import type { ICardProgress } from './record'
import { withTestServer } from '@/test/serverHarness'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()

describe('reviewCard', () => {
  const server = withTestServer()

  it('creates a row for a new card and returns it', async () => {
    const saved = await reviewCard('custom:a', 'apple', 'good', NOW)
    expect(saved).toMatchObject({ dict: 'custom:a', word: 'apple', state: 'review', interval: 1, reps: 1, firstSeen: NOW })
    expect(cardProgress.get(server.db, 'custom:a', 'apple')).toEqual(saved)
  })

  it('updates the same row on the next review and keeps firstSeen', async () => {
    await reviewCard('custom:a', 'apple', 'good', NOW)
    const later = NOW + 3 * 86400000
    const saved = await reviewCard('custom:a', 'apple', 'good', later)
    expect(saved).toMatchObject({ reps: 2, firstSeen: NOW, lastReviewed: later, interval: 3 })
    expect(cardProgress.byDict(server.db, 'custom:a')).toHaveLength(1)
  })

  it('keeps the same word in different dictionaries apart', async () => {
    await reviewCard('custom:a', 'apple', 'easy', NOW)
    await reviewCard('custom:b', 'apple', 'again', NOW)
    expect(cardProgress.get(server.db, 'custom:a', 'apple')?.state).toBe('review')
    expect(cardProgress.get(server.db, 'custom:b', 'apple')?.state).toBe('learning')
  })
})

describe('getDictProgress', () => {
  withTestServer()

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
  const server = withTestServer()
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
    expect(cardProgress.byDict(server.db, dict)).toHaveLength(1)
  })

  it('a correct answer on a never-studied word writes nothing', async () => {
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toBeNull()
    expect(cardProgress.byDict(server.db, dict)).toHaveLength(0)
  })

  it('a correct answer on a due card is graded good', async () => {
    cardProgress.put(server.db, row())
    const saved = await reviewQuizAnswer(dict, 'apple', true, NOW)
    expect(saved).toMatchObject({ state: 'review', reps: 5, lapses: 0 })
    expect(cardProgress.get(server.db, dict, 'apple')?.reps).toBe(5)
  })

  it('a correct answer on a card that is not due yet changes nothing', async () => {
    const card = row({ due: NOW + 86400000 })
    cardProgress.put(server.db, card)
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toBeNull()
    expect(cardProgress.get(server.db, dict, 'apple')).toEqual(card)
  })

  it('a wrong answer on a due card is graded again and counts a lapse', async () => {
    cardProgress.put(server.db, row())
    expect(await reviewQuizAnswer(dict, 'apple', false, NOW)).toMatchObject({ state: 'learning', lapses: 1, reps: 5 })
  })

  it('decides from the row as it is now, not from a snapshot taken earlier (another tab may have changed it)', async () => {
    cardProgress.put(server.db, row({ due: NOW + 86400000 }))
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toBeNull()
    // another tab studied the card in the meantime and it is due again
    cardProgress.put(server.db, row({ due: NOW - 1 }))
    expect(await reviewQuizAnswer(dict, 'apple', true, NOW)).toMatchObject({ reps: 5 })
  })
})

describe('built-in dictionaries', () => {
  withTestServer()

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
  const server = withTestServer()

  it('records one entry for each graded flashcard', async () => {
    await reviewCard('d', 'a', 'good', NOW)
    await reviewCard('d', 'a', 'good', NOW + 1000)
    const rows = reviewLog.since(server.db, 0)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ at: NOW, dict: 'd', word: 'a', kind: 'flashcard' })
  })

  it('records a quiz answer only when it touches the schedule', async () => {
    expect(await reviewQuizAnswer('d', 'new', true, NOW)).toBeNull()
    expect(reviewLog.since(server.db, 0)).toHaveLength(0)
    await reviewQuizAnswer('d', 'new', false, NOW)
    expect(reviewLog.since(server.db, 0)).toEqual([expect.objectContaining({ at: NOW, dict: 'd', word: 'new', kind: 'quiz' })])
  })

  it('leaves no entry behind when the card could not be saved', async () => {
    server.db.exec("CREATE TRIGGER fail_log BEFORE INSERT ON review_log BEGIN SELECT RAISE(ABORT, 'refused'); END")
    try {
      await expect(reviewCard('d', 'a', 'good', NOW)).rejects.toThrow()
    } finally {
      server.db.exec('DROP TRIGGER fail_log')
    }
    expect(reviewLog.since(server.db, 0)).toHaveLength(0)
    expect(cardProgress.byDict(server.db, 'd')).toHaveLength(0)
  })
})

describe('getHardWordsToday', () => {
  const server = withTestServer()

  it('returns the words of the set graded Again or Hard today', async () => {
    await reviewCard('d', 'again', 'again', NOW)
    await reviewCard('d', 'hard', 'hard', NOW)
    await reviewCard('d', 'good', 'good', NOW)
    await reviewCard('other', 'elsewhere', 'again', NOW)
    await reviewCard('d', 'yesterday', 'again', NOW - 86400000)
    // An entry from before grades were kept
    reviewLog.insert(server.db, { at: NOW, dict: 'd', word: 'old', kind: 'flashcard' })
    expect(Array.from(await getHardWordsToday('d', NOW)).sort()).toEqual(['again', 'hard'])
  })
})
