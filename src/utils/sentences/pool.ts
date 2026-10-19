import type { SentenceItem } from './types'
import type { Word } from '@/typings'

/** The longest sentence a run will ask the learner to type. */
const MAX_SENTENCE_LENGTH = 200

/** Maps one character through the keyboard equivalences so curly data still accepts straight typing, and the reverse. */
export function normalizeTypedChar(ch: string): string {
  switch (ch) {
    case '’':
    case '‘':
      return "'"
    case '“':
    case '”':
      return '"'
    case '–':
    case '—':
      return '-'
    case '\u00a0':
      return ' '
    default:
      return ch
  }
}

/** Trims `text` and maps every character through `normalizeTypedChar`. */
export function normalizeSentence(text: string): string {
  return Array.from(text.trim(), normalizeTypedChar).join('')
}

/** A sentence is playable when, once normalised, it is non-empty, at most 200 characters and all printable ASCII. */
export function isPlayable(text: string): boolean {
  const normalized = normalizeSentence(text)
  if (normalized.length === 0 || normalized.length > MAX_SENTENCE_LENGTH) return false
  return /^[\x20-\x7e]+$/.test(normalized)
}

/** Flattens each word's examples in order, keeping the playable ones as normalised sentences. */
export function buildPool(words: Word[]): SentenceItem[] {
  const pool: SentenceItem[] = []
  for (const word of words) {
    for (const example of word.examples ?? []) {
      if (!isPlayable(example.text)) continue
      const item: SentenceItem = { word, text: normalizeSentence(example.text) }
      const trans = example.trans?.trim()
      if (trans) item.trans = trans
      pool.push(item)
    }
  }
  return pool
}

/** The pool as-is for copy mode, or only the sentences with a translation when the sentence is hidden. */
export function poolFor(pool: SentenceItem[], hide: boolean): SentenceItem[] {
  if (!hide) return pool
  return pool.filter((item) => Boolean(item.trans))
}
