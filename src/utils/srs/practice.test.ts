import { practiceWords } from './practice'
import { startOfLocalDay } from './time'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const TODAY = startOfLocalDay(NOW)
const word = (name: string): Word => ({ name, trans: [`n. ${name}`], usphone: '', ukphone: '' })
const card = (name: string, lastReviewed: number): ICardProgress => ({
  dict: 'd',
  word: name,
  state: 'review',
  due: NOW + 1000,
  interval: 3,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: TODAY - 5 * 86400000,
  lastReviewed,
})

const words = ['a', 'b', 'c', 'c', 'd'].map(word)
const progress = [card('a', TODAY), card('b', TODAY - 1), card('d', NOW), card('gone', NOW)]
const pick = (scope: 'today' | 'hard' | 'all', hard: string[] = []) =>
  practiceWords({ words, progress, hardToday: new Set(hard), now: NOW, scope }).map((w) => w.name)

describe('practiceWords', () => {
  it('today: the words of the set reviewed since local midnight, in set order', () => {
    expect(pick('today')).toEqual(['a', 'd'])
  })

  it('hard: only the words graded Again or Hard today that are still in the set', () => {
    expect(pick('hard', ['d', 'b', 'gone'])).toEqual(['b', 'd'])
  })

  it('all: every word of the set once', () => {
    expect(pick('all')).toEqual(['a', 'b', 'c', 'd'])
  })
})
