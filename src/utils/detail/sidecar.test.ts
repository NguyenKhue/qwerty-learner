import { attachDetails } from './sidecar'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

const word = (name: string): Word => ({ name, trans: ['x'], usphone: '', ukphone: '' })

describe('attachDetails', () => {
  it('adds the detail of each word, matching names without regard to case', () => {
    const result = attachDetails([word('Strict'), word('enforce')], { strict: 'Long A', ENFORCE: 'Long B' })
    expect(result.map((w) => w.detail)).toEqual(['Long A', 'Long B'])
  })

  it('leaves words without an entry unchanged (the same object) and does not mutate the input', () => {
    const plain = word('plain')
    const withEntry = word('strict')
    const result = attachDetails([plain, withEntry], { strict: 'Long' })
    expect(result[0]).toBe(plain)
    expect(result[1]).not.toBe(withEntry)
    expect('detail' in withEntry).toBe(false)
  })

  it('keeps a detail the word already has, and ignores empty or non-string entries', () => {
    const own: Word = { ...word('a'), detail: 'Own' }
    const result = attachDetails([own, word('b'), word('c')], { a: 'Other', b: '', c: 5 as unknown as string })
    expect(result[0].detail).toBe('Own')
    expect(result[1].detail).toBeUndefined()
    expect(result[2].detail).toBeUndefined()
  })

  it('returns the words unchanged when there is no map', () => {
    const words = [word('a')]
    expect(attachDetails(words, undefined)).toBe(words)
    expect(attachDetails(words, {})).toBe(words)
  })

  it('does not trip over names that exist on Object.prototype', () => {
    const result = attachDetails([word('constructor'), word('toString')], { strict: 'x' })
    expect(result.map((w) => w.detail)).toEqual([undefined, undefined])
  })
})
