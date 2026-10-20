import type { ICardProgress } from './record'
import { call } from '@/data/rpc'
import type { Grade } from '@/utils/srs/scheduler'
import { startOfLocalDay } from '@/utils/srs/time'

export async function getDictProgress(dict: string): Promise<ICardProgress[]> {
  return call('cards.byDict', dict)
}

/** Words of the set graded Again or Hard on a flashcard today. */
export async function getHardWordsToday(dict: string, now: number = Date.now()): Promise<Set<string>> {
  return new Set(await call('log.hardWordsSince', dict, startOfLocalDay(now)))
}

/** Grades one card on the server and returns the saved row. */
export async function reviewCard(dict: string, word: string, grade: Grade, now: number = Date.now()): Promise<ICardProgress> {
  return call('cards.review', dict, word, grade, now)
}

/** Records the effect of a quiz answer on the schedule. Returns the saved card, or null when nothing changes. */
export async function reviewQuizAnswer(
  dict: string,
  word: string,
  correct: boolean,
  now: number = Date.now(),
): Promise<ICardProgress | null> {
  return call('cards.reviewQuiz', dict, word, correct, now)
}
