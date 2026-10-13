import type { QueueItem } from './queue'
import { answer, createSession, currentItem, flip, toggleFlip } from './session'
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

describe('flipping back and forth before grading', () => {
  it('toggles between the two faces and remembers that the answer has been seen', () => {
    const start = createSession([item('a'), item('b')])
    expect(start).toMatchObject({ flipped: false, revealed: false })
    const back = toggleFlip(start)
    expect(back).toMatchObject({ flipped: true, revealed: true })
    const front = toggleFlip(back)
    expect(front).toMatchObject({ flipped: false, revealed: true })
    expect(toggleFlip(front)).toMatchObject({ flipped: true, revealed: true })
  })

  it('can be graded while the front is showing again, once the answer has been seen', () => {
    const s = answer(toggleFlip(toggleFlip(createSession([item('a'), item('b')]))), 'good')
    expect(currentItem(s)?.word.name).toBe('b')
    expect(s).toMatchObject({ reviewed: 1, flipped: false, revealed: false })
  })

  it('cannot be graded before the answer has been seen', () => {
    const start = createSession([item('a')])
    expect(answer(start, 'good')).toBe(start)
  })

  it('starts the next card on its front with the answer unseen, also after Again', () => {
    const s = answer(toggleFlip(createSession([item('a'), item('b')])), 'again')
    expect(s).toMatchObject({ flipped: false, revealed: false, again: 1 })
    expect(s.queue.map((i) => i.word.name)).toEqual(['b', 'a'])
  })

  it('does nothing on an empty queue, and flip stays one-way and marks the answer as seen', () => {
    const empty = createSession([])
    expect(toggleFlip(empty)).toBe(empty)
    expect(flip(createSession([item('a')]))).toMatchObject({ flipped: true, revealed: true })
  })
})
