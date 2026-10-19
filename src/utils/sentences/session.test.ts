import { advance, createSession, currentItem, isComplete, peekSentence, retryItems, summarize, typeKey } from './session'
import type { SentenceResult, SentenceSession } from './session'
import { createTurn } from './turn'
import type { SentenceItem } from './types'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

const word: Word = { name: 'w', trans: ['x'], usphone: '', ukphone: '' }
const item = (text: string): SentenceItem => ({ word, text })

/** Presses every character of `text` through the session, one ms apart from `start`. */
function typeAll(session: SentenceSession, text: string, start: number): SentenceSession {
  return text.split('').reduce((current, key, i) => typeKey(current, key, start + i), session)
}

/** A finished session holding the given results, used to test the summary. */
function sessionWith(results: SentenceResult[]): SentenceSession {
  return { items: results.map((result) => result.item), index: results.length, turn: createTurn(''), results }
}

describe('session', () => {
  it('records a result and starts the next turn on advance', () => {
    const first = item('ab')
    const second = item('c')
    const typed = typeAll(createSession([first, second]), 'ab', 1000)
    expect(typed.results).toHaveLength(0)
    const next = advance(typed)
    expect(next.results).toHaveLength(1)
    expect(next.results[0]).toEqual({ item: first, typed: 2, wrong: 0, peeked: false, ms: 1 })
    expect(next.index).toBe(1)
    expect(currentItem(next)).toBe(second)
    expect(next.turn.expected).toBe('c')
  })

  it('ignores advance until the turn is done', () => {
    const session = createSession([item('ab'), item('c')])
    const partial = typeKey(session, 'a', 1000)
    expect(advance(partial)).toBe(partial)
  })

  it('does not skip an item or duplicate a result on a double advance', () => {
    const session = createSession([item('ab'), item('c')])
    const once = advance(typeAll(session, 'ab', 1000))
    const twice = advance(once)
    expect(twice).toBe(once)
    expect(twice.index).toBe(1)
    expect(twice.results).toHaveLength(1)
  })

  it('is complete after the last item and then ignores everything', () => {
    let session = createSession([item('ab'), item('c')])
    session = advance(typeAll(session, 'ab', 0))
    session = advance(typeAll(session, 'c', 100))
    expect(isComplete(session)).toBe(true)
    expect(typeKey(session, 'a', 1)).toBe(session)
    expect(peekSentence(session)).toBe(session)
    expect(advance(session)).toBe(session)
  })

  it('adds up typed keys, mistakes, time, accuracy and speed', () => {
    const summary = summarize(
      sessionWith([
        { item: item('a'), typed: 2, wrong: 1, peeked: false, ms: 6000 },
        { item: item('b'), typed: 3, wrong: 0, peeked: false, ms: 6000 },
      ]),
    )
    expect(summary.completed).toBe(2)
    expect(summary.typed).toBe(5)
    expect(summary.wrong).toBe(1)
    expect(summary.accuracy).toBe(5 / 6)
    expect(summary.ms).toBe(12000)
    expect(summary.wpm).toBe(5)
  })

  it('puts a peeked sentence with no wrong keys in the mistakes list', () => {
    const summary = summarize(sessionWith([{ item: item('a'), typed: 3, wrong: 0, peeked: true, ms: 1000 }]))
    expect(summary.missed).toHaveLength(1)
    expect(summary.missed[0].wrong).toBe(0)
    expect(summary.missed[0].peeked).toBe(true)
  })

  it('sorts mistakes worst first, caps the list at 50 and reports the rest', () => {
    const results: SentenceResult[] = []
    for (let i = 0; i < 52; i++) results.push({ item: item(`s${i}`), typed: 1, wrong: i === 0 ? 5 : 1, peeked: false, ms: 10 })
    const summary = summarize(sessionWith(results))
    expect(summary.missed).toHaveLength(50)
    expect(summary.missedMore).toBe(2)
    expect(summary.missed[0].wrong).toBe(5)
  })

  it('returns the items with mistakes in run order, and none when the run is clean', () => {
    const a = item('a')
    const b = item('b')
    const c = item('c')
    const results: SentenceResult[] = [
      { item: a, typed: 1, wrong: 1, peeked: false, ms: 10 },
      { item: b, typed: 1, wrong: 0, peeked: false, ms: 10 },
      { item: c, typed: 1, wrong: 0, peeked: true, ms: 10 },
    ]
    expect(retryItems(sessionWith(results))).toEqual([a, c])
    expect(retryItems(sessionWith([]))).toEqual([])
  })

  it('reports neutral accuracy and no speed for an empty run', () => {
    const summary = summarize(sessionWith([]))
    expect(summary.accuracy).toBe(1)
    expect(summary.wpm).toBe(0)
    expect(summary.ms).toBe(0)
    expect(summary.missed).toEqual([])
    expect(summary.missedMore).toBe(0)
  })
})
