import { normalizeTypedChar } from './pool'

/** The typing state of one sentence. Immutable: every change returns a new object. */
export type Turn = {
  expected: string
  typed: number
  wrong: number
  peeked: boolean
  lastWrong: boolean
  startedAt: number | null
  endedAt: number | null
}

/** A fresh turn for a sentence. `expected` is the sentence text, already normalised. */
export function createTurn(expected: string): Turn {
  return { expected, typed: 0, wrong: 0, peeked: false, lastWrong: false, startedAt: null, endedAt: null }
}

/** True once every character has been typed correctly. */
export function isDone(turn: Turn): boolean {
  return turn.typed === turn.expected.length
}

/** Presses one key (`KeyboardEvent.key`). Non-character keys and any key after the sentence is complete are ignored. */
export function pressKey(turn: Turn, key: string, now: number): Turn {
  if (isDone(turn)) return turn
  const ch = normalizeTypedChar(key)
  if (ch.length !== 1) return turn
  const expected = normalizeTypedChar(turn.expected[turn.typed])
  const startedAt = turn.startedAt ?? now
  if (ch === expected) {
    const typed = turn.typed + 1
    return { ...turn, typed, lastWrong: false, startedAt, endedAt: typed === turn.expected.length ? now : turn.endedAt }
  }
  return { ...turn, wrong: turn.wrong + 1, lastWrong: true, startedAt }
}

/** Reveals the sentence for the rest of the turn; ignored when already peeked or complete. */
export function peek(turn: Turn): Turn {
  if (turn.peeked || isDone(turn)) return turn
  return { ...turn, peeked: true }
}

/** Mistakes made this turn: wrong keys, plus one for a peek. */
export function turnMistakes(turn: Turn): number {
  return turn.wrong + (turn.peeked ? 1 : 0)
}
