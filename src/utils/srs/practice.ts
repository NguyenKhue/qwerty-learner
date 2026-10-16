import { startOfLocalDay } from './time'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'

/** What a practice round goes through: the cards studied today, the ones graded Again or Hard today, or the whole set. */
export type PracticeScope = 'today' | 'hard' | 'all'

export const PRACTICE_SCOPES: PracticeScope[] = ['today', 'hard', 'all']

/** The words of a practice round, in set order and without duplicates. Practice never changes the schedule. */
export function practiceWords(input: {
  words: Word[]
  progress: ICardProgress[]
  hardToday: Set<string>
  now: number
  scope: PracticeScope
}): Word[] {
  const seen = new Set<string>()
  const unique: Word[] = []
  input.words.forEach((word) => {
    if (seen.has(word.name)) return
    seen.add(word.name)
    unique.push(word)
  })
  if (input.scope === 'all') return unique
  if (input.scope === 'hard') return unique.filter((word) => input.hardToday.has(word.name))
  const dayStart = startOfLocalDay(input.now)
  const studied = new Set(input.progress.filter((card) => card.lastReviewed >= dayStart).map((card) => card.word))
  return unique.filter((word) => studied.has(word.name))
}
