import type { SentenceItem, SentenceLength } from './types'
import { sanitizeQuizLength, shuffle } from '@/utils/quiz/questions'

/** The remembered run length, sanitised the same way as the quiz length. */
export const sanitizeSentenceLength = sanitizeQuizLength

/** A shuffled copy of the pool cut to `length` (`'all'` = everything). No repeats; empty for an empty pool. */
export function buildRun(pool: SentenceItem[], length: SentenceLength, rng: () => number): SentenceItem[] {
  const count = length === 'all' ? pool.length : Math.min(length, pool.length)
  return shuffle(pool, rng).slice(0, count)
}
