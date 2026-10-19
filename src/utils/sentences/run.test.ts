import { buildRun, sanitizeHide, sanitizeSentenceLength } from './run'
import type { SentenceItem } from './types'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

const word: Word = { name: 'w', trans: ['x'], usphone: '', ukphone: '' }
const item = (text: string): SentenceItem => ({ word, text })
const pool = ['a', 'b', 'c', 'd', 'e'].map(item)

/** Deterministic RNG: a small linear congruential generator. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('buildRun', () => {
  it('returns the requested number of distinct items from the pool', () => {
    const big = Array.from({ length: 15 }, (_, i) => item(`s${i}`))
    const run = buildRun(big, 10, seeded(1))
    expect(run).toHaveLength(10)
    expect(new Set(run.map((entry) => entry.text)).size).toBe(10)
    run.forEach((entry) => expect(big).toContain(entry))
  })

  it("returns every item, as a permutation, for length 'all'", () => {
    const run = buildRun(pool, 'all', seeded(2))
    expect(run).toHaveLength(5)
    expect(run.map((entry) => entry.text).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('never repeats when the run is longer than the pool', () => {
    expect(buildRun(pool, 20, seeded(3))).toHaveLength(5)
  })

  it('returns an empty run for an empty pool', () => {
    expect(buildRun([], 10, seeded(4))).toEqual([])
  })

  it('does not mutate the pool', () => {
    const before = pool.map((entry) => entry.text)
    buildRun(pool, 'all', seeded(5))
    expect(pool.map((entry) => entry.text)).toEqual(before)
  })
})

describe('sanitizeSentenceLength', () => {
  it('sanitises the run length like the quiz length', () => {
    expect(sanitizeSentenceLength('20')).toBe(20)
    expect(sanitizeSentenceLength('all')).toBe('all')
    expect(sanitizeSentenceLength(7)).toBe(10)
    expect(sanitizeSentenceLength(undefined)).toBe(10)
  })
})

describe('sanitizeHide', () => {
  it('treats only the boolean true as hidden', () => {
    expect(sanitizeHide(true)).toBe(true)
    expect(sanitizeHide('true')).toBe(false)
    expect(sanitizeHide(1)).toBe(false)
    expect(sanitizeHide(undefined)).toBe(false)
  })
})
