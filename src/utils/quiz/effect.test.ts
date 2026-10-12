import { srsEffect } from './effect'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const card = (over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: 'w',
  state: 'review',
  due: NOW - 1000,
  interval: 3,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: 1,
  lastReviewed: 2,
  ...over,
})

describe('srsEffect', () => {
  it('a wrong answer is always "again", even for a card that was never studied', () => {
    expect(srsEffect(false, undefined, NOW)).toBe('again')
    expect(srsEffect(false, card(), NOW)).toBe('again')
    expect(srsEffect(false, card({ due: NOW + 99999 }), NOW)).toBe('again')
  })

  it('a correct answer is "good" only when the card is due', () => {
    expect(srsEffect(true, card({ due: NOW - 1 }), NOW)).toBe('good')
    expect(srsEffect(true, card({ due: NOW }), NOW)).toBe('good')
  })

  it('a correct answer on a new or not-yet-due card writes nothing', () => {
    expect(srsEffect(true, undefined, NOW)).toBeNull()
    expect(srsEffect(true, card({ due: NOW + 1 }), NOW)).toBeNull()
  })

  it('a corrupt (non-numeric) due counts as due now', () => {
    expect(srsEffect(true, card({ due: NaN }), NOW)).toBe('good')
  })
})
