import { createTurn, isDone, peek as peekTurn, pressKey } from './turn'
import type { Turn } from './turn'
import type { SentenceItem } from './types'

/** Anything a session can type: its `text` is the normalised sentence. */
export type Typable = { text: string }

/** What one finished sentence produced. `ms` is the typing time between the first key and the last. */
export type SentenceResult<T extends Typable = SentenceItem> = { item: T; typed: number; wrong: number; peeked: boolean; ms: number }

/** A run over a list of sentences. Immutable: every change returns a new object. */
export type SentenceSession<T extends Typable = SentenceItem> = { items: T[]; index: number; turn: Turn; results: SentenceResult<T>[] }

/** Starts a run over the given items (at least one). */
export function createSession<T extends Typable>(items: T[]): SentenceSession<T> {
  return { items, index: 0, turn: createTurn(items[0]?.text ?? ''), results: [] }
}

/** The sentence being typed, or undefined once the run is complete. */
export function currentItem<T extends Typable>(s: SentenceSession<T>): T | undefined {
  return s.items[s.index]
}

/** True once every item has been recorded. */
export function isComplete<T extends Typable>(s: SentenceSession<T>): boolean {
  return s.index >= s.items.length
}

/** Feeds one key to the current turn; the session is the same instance when nothing changed or the run is complete. */
export function typeKey<T extends Typable>(s: SentenceSession<T>, key: string, now: number): SentenceSession<T> {
  if (isComplete(s)) return s
  const turn = pressKey(s.turn, key, now)
  return turn === s.turn ? s : { ...s, turn }
}

/** Reveals the current sentence; the session is the same instance when nothing changed or the run is complete. */
export function peekSentence<T extends Typable>(s: SentenceSession<T>): SentenceSession<T> {
  if (isComplete(s)) return s
  const turn = peekTurn(s.turn)
  return turn === s.turn ? s : { ...s, turn }
}

/** Records the current sentence and moves on. Ignored until the current turn is done, so a double call is harmless. */
export function advance<T extends Typable>(s: SentenceSession<T>): SentenceSession<T> {
  if (isComplete(s) || !isDone(s.turn)) return s
  const item = currentItem(s) as T
  const result: SentenceResult<T> = {
    item,
    typed: s.turn.typed,
    wrong: s.turn.wrong,
    peeked: s.turn.peeked,
    ms: (s.turn.endedAt ?? 0) - (s.turn.startedAt ?? 0),
  }
  const index = s.index + 1
  const next = s.items[index]
  return { ...s, index, turn: createTurn(next ? next.text : ''), results: s.results.concat(result) }
}

/** The numbers shown on the result screen. */
export type SentenceSummary<T extends Typable = SentenceItem> = {
  completed: number
  typed: number
  wrong: number
  accuracy: number
  wpm: number
  ms: number
  missed: SentenceResult<T>[]
  missedMore: number
}

/** Mistakes of one result: wrong keys, plus one for a peek. */
function mistakesOf<T extends Typable>(result: SentenceResult<T>): number {
  return result.wrong + (result.peeked ? 1 : 0)
}

export function summarize<T extends Typable>(s: SentenceSession<T>): SentenceSummary<T> {
  const results = s.results
  const typed = results.reduce((sum, r) => sum + r.typed, 0)
  const wrong = results.reduce((sum, r) => sum + r.wrong, 0)
  const ms = results.reduce((sum, r) => sum + r.ms, 0)
  const keystrokes = typed + wrong
  const accuracy = keystrokes === 0 ? 1 : typed / keystrokes
  const wpm = ms === 0 ? 0 : typed / 5 / (ms / 60000)
  const ranked = results
    .map((result, order) => ({ result, mistakes: mistakesOf(result), order }))
    .filter((entry) => entry.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes || a.order - b.order)
    .map((entry) => entry.result)
  const missed = ranked.slice(0, 50)
  return { completed: results.length, typed, wrong, accuracy, wpm, ms, missed, missedMore: ranked.length - missed.length }
}

/** The items of every sentence that had a mistake, in run order. */
export function retryItems<T extends Typable>(s: SentenceSession<T>): T[] {
  return s.results.filter((result) => mistakesOf(result) > 0).map((result) => result.item)
}
