import type { QueueItem } from './queue'
import { answer, createSession, currentItem, flip } from './session'
import { describe, expect, it } from 'vitest'

const item = (name: string, kind: 'due' | 'new' = 'new'): QueueItem => ({ word: { name, trans: ['x'], usphone: '', ukphone: '' }, kind })

describe('study session', () => {
  it('starts on the first card, not flipped', () => {
    const s = createSession([item('a'), item('b')])
    expect(currentItem(s)?.word.name).toBe('a')
    expect(s).toMatchObject({ flipped: false, reviewed: 0, again: 0 })
  })

  it('flip shows the answer and is idempotent', () => {
    const s = flip(createSession([item('a')]))
    expect(s.flipped).toBe(true)
    expect(flip(s)).toEqual(s)
  })

  it('answer before the flip is ignored (no double count, no skipped card)', () => {
    const s = createSession([item('a'), item('b')])
    expect(answer(s, 'good')).toBe(s)
  })

  it('good moves to the next card, unflipped, and counts the review', () => {
    const s = answer(flip(createSession([item('a'), item('b')])), 'good')
    expect(currentItem(s)?.word.name).toBe('b')
    expect(s).toMatchObject({ flipped: false, reviewed: 1, again: 0 })
  })

  it('again puts the card back at the end of the queue and counts it', () => {
    const s = answer(flip(createSession([item('a'), item('b')])), 'again')
    expect(s.queue.map((i) => i.word.name)).toEqual(['b', 'a'])
    expect(s).toMatchObject({ reviewed: 1, again: 1, flipped: false })
  })

  it('finishes with an empty queue and ignores further input', () => {
    let s = flip(createSession([item('a')]))
    s = answer(s, 'easy')
    expect(currentItem(s)).toBeUndefined()
    expect(flip(s)).toBe(s)
    expect(answer(s, 'good')).toBe(s)
  })

  it('does not mutate the previous session', () => {
    const s = flip(createSession([item('a'), item('b')]))
    const before = JSON.stringify(s)
    answer(s, 'again')
    expect(JSON.stringify(s)).toBe(before)
  })
})
