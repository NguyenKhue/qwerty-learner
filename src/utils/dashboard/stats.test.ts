import { dashboardRefreshDelay, dashboardStats } from './stats'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { startOfLocalDay } from '@/utils/srs/time'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const TODAY = startOfLocalDay(NOW)
const word = (name: string, meaning = `n. meaning of ${name}`): Word => ({ name, trans: [meaning], usphone: '', ukphone: '' })
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
const stats = (words: Word[], progress: ICardProgress[] = [], newPerDay = 20) => dashboardStats({ words, progress, now: NOW, newPerDay })

describe('dashboardStats counts', () => {
  it('is all zero for an empty set', () => {
    expect(stats([])).toMatchObject({ due: 0, newToday: 0, seen: 0, total: 0 })
  })
  it('counts due, new, seen and total', () => {
    const words = ['a', 'b', 'c'].map((n) => word(n))
    const result = stats(words, [card('a', { due: NOW - 1000 }), card('b')])
    expect(result).toMatchObject({ due: 1, newToday: 1, seen: 2, total: 3 })
  })
  it('counts a duplicated word once', () => {
    expect(stats([word('a'), word('a'), word('b')])).toMatchObject({ total: 2, newToday: 2 })
  })
  it('ignores progress rows of words that are not in the set', () => {
    expect(stats([word('a')], [card('a'), card('gone', { due: NOW - 1 })])).toMatchObject({ due: 0, seen: 1, total: 1 })
  })
  it('caps new cards by the daily limit, minus those first seen today', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map((n) => word(n))
    expect(stats(words, [], 2).newToday).toBe(2)
    expect(stats(words, [card('a', { firstSeen: TODAY + 1000 })], 1).newToday).toBe(0)
  })
})

describe('dashboardStats mode states', () => {
  const distinct = (count: number) => Array.from({ length: count }, (_, i) => word(`w${i}`, `n. meaning ${i}`))
  it('enables Quiz from 4 distinct meanings and explains why not below', () => {
    expect(stats(distinct(4)).quiz).toEqual({ enabled: true, reason: null })
    expect(stats(distinct(3)).quiz).toEqual({ enabled: false, reason: 'Needs at least 4 words with different meanings' })
  })
  it('enables Match from 6 distinct meanings and explains why not below', () => {
    expect(stats(distinct(6)).match).toEqual({ enabled: true, reason: null })
    expect(stats(distinct(5)).match).toEqual({ enabled: false, reason: 'Needs at least 6 words with different meanings' })
  })
  it('does not count words that share a meaning or have none', () => {
    const words = [word('a', 'same'), word('b', 'same'), word('c', 'same'), word('d', 'same'), { ...word('e'), trans: [] }]
    expect(stats(words).quiz.enabled).toBe(false)
  })
})

describe('dashboardRefreshDelay', () => {
  it('waits for the next future due time, not for one that has already passed', () => {
    const words = [word('a'), word('b')]
    const past = card('a', { due: NOW - 5000 })
    const future = card('b', { due: NOW + 3 * 60 * 1000 })
    // a card due in 3 minutes: wake up just after it
    expect(dashboardRefreshDelay(words, [past, future], NOW)).toBe(3 * 60 * 1000 + 1000)
  })
  it('does not busy-loop when the only card is already due: it waits until local midnight', () => {
    const delay = dashboardRefreshDelay([word('a')], [card('a', { due: NOW - 5000 })], NOW)
    expect(delay).toBeGreaterThan(60 * 1000)
  })
})
