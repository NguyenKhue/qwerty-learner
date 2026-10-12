import { GRADES, INITIAL_EASE, MAX_INTERVAL_DAYS, describeInterval, nextState, previewLabels } from './scheduler'
import type { Grade } from './scheduler'
import { MINUTE_MS } from './time'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const identity = { dict: 'd', word: 'w' }
const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const day = (n: number) => new Date(2026, 9, 12 + n).getTime()
const STEP = 10 * MINUTE_MS

const review = (over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: 'w',
  state: 'review',
  due: day(0),
  interval: 10,
  ease: 2.5,
  reps: 4,
  lapses: 1,
  firstSeen: 111,
  lastReviewed: 222,
  ...over,
})
const learning = (over: Partial<ICardProgress> = {}): ICardProgress => review({ state: 'learning', interval: 1, due: NOW, ...over })

describe('nextState — new card', () => {
  it('again: learning, due in 10 minutes, nothing graduated', () => {
    expect(nextState(undefined, identity, 'again', NOW)).toEqual({
      dict: 'd',
      word: 'w',
      state: 'learning',
      due: NOW + STEP,
      interval: 0,
      ease: INITIAL_EASE,
      reps: 1,
      lapses: 0,
      firstSeen: NOW,
      lastReviewed: NOW,
    })
  })

  it.each([
    ['hard', 1],
    ['good', 1],
    ['easy', 3],
  ] as [Grade, number][])('%s: review with interval %i day(s), due at the start of that day', (grade, interval) => {
    expect(nextState(undefined, identity, grade, NOW)).toEqual({
      dict: 'd',
      word: 'w',
      state: 'review',
      due: day(interval),
      interval,
      ease: INITIAL_EASE,
      reps: 1,
      lapses: 0,
      firstSeen: NOW,
      lastReviewed: NOW,
    })
  })
})

describe('nextState — review card', () => {
  it('again: lapse, ease -0.2, back to learning with interval 1', () => {
    const next = nextState(review(), identity, 'again', NOW)
    expect(next).toMatchObject({
      state: 'learning',
      due: NOW + STEP,
      interval: 1,
      ease: 2.3,
      lapses: 2,
      reps: 5,
      firstSeen: 111,
      lastReviewed: NOW,
    })
  })

  it('hard: interval x1.2, ease -0.15', () => {
    expect(nextState(review(), identity, 'hard', NOW)).toMatchObject({ state: 'review', interval: 12, ease: 2.35, due: day(12), lapses: 1 })
  })

  it('good: interval x ease, ease unchanged', () => {
    expect(nextState(review(), identity, 'good', NOW)).toMatchObject({ state: 'review', interval: 25, ease: 2.5, due: day(25), reps: 5 })
  })

  it('easy: interval x ease x 1.3, ease +0.15', () => {
    expect(nextState(review({ interval: 20 }), identity, 'easy', NOW)).toMatchObject({ interval: 65, ease: 2.65, due: day(65) })
  })

  it('never drops the ease below 1.3', () => {
    expect(nextState(review({ ease: 1.3 }), identity, 'again', NOW).ease).toBe(1.3)
    expect(nextState(review({ ease: 1.35 }), identity, 'hard', NOW).ease).toBe(1.3)
  })

  it('caps the interval at 365 days', () => {
    const next = nextState(review({ interval: 300 }), identity, 'good', NOW)
    expect(next.interval).toBe(MAX_INTERVAL_DAYS)
    expect(next.due).toBe(day(MAX_INTERVAL_DAYS))
  })

  it('never goes below one day', () => {
    expect(nextState(review({ interval: 1 }), identity, 'hard', NOW).interval).toBe(1)
  })

  it('treats a corrupt ease/interval as the defaults instead of propagating NaN', () => {
    const next = nextState(review({ ease: NaN, interval: NaN }), identity, 'good', NOW)
    expect(next.interval).toBe(3)
    expect(next.ease).toBe(INITIAL_EASE)
    expect(next.due).toBe(day(3))
  })

  it('does not mutate the card it was given', () => {
    const card = review()
    const copy = { ...card }
    nextState(card, identity, 'good', NOW)
    expect(card).toEqual(copy)
  })
})

describe('nextState — learning card', () => {
  it.each(['again', 'hard'] as Grade[])('%s: stays learning, due in 10 minutes, no lapse counted', (grade) => {
    expect(nextState(learning(), identity, grade, NOW)).toMatchObject({
      state: 'learning',
      due: NOW + STEP,
      interval: 1,
      lapses: 1,
      ease: 2.5,
    })
  })

  it('good graduates to review with interval 1', () => {
    expect(nextState(learning(), identity, 'good', NOW)).toMatchObject({ state: 'review', interval: 1, due: day(1), ease: 2.5 })
  })

  it('easy graduates to review with interval 3', () => {
    expect(nextState(learning(), identity, 'easy', NOW)).toMatchObject({ state: 'review', interval: 3, due: day(3), ease: 2.5 })
  })
})

describe('describeInterval / previewLabels', () => {
  it('describes minutes, days, months and years', () => {
    expect(describeInterval(NOW + STEP, NOW)).toBe('10m')
    expect(describeInterval(NOW + 20 * 1000, NOW)).toBe('1m')
    expect(describeInterval(day(1), NOW)).toBe('1d')
    expect(describeInterval(day(3), NOW)).toBe('3d')
    expect(describeInterval(day(60), NOW)).toBe('2mo')
    expect(describeInterval(day(365), NOW)).toBe('1y')
  })

  it('previews the next interval of every grade for a new card', () => {
    expect(previewLabels(undefined, identity, NOW)).toEqual({ again: '10m', hard: '1d', good: '1d', easy: '3d' })
  })

  it('GRADES lists the four grades in button order', () => {
    expect(GRADES).toEqual(['again', 'hard', 'good', 'easy'])
  })
})
