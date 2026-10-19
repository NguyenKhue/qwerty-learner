import type { SentenceItem, SentenceLength, SentenceScope } from './types'
import { sanitizeQuizLength, shuffle } from '@/utils/quiz/questions'

/** The remembered run length, sanitised the same way as the quiz length. */
export const sanitizeSentenceLength = sanitizeQuizLength

/** The remembered scope; anything unknown is the default, the words due or new today. */
export function sanitizeScope(value: unknown): SentenceScope {
  return value === 'all' ? 'all' : 'due'
}

/** The sentences of the pool grouped by word, in the order the words first appear. */
function groupByWord(pool: SentenceItem[]): Map<string, SentenceItem[]> {
  const groups = new Map<string, SentenceItem[]>()
  pool.forEach((entry) => {
    const group = groups.get(entry.word.name)
    if (group) group.push(entry)
    else groups.set(entry.word.name, [entry])
  })
  return groups
}

/** How many distinct words have a sentence: all of the pool's words, or only the listed ones (`priority`). */
export function scopeWordCount(pool: SentenceItem[], priority?: string[]): number {
  const groups = groupByWord(pool)
  if (!priority) return groups.size
  return new Set(priority.filter((name) => groups.has(name))).size
}

/**
 * One random sentence for each word, in a random order, cut to `length` (`'all'` = every word) and returned shuffled. With `priority`
 * (a queue order, most urgent first) only those words are used and the cut keeps the first ones. Empty for an empty pool or list.
 */
export function buildRun(pool: SentenceItem[], length: SentenceLength, rng: () => number, priority?: string[]): SentenceItem[] {
  const groups = groupByWord(pool)
  const words = priority ? Array.from(new Set(priority)).filter((name) => groups.has(name)) : shuffle(Array.from(groups.keys()), rng)
  const count = length === 'all' ? words.length : Math.min(length, words.length)
  const chosen = words.slice(0, count).map((name) => {
    const group = groups.get(name) as SentenceItem[]
    return group[Math.floor(rng() * group.length)]
  })
  return shuffle(chosen, rng)
}
