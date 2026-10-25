import type { TimedWord } from './captions'
import { dictationText } from './normalize'
import type { DictationSentence } from './types'

const PAUSE_MS = 700
const MAX_WORDS = 25
const MIN_WORDS = 3
/** A word starting later than this after the first word of its sentence begins a new one, so no sentence passes 10 s. */
const MAX_SPAN_MS = 8500
/** How long the last word of a sentence is assumed to last. */
const LAST_WORD_MS = 1500
const MAX_SENTENCE_MS = 10000

const ABBREVIATIONS = new Set(['mr.', 'mrs.', 'ms.', 'dr.', 'st.', 'vs.', 'etc.', 'jr.', 'sr.', 'prof.', 'e.g.', 'i.e.'])

/** True when the word closes a sentence: it ends with . ? or ! and is not an abbreviation or initials such as U.S. */
function endsSentence(word: string): boolean {
  const w = word.toLowerCase().replace(/["')\]]+$/, '')
  if (!/[.?!]$/.test(w)) return false
  return !ABBREVIATIONS.has(w) && !/^([a-z]\.){2,}$/.test(w)
}

/**
 * Groups subtitle words into sentences to dictate. Punctuated subtitles are split where sentences end; unpunctuated ones at pauses
 * longer than 0.7 s. No sentence has more than 25 words or lasts more than 10 s. A sentence ends when the next one starts, at most
 * 1.5 s after its last word starts. Sentences under 3 words or that cannot be typed are left out. Times are in seconds.
 */
export function buildSentences(words: TimedWord[], totalMs: number): Omit<DictationSentence, 'vi' | 'viSource'>[] {
  const punctuated = words.some((w) => endsSentence(w.text))
  const groups: TimedWord[][] = []
  let current: TimedWord[] = []
  const close = () => {
    if (current.length > 0) groups.push(current)
    current = []
  }

  for (const word of words) {
    if (current.length > 0) {
      const last = current[current.length - 1]
      const paused = !punctuated && word.startMs - last.startMs > PAUSE_MS
      if (paused || current.length >= MAX_WORDS || word.startMs - current[0].startMs > MAX_SPAN_MS) close()
    }
    current.push(word)
    if (punctuated && endsSentence(word.text)) close()
  }
  close()

  const sentences: Omit<DictationSentence, 'vi' | 'viSource'>[] = []
  groups.forEach((group, i) => {
    const startMs = group[0].startMs
    const lastMs = group[group.length - 1].startMs
    const nextMs = i + 1 < groups.length ? groups[i + 1][0].startMs : Math.max(totalMs, lastMs + 1)
    const endMs = Math.min(nextMs, lastMs + LAST_WORD_MS, startMs + MAX_SENTENCE_MS)
    const en = group.map((w) => w.text).join(' ')
    const text = dictationText(en)
    if (text === null || text.split(' ').length < MIN_WORDS || endMs <= startMs) return
    sentences.push({ start: startMs / 1000, end: endMs / 1000, en })
  })
  return sentences
}
