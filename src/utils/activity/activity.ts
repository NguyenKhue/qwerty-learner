import { addLocalDays, startOfLocalDay } from '@/utils/srs/time'

export type DayActivity = { start: number; reviews: number; typed: number }

export const ACTIVITY_DAYS = 7

/** The last seven local days, oldest first and ending with today, with the number of reviews and typed words on each. */
export function buildWeek(input: { reviewTimes: number[]; typedTimes: number[]; now: number }): DayActivity[] {
  const week: DayActivity[] = []
  for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
    week.push({ start: addLocalDays(input.now, -i), reviews: 0, typed: 0 })
  }
  const first = week[0].start
  const end = addLocalDays(input.now, 1)
  const slot = (time: number): DayActivity | undefined => {
    if (!Number.isFinite(time) || time < first || time >= end) return undefined
    return week.filter((day, i) => time >= day.start && (i === week.length - 1 || time < week[i + 1].start))[0]
  }
  input.reviewTimes.forEach((time) => {
    const day = slot(time)
    if (day) day.reviews++
  })
  input.typedTimes.forEach((time) => {
    const day = slot(time)
    if (day) day.typed++
  })
  return week
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
