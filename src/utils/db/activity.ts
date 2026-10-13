import { db } from './database'
import type { DayActivity } from '@/utils/activity/activity'
import { buildWeek, computeStreak } from '@/utils/activity/activity'
import { addLocalDays } from '@/utils/srs/time'

/** How far back the streak can reach. */
export const STREAK_WINDOW_DAYS = 365

const asNumbers = (keys: unknown[]): number[] => keys.filter((key): key is number => typeof key === 'number')

/** The last seven days of activity and the current streak, from card reviews and typed words. */
export async function loadActivity(now: number): Promise<{ week: DayActivity[]; streak: number }> {
  const from = addLocalDays(now, -STREAK_WINDOW_DAYS)
  // Only the indexed time is read, not the whole records (word records carry per-letter timing data)
  const reviewTimes = asNumbers(await db.reviewLog.where('at').aboveOrEqual(from).keys())
  // Word records keep their time in epoch seconds
  const typedTimes = asNumbers(
    await db.wordRecords
      .where('timeStamp')
      .aboveOrEqual(Math.floor(from / 1000))
      .keys(),
  ).map((seconds) => seconds * 1000)
  return { week: buildWeek({ reviewTimes, typedTimes, now }), streak: computeStreak(reviewTimes.concat(typedTimes), now) }
}
