import { MASTERED_INTERVAL_DAYS, progressSummary, wordStatus } from './status'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const word = (name: string): Word => ({ name, trans: ['x'], usphone: '', ukphone: '' })
const card = (name: string, patch: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: name,
  state: 'review',
  due: 0,
  interval: 1,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: 0,
  lastReviewed: 0,
  ...patch,
})

describe('wordStatus', () => {
  it('is new without a card', () => {
    expect(wordStatus(undefined)).toBe('new')
  })
  it('is learning while the card is in the learning state, even after a lapse', () => {
    expect(wordStatus(card('a', { state: 'learning', interval: 30 }))).toBe('learning')
  })
  it('is young for a review card under the mastered interval', () => {
    expect(wordStatus(card('a', { interval: MASTERED_INTERVAL_DAYS - 1 }))).toBe('young')
  })
  it('is mastered from exactly 21 days', () => {
    expect(MASTERED_INTERVAL_DAYS).toBe(21)
    expect(wordStatus(card('a', { interval: 21 }))).toBe('mastered')
  })
  it('treats a broken interval as young, never mastered', () => {
    expect(wordStatus(card('a', { interval: Number.NaN }))).toBe('young')
  })
})

describe('progressSummary', () => {
  it('is all zeros for an empty set', () => {
    expect(progressSummary([], [])).toEqual({ total: 0, new: 0, learning: 0, young: 0, mastered: 0 })
  })
  it('counts every word once by status', () => {
    const words = [word('a'), word('b'), word('c'), word('d'), word('e')]
    const progress = [card('a', { interval: 40 }), card('b', { interval: 3 }), card('c', { state: 'learning' })]
    expect(progressSummary(words, progress)).toEqual({ total: 5, new: 2, learning: 1, young: 1, mastered: 1 })
  })
  it('counts a repeated word name once', () => {
    expect(progressSummary([word('a'), word('a')], [card('a', { interval: 30 })])).toMatchObject({ total: 1, mastered: 1 })
  })
  it('ignores cards of words that are no longer in the set', () => {
    expect(progressSummary([word('a')], [card('gone', { interval: 30 })])).toEqual({ total: 1, new: 1, learning: 0, young: 0, mastered: 0 })
  })
  it('is not confused by words named like object properties', () => {
    expect(progressSummary([word('constructor'), word('__proto__'), word('toString')], [])).toMatchObject({ total: 3, new: 3 })
  })
  it('keeps the parts adding up to the total', () => {
    const s = progressSummary([word('a'), word('b')], [card('a', { state: 'learning' })])
    expect(s.new + s.learning + s.young + s.mastered).toBe(s.total)
  })
})
