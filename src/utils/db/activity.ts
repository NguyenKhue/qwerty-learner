import { call } from '@/data/rpc'
import type { ActivityBar, ActivityPeriod } from '@/utils/activity/activity'
import { ACTIVITY_PERIODS, buildActivity, computeStreak } from '@/utils/activity/activity'
import { addLocalDays } from '@/utils/srs/time'

/** How far back the streak and the year of activity can reach. */
export const ACTIVITY_WINDOW_DAYS = 365

/** The bars of every activity period and the current streak, from card reviews and typed words. */
export async function loadActivity(now: number): Promise<{ bars: Record<ActivityPeriod, ActivityBar[]>; streak: number }> {
  const from = addLocalDays(now, -ACTIVITY_WINDOW_DAYS)
  const { reviewTimes, typedSeconds } = await call('activity.times', from)
  // Word records keep their time in epoch seconds
  const typedTimes = typedSeconds.map((seconds) => seconds * 1000)
  const input = { reviewTimes, typedTimes, now }
  const [week, month, year] = ACTIVITY_PERIODS.map((period) => buildActivity(period, input))
  return { bars: { week, month, year }, streak: computeStreak(reviewTimes.concat(typedTimes), now) }
}
