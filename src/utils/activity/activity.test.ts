import { buildActivity, computeStreak } from './activity'
import { addLocalDays, startOfLocalDay } from '@/utils/srs/time'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 14, 15, 30).getTime() // Wed 14 Oct 2026, 15:30 local
const TODAY = startOfLocalDay(NOW)
const at = (offset: number, hours: number, minutes = 0) => {
  const d = new Date(addLocalDays(NOW, offset))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours, minutes).getTime()
}

describe('buildActivity for the week', () => {
  it('returns seven local days, oldest first, ending today, all zero for no activity', () => {
    const week = buildActivity('week', { reviewTimes: [], typedTimes: [], now: NOW })
    expect(week).toHaveLength(7)
    expect(week[6].start).toBe(TODAY)
    expect(week[0].start).toBe(addLocalDays(NOW, -6))
    expect(week.every((d) => d.reviews === 0 && d.typed === 0)).toBe(true)
  })

  it('puts a review on the local day it happened: 23:59 and 00:01 are different days', () => {
    const week = buildActivity('week', { reviewTimes: [at(-1, 23, 59), at(0, 0, 1)], typedTimes: [], now: NOW })
    expect(week[5].reviews).toBe(1)
    expect(week[6].reviews).toBe(1)
  })

  it('counts reviews and typed words separately and sums several on one day', () => {
    const week = buildActivity('week', { reviewTimes: [at(-2, 9), at(-2, 10), at(-2, 22)], typedTimes: [at(-2, 11), at(0, 8)], now: NOW })
    expect(week[4]).toMatchObject({ reviews: 3, typed: 1 })
    expect(week[6]).toMatchObject({ reviews: 0, typed: 1 })
  })

  it('ignores anything older than the seven days or on a later day', () => {
    const week = buildActivity('week', { reviewTimes: [at(-7, 12), at(1, 12)], typedTimes: [at(-30, 12), at(2, 8)], now: NOW })
    expect(week.reduce((n, d) => n + d.reviews + d.typed, 0)).toBe(0)
  })

  it('steps across a daylight saving change without skipping or repeating a day', () => {
    const springForward = new Date(2026, 2, 8, 15, 0).getTime() // US DST starts 8 Mar 2026
    const week = buildActivity('week', { reviewTimes: [], typedTimes: [], now: springForward })
    const starts = week.map((d) => d.start)
    expect(new Set(starts).size).toBe(7)
    starts.forEach((s, i) => expect(s).toBe(addLocalDays(springForward, i - 6)))
  })
})

describe('buildActivity for the month', () => {
  it('returns 30 local days ending today', () => {
    const month = buildActivity('month', { reviewTimes: [], typedTimes: [], now: NOW })
    expect(month).toHaveLength(30)
    expect(month[29].start).toBe(TODAY)
    expect(month[0].start).toBe(addLocalDays(NOW, -29))
  })

  it('counts the 30th day back and ignores the 31st', () => {
    const month = buildActivity('month', { reviewTimes: [at(-29, 8)], typedTimes: [at(-30, 23, 59)], now: NOW })
    expect(month[0]).toMatchObject({ reviews: 1, typed: 0 })
    expect(month.reduce((n, d) => n + d.typed, 0)).toBe(0)
  })
})

describe('buildActivity for the year', () => {
  const month = (year: number, index: number) => new Date(year, index, 1).getTime()

  it('returns 12 calendar months ending with this one', () => {
    const year = buildActivity('year', { reviewTimes: [], typedTimes: [], now: NOW })
    expect(year.map((m) => m.start)).toEqual([...Array(12)].map((_, i) => month(2025, 10 + i)))
  })

  it('keeps every month when today is a day that shorter months do not have', () => {
    const year = buildActivity('year', { reviewTimes: [], typedTimes: [], now: new Date(2026, 2, 31, 12).getTime() })
    expect(year.map((m) => m.start)).toEqual([...Array(12)].map((_, i) => month(2025, 3 + i)))
  })

  it('puts a time in its local month: the last minute of a month and the first of the next are different bars', () => {
    const lastMinute = new Date(2026, 8, 30, 23, 59).getTime()
    const firstMinute = new Date(2026, 9, 1, 0, 1).getTime()
    const year = buildActivity('year', { reviewTimes: [lastMinute], typedTimes: [firstMinute], now: NOW })
    expect(year[10]).toMatchObject({ reviews: 1, typed: 0 })
    expect(year[11]).toMatchObject({ reviews: 0, typed: 1 })
  })

  it('ignores anything before the twelve months or after this month', () => {
    const before = new Date(2025, 9, 31, 12).getTime()
    const after = new Date(2026, 10, 1, 0, 1).getTime()
    const year = buildActivity('year', { reviewTimes: [before, after], typedTimes: [], now: NOW })
    expect(year.reduce((n, m) => n + m.reviews, 0)).toBe(0)
  })
})

describe('computeStreak', () => {
  const days = (...offsets: number[]) => offsets.map((o) => addLocalDays(NOW, o))

  it('is 0 without activity', () => {
    expect(computeStreak([], NOW)).toBe(0)
  })
  it('counts consecutive days ending today', () => {
    expect(computeStreak(days(0, -1, -2), NOW)).toBe(3)
  })
  it('keeps a streak alive when only today is still empty', () => {
    expect(computeStreak(days(-1, -2, -3), NOW)).toBe(3)
  })
  it('is 0 when neither today nor yesterday has activity', () => {
    expect(computeStreak(days(-2, -3), NOW)).toBe(0)
  })
  it('stops at the first gap', () => {
    expect(computeStreak(days(0, -1, -3, -4), NOW)).toBe(2)
  })
  it('does not mind duplicates, order, or times of day inside a day', () => {
    expect(computeStreak([at(-1, 23, 59), at(0, 0, 1), at(0, 14), at(-2, 6)], NOW)).toBe(3)
  })
  it('ignores days after today', () => {
    expect(computeStreak(days(1, 2), NOW)).toBe(0)
    expect(computeStreak(days(1, 0), NOW)).toBe(1)
  })
})
