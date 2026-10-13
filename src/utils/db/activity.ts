import { db } from './database'
import type { DayActivity } from '@/utils/activity/activity'
import { buildWeek, computeStreak } from '@/utils/activity/activity'
import { addLocalDays } from '@/utils/srs/time'

/** How far back the streak can reach. */
export const STREAK_WINDOW_DAYS = 365

/** The last seven days of activity and the current streak, from card reviews and typed words. */
export async function loadActivity(now: number): Promise<{ week: DayActivity[]; streak: number }> {
  const from = addLocalDays(now, -STREAK_WINDOW_DAYS)
  const reviewTimes: number[] = []
  const typedTimes: number[] = []
  await db.reviewLog
    .where('at')
    .aboveOrEqual(from)
    .each((entry) => {
      reviewTimes.push(entry.at)
    })
  // Word records keep their time in epoch seconds
  await db.wordRecords
    .where('timeStamp')
    .aboveOrEqual(Math.floor(from / 1000))
    .each((record) => {
      typedTimes.push(record.timeStamp * 1000)
    })
  return { week: buildWeek({ reviewTimes, typedTimes, now }), streak: computeStreak(reviewTimes.concat(typedTimes), now) }
}
