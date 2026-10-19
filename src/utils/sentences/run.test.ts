import { buildRun, sanitizeScope, sanitizeSentenceLength, scopeWordCount } from './run'
import type { SentenceItem } from './types'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

const wordNamed = (name: string): Word => ({ name, trans: ['x'], usphone: '', ukphone: '' })
/** A sentence of the word `name`; the text tells sentences of one word apart. */
const item = (name: string, text = `${name} sentence`): SentenceItem => ({ word: wordNamed(name), text, target: { start: 0, end: 1 } })
const names = (run: SentenceItem[]) => run.map((entry) => entry.word.name)
const manyWords = (count: number) => Array.from({ length: count }, (_, i) => item(`w${i}`))

/** Deterministic RNG: a small linear congruential generator. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('buildRun', () => {
  const pool = [item('a', 'a 1'), item('a', 'a 2'), item('a', 'a 3'), item('b'), item('c', 'c 1'), item('c', 'c 2')]

  it('picks one sentence of each word, never two of the same word', () => {
    const run = buildRun(pool, 'all', seeded(1))
    expect(names(run).sort()).toEqual(['a', 'b', 'c'])
    run.forEach((entry) => expect(pool).toContain(entry))
  })

  it('cuts the run to the requested number of distinct words', () => {
    const run = buildRun(manyWords(15), 10, seeded(2))
    expect(run).toHaveLength(10)
    expect(new Set(names(run)).size).toBe(10)
  })

  it('uses every word when the run is longer than the number of words', () => {
    expect(buildRun(pool, 20, seeded(3))).toHaveLength(3)
  })

  it('takes the words in priority order, ignoring unknown names, repeats and words that are not listed', () => {
    const run = buildRun(manyWords(12), 10, seeded(4), ['w5', 'nope', 'w1', 'w5', 'w2'])
    expect(names(run).sort()).toEqual(['w1', 'w2', 'w5'])
  })

  it('cuts by priority, so the first listed words are the ones that stay', () => {
    const priority = Array.from({ length: 12 }, (_, i) => `w${11 - i}`)
    const run = buildRun(manyWords(12), 10, seeded(5), priority)
    expect(names(run).sort()).toEqual(priority.slice(0, 10).sort())
  })

  it('returns an empty run for an empty pool or an empty priority list', () => {
    expect(buildRun([], 10, seeded(6))).toEqual([])
    expect(buildRun(pool, 10, seeded(7), [])).toEqual([])
  })

  it('does not mutate the pool or the priority list', () => {
    const before = pool.map((entry) => entry.text)
    const priority = ['c', 'a']
    buildRun(pool, 'all', seeded(8), priority)
    expect(pool.map((entry) => entry.text)).toEqual(before)
    expect(priority).toEqual(['c', 'a'])
  })
})

describe('scopeWordCount', () => {
  const pool = [item('a', 'a 1'), item('a', 'a 2'), item('b'), item('c')]

  it('counts the distinct words that have a sentence', () => {
    expect(scopeWordCount(pool)).toBe(3)
    expect(scopeWordCount([])).toBe(0)
  })

  it('counts only the listed words that have a sentence', () => {
    expect(scopeWordCount(pool, ['a', 'zzz', 'a', 'c'])).toBe(2)
    expect(scopeWordCount(pool, [])).toBe(0)
  })
})

describe('sanitizeScope', () => {
  it("keeps 'all' and falls back to 'due' for anything else", () => {
    expect(sanitizeScope('all')).toBe('all')
    expect(sanitizeScope('due')).toBe('due')
    expect(sanitizeScope('x')).toBe('due')
    expect(sanitizeScope(undefined)).toBe('due')
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
