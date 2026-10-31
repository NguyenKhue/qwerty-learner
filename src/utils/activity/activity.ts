import { addLocalDays, startOfLocalDay } from '@/utils/srs/time'

export type ActivityBar = { start: number; reviews: number; typed: number }

export type ActivityPeriod = 'week' | 'month' | 'year'

export const ACTIVITY_PERIODS: ActivityPeriod[] = ['week', 'month', 'year']

const PERIOD_DAYS = { week: 7, month: 30 }
const YEAR_MONTHS = 12

/** Local midnight on the first of the month `months` calendar months after the month containing `ms`. */
function localMonthStart(ms: number, months: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth() + months, 1).getTime()
}

/** Where each bar of a period starts, oldest first, and the end of the last one. */
function barEdges(period: ActivityPeriod, now: number): { starts: number[]; end: number } {
  if (period === 'year') {
    const starts = Array.from({ length: YEAR_MONTHS }, (_, i) => localMonthStart(now, i - YEAR_MONTHS + 1))
    return { starts, end: localMonthStart(now, 1) }
  }
  const days = PERIOD_DAYS[period]
  const starts = Array.from({ length: days }, (_, i) => addLocalDays(now, i - days + 1))
  return { starts, end: addLocalDays(now, 1) }
}

/**
 * The bars of a period, oldest first and ending with the current one, with the number of reviews and typed words in each: one a local day
 * for the last 7 or 30 days, one a calendar month for the last 12 months.
 */
export function buildActivity(period: ActivityPeriod, input: { reviewTimes: number[]; typedTimes: number[]; now: number }): ActivityBar[] {
  const { starts, end } = barEdges(period, input.now)
  const bars: ActivityBar[] = starts.map((start) => ({ start, reviews: 0, typed: 0 }))
  const barAt = (time: number): ActivityBar | undefined => {
    if (!Number.isFinite(time) || time < starts[0] || time >= end) return undefined
    return bars.reduce((found, bar) => (time >= bar.start ? bar : found))
  }
  input.reviewTimes.forEach((time) => {
    const bar = barAt(time)
    if (bar) bar.reviews++
  })
  input.typedTimes.forEach((time) => {
    const bar = barAt(time)
    if (bar) bar.typed++
  })
  return bars
}

/**
 * Consecutive local days with activity, counted back from today. A day without activity yet does not break the streak while it is still
 * today: if today is empty the count starts from yesterday.
 */
export function computeStreak(activeTimes: number[], now: number): number {
  const today = startOfLocalDay(now)
  const active = new Set<number>()
  activeTimes.forEach((time) => {
    if (Number.isFinite(time)) active.add(startOfLocalDay(time))
  })
  let day = active.has(today) ? today : addLocalDays(today, -1)
  let streak = 0
  while (active.has(day)) {
    streak++
    day = addLocalDays(day, -1)
  }
  return streak
}
