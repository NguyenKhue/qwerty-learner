import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { PAIR_COUNT, canPlay } from '@/utils/match/board'
import { MIN_DISTINCT_MEANINGS, canQuiz } from '@/utils/quiz/questions'
import { buildQueue, nextDueTime, nextRefreshDelay, queueCounts } from '@/utils/srs/queue'

export type ModeState = { enabled: boolean; reason: string | null }
export type DashboardStats = { due: number; newToday: number; seen: number; total: number; quiz: ModeState; match: ModeState }

const needs = (count: number): string => `Needs at least ${count} words with different meanings`

export function dashboardStats(input: { words: Word[]; progress: ICardProgress[]; now: number; newPerDay: number }): DashboardStats {
  const names = new Set<string>()
  input.words.forEach((word) => names.add(word.name))
  const seenNames = new Set<string>()
  input.progress.forEach((card) => {
    if (names.has(card.word)) seenNames.add(card.word)
  })
  const counts = queueCounts(buildQueue(input))
  return {
    due: counts.due,
    newToday: counts.new,
    seen: seenNames.size,
    total: names.size,
    quiz: canQuiz(input.words) ? { enabled: true, reason: null } : { enabled: false, reason: needs(MIN_DISTINCT_MEANINGS) },
    match: canPlay(input.words) ? { enabled: true, reason: null } : { enabled: false, reason: needs(PAIR_COUNT) },
  }
}

/** How long until the dashboard's numbers can change by themselves: the next future due time or local midnight, computed from `now` so a past due time never causes a 1 second loop. */
export function dashboardRefreshDelay(words: Word[], progress: ICardProgress[], now: number): number {
  return nextRefreshDelay(now, nextDueTime(words, progress, now))
}
