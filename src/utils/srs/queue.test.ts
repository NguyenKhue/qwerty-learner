import { DEFAULT_NEW_PER_DAY, buildQueue, nextDueTime, queueCounts, sanitizeNewPerDay } from './queue'
import { startOfLocalDay } from './time'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const TODAY = startOfLocalDay(NOW)
const word = (name: string): Word => ({ name, trans: [`n. ${name}`], usphone: '', ukphone: '' })
const card = (name: string, over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: name,
  state: 'review',
  due: NOW + 1000,
  interval: 3,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: TODAY - 5 * 86400000,
  lastReviewed: TODAY - 1000,
  ...over,
})
const names = (items: { word: Word }[]) => items.map((i) => i.word.name)

describe('buildQueue', () => {
  it('puts due cards first (oldest due first), then new cards in set order; skips future cards', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map(word)
    const progress = [
      card('b', { due: NOW - 1000 }), // due, newer
      card('d', { due: NOW - 5000 }), // due, older
      card('a', { due: NOW + 60000 }), // future
    ]
    const queue = buildQueue({ words, progress, now: NOW, newPerDay: 20 })
    expect(queue.map((i) => [i.word.name, i.kind])).toEqual([
      ['d', 'due'],
      ['b', 'due'],
      ['c', 'new'],
      ['e', 'new'],
    ])
  })

  it('limits new cards to newPerDay minus the cards first seen today', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map(word)
    expect(names(buildQueue({ words, progress: [], now: NOW, newPerDay: 2 }))).toEqual(['a', 'b'])
    const introduced = [card('a', { firstSeen: TODAY + 1000, due: NOW + 99999 })]
    expect(names(buildQueue({ words, progress: introduced, now: NOW, newPerDay: 2 }))).toEqual(['b'])
    expect(names(buildQueue({ words, progress: introduced, now: NOW, newPerDay: 1 }))).toEqual([])
  })

  it('counts a card first seen exactly at local midnight as today, one second before as yesterday', () => {
    const words = ['a', 'b', 'c'].map(word)
    const atMidnight = [card('a', { firstSeen: TODAY, due: NOW + 99999 })]
    expect(names(buildQueue({ words, progress: atMidnight, now: NOW, newPerDay: 1 }))).toEqual([])
    const justBefore = [card('a', { firstSeen: TODAY - 1000, due: NOW + 99999 })]
    expect(names(buildQueue({ words, progress: justBefore, now: NOW, newPerDay: 1 }))).toEqual(['b'])
  })

  it('newPerDay 0 gives no new cards but still gives due cards', () => {
    const words = ['a', 'b'].map(word)
    const queue = buildQueue({ words, progress: [card('a', { due: NOW - 1 })], now: NOW, newPerDay: 0 })
    expect(queue.map((i) => [i.word.name, i.kind])).toEqual([['a', 'due']])
  })

  it('ignores progress rows of words that are no longer in the set, and treats added words as new', () => {
    const words = ['a', 'z'].map(word)
    const progress = [card('gone', { due: NOW - 1, firstSeen: TODAY + 1 }), card('a', { due: NOW + 99999 })]
    const queue = buildQueue({ words, progress, now: NOW, newPerDay: 1 })
    expect(queue.map((i) => [i.word.name, i.kind])).toEqual([['z', 'new']])
  })

  it('queues a word name that appears twice in the list only once', () => {
    const words = [word('a'), word('b'), word('a')]
    expect(names(buildQueue({ words, progress: [], now: NOW, newPerDay: 20 }))).toEqual(['a', 'b'])
  })

  it('returns an empty queue for an empty set', () => {
    expect(buildQueue({ words: [], progress: [], now: NOW, newPerDay: 20 })).toEqual([])
  })
})

describe('queueCounts', () => {
  it('counts due and new cards', () => {
    expect(
      queueCounts([
        { word: word('a'), kind: 'due' },
        { word: word('b'), kind: 'new' },
        { word: word('c'), kind: 'new' },
      ]),
    ).toEqual({ due: 1, new: 2 })
  })
})

describe('nextDueTime', () => {
  it('returns the earliest future due time among words in the set, ignoring orphans and due-now cards', () => {
    const words = ['a', 'b'].map(word)
    const progress = [
      card('a', { due: NOW + 5000 }),
      card('b', { due: NOW + 9000 }),
      card('gone', { due: NOW + 10 }),
      card('b', { due: NOW - 5 }),
    ]
    expect(nextDueTime(words, [progress[0], progress[2]], NOW)).toBe(NOW + 5000)
    expect(nextDueTime(words, [progress[3]], NOW)).toBeNull()
    expect(nextDueTime(words, [], NOW)).toBeNull()
  })
})

describe('sanitizeNewPerDay', () => {
  it('gives sane integers for any stored value', () => {
    expect(sanitizeNewPerDay(20)).toBe(20)
    expect(sanitizeNewPerDay(0)).toBe(0)
    expect(sanitizeNewPerDay(-5)).toBe(0)
    expect(sanitizeNewPerDay(3.7)).toBe(3)
    expect(sanitizeNewPerDay(9999)).toBe(500)
    expect(sanitizeNewPerDay('15')).toBe(15)
    expect(sanitizeNewPerDay('abc')).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay('')).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay(NaN)).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay(null)).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay(undefined)).toBe(DEFAULT_NEW_PER_DAY)
  })
})
