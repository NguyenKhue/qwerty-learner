import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'

export type WordStatus = 'new' | 'learning' | 'young' | 'mastered'
export type ProgressSummary = { total: number; new: number; learning: number; young: number; mastered: number }

/** A review card whose next interval is at least this long counts as mastered (the same line Anki calls "mature"). */
export const MASTERED_INTERVAL_DAYS = 21

/** Where a word stands, read from its card: no card is new, a lapsed card is back in learning. */
export function wordStatus(card: ICardProgress | undefined): WordStatus {
  if (!card) return 'new'
  if (card.state === 'learning') return 'learning'
  return Number.isFinite(card.interval) && card.interval >= MASTERED_INTERVAL_DAYS ? 'mastered' : 'young'
}

/** Counts every distinct word of the set once by status; cards of words that left the set are ignored. */
export function progressSummary(words: Word[], progress: ICardProgress[]): ProgressSummary {
  // Maps, not plain objects: a word called "constructor" or "__proto__" must not read an inherited property
  const cards = new Map<string, ICardProgress>()
  progress.forEach((card) => cards.set(card.word, card))
  const seen = new Set<string>()
  const summary: ProgressSummary = { total: 0, new: 0, learning: 0, young: 0, mastered: 0 }
  words.forEach((word) => {
    if (seen.has(word.name)) return
    seen.add(word.name)
    summary.total += 1
    summary[wordStatus(cards.get(word.name))] += 1
  })
  return summary
}
