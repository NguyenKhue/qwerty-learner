import { createTurn, isDone, peek, pressKey, turnMistakes } from './turn'
import type { Turn } from './turn'
import { describe, expect, it } from 'vitest'

const EXPECTED = "Hi, it's ok."

/** Presses every character of `keys` in order, one ms apart from `start`. */
function typeAll(turn: Turn, keys: string, start: number): Turn {
  return keys.split('').reduce((current, key, i) => pressKey(current, key, start + i), turn)
}

describe('turn', () => {
  it('accepts correct keys and stamps startedAt with the first key time', () => {
    const turn = typeAll(createTurn(EXPECTED), 'Hi,', 1000)
    expect(turn.typed).toBe(3)
    expect(turn.startedAt).toBe(1000)
    expect(turn.wrong).toBe(0)
  })

  it('counts a wrong key, marks lastWrong and clears it on the next correct key', () => {
    const first = pressKey(createTurn(EXPECTED), 'x', 1000)
    expect(first.wrong).toBe(1)
    expect(first.lastWrong).toBe(true)
    expect(first.typed).toBe(0)
    const second = pressKey(first, 'H', 1001)
    expect(second.typed).toBe(1)
    expect(second.lastWrong).toBe(false)
    expect(second.wrong).toBe(1)
  })

  it('accepts a space as a key', () => {
    const turn = pressKey(createTurn(' '), ' ', 1000)
    expect(turn.typed).toBe(1)
    expect(isDone(turn)).toBe(true)
  })

  it('ignores keys that are not characters', () => {
    const turn = createTurn(EXPECTED)
    for (const key of ['Shift', 'Backspace', 'Enter', 'Tab', 'Dead', 'ArrowLeft', '']) {
      expect(pressKey(turn, key, 1000)).toBe(turn)
    }
  })

  it('accepts a curly quote where a straight quote is expected', () => {
    const turn = typeAll(createTurn(EXPECTED), 'Hi, it', 1000)
    const next = pressKey(turn, '’', 2000)
    expect(next.typed).toBe(7)
    expect(next.wrong).toBe(0)
  })

  it('rejects a straight quote for a dash but accepts an em dash', () => {
    const turn = createTurn('-')
    const wrong = pressKey(turn, "'", 1000)
    expect(wrong.wrong).toBe(1)
    expect(wrong.typed).toBe(0)
    const right = pressKey(turn, '—', 1001)
    expect(right.typed).toBe(1)
    expect(right.wrong).toBe(0)
    expect(isDone(right)).toBe(true)
  })

  it('stamps endedAt and is done when the last character is typed', () => {
    const turn = typeAll(createTurn(EXPECTED), EXPECTED, 1000)
    expect(isDone(turn)).toBe(true)
    expect(turn.endedAt).toBe(1000 + EXPECTED.length - 1)
  })

  it('ignores every key once the sentence is complete', () => {
    const turn = typeAll(createTurn(EXPECTED), EXPECTED, 1000)
    expect(pressKey(turn, 'a', 9000)).toBe(turn)
    expect(pressKey(turn, ' ', 9000)).toBe(turn)
  })

  it('marks a peek once and counts it as one mistake', () => {
    const wrong = pressKey(createTurn(EXPECTED), 'x', 1000)
    const peeked = peek(wrong)
    expect(peeked.peeked).toBe(true)
    expect(peek(peeked)).toBe(peeked)
    expect(turnMistakes(peeked)).toBe(wrong.wrong + 1)
  })

  it('stamps startedAt on a wrong key before any correct key', () => {
    const turn = pressKey(createTurn(EXPECTED), 'x', 5000)
    expect(turn.startedAt).toBe(5000)
  })
})
