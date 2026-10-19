import { attachExtras, fetchWordExtras, mergeExtras, sidecarUrlOf } from './sidecar'
import type { WordExtras } from './sidecar'
import type { Word } from '@/typings'
import { afterEach, describe, expect, it, vi } from 'vitest'

const word = (name: string): Word => ({ name, trans: ['x'], usphone: '', ukphone: '' })

const mockFetch = (body: unknown, ok = true) => {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('attachExtras', () => {
  it('adds the detail of each word, matching names without regard to case', () => {
    const result = attachExtras([word('Strict'), word('enforce')], {
      strict: { detail: 'Long A' },
      ENFORCE: { detail: 'Long B' },
    })
    expect(result.map((w) => w.detail)).toEqual(['Long A', 'Long B'])
  })

  it('leaves words without an entry unchanged (the same object) and does not mutate the input', () => {
    const plain = word('plain')
    const withEntry = word('strict')
    const result = attachExtras([plain, withEntry], { strict: { detail: 'Long' } })
    expect(result[0]).toBe(plain)
    expect(result[1]).not.toBe(withEntry)
    expect('detail' in withEntry).toBe(false)
  })

  it('keeps a detail the word already has, and ignores empty or non-string entries', () => {
    const own: Word = { ...word('a'), detail: 'Own' }
    const result = attachExtras([own, word('b'), word('c')], {
      a: { detail: 'Other' },
      b: { detail: '' },
      c: 5 as unknown as WordExtras,
    })
    expect(result[0].detail).toBe('Own')
    expect(result[1].detail).toBeUndefined()
    expect(result[2].detail).toBeUndefined()
  })

  it('returns the words unchanged when there is no map', () => {
    const words = [word('a')]
    expect(attachExtras(words, undefined)).toBe(words)
    expect(attachExtras(words, {})).toBe(words)
  })

  it('does not trip over names that exist on Object.prototype', () => {
    const result = attachExtras([word('constructor'), word('toString')], { strict: { detail: 'x' } })
    expect(result.map((w) => w.detail)).toEqual([undefined, undefined])
  })

  it('adds examples without adding a detail', () => {
    const result = attachExtras([word('Strict')], { strict: { examples: [{ text: 'Enforce A' }] } })
    expect(result[0].examples).toEqual([{ text: 'Enforce A' }])
    expect('detail' in result[0]).toBe(false)
  })

  it('keeps the examples a word already has while still receiving a missing detail', () => {
    const own: Word = { ...word('a'), examples: [{ text: 'Mine' }] }
    const result = attachExtras([own], { a: { detail: 'Long', examples: [{ text: 'Other' }] } })
    expect(result[0].detail).toBe('Long')
    expect(result[0].examples).toEqual([{ text: 'Mine' }])
  })

  it('adds both fields when the entry has both', () => {
    const result = attachExtras([word('A')], { a: { detail: 'Long', examples: [{ text: 'S', trans: 'T' }] } })
    expect(result[0]).toEqual({ ...word('A'), detail: 'Long', examples: [{ text: 'S', trans: 'T' }] })
  })

  it('ignores an entry with empty examples and no detail', () => {
    const plain = word('a')
    const result = attachExtras([plain], { a: { examples: [] } })
    expect(result[0]).toBe(plain)
  })
})

describe('fetchWordExtras', () => {
  it('reads a legacy string value as a detail', async () => {
    mockFetch({ Strict: 'Long A' })
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({ Strict: { detail: 'Long A' } })
  })

  it('reads an object value with normalized examples', async () => {
    mockFetch({ strict: { detail: 'Long', examples: [{ text: ' S ', trans: ' T ' }] } })
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({
      strict: { detail: 'Long', examples: [{ text: 'S', trans: 'T' }] },
    })
  })

  it('reads a mixed map of strings and objects', async () => {
    mockFetch({ A: 'one', b: { examples: [{ text: 'two' }] } })
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({
      A: { detail: 'one' },
      b: { examples: [{ text: 'two' }] },
    })
  })

  it('skips bad entries and entries with nothing in them', async () => {
    mockFetch({ a: null, b: 5, c: [], d: {}, e: { detail: '', examples: [] } })
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({})
  })

  it('returns an empty map when the response is not ok', async () => {
    mockFetch({ a: 'x' }, false)
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({})
  })

  it('returns an empty map when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({})
  })

  it('returns an empty map when the body is an array', async () => {
    mockFetch([{ a: 'x' }])
    expect(await fetchWordExtras('/dicts/x.json')).toEqual({})
  })
})

describe('sidecarUrlOf', () => {
  it('prefers extrasUrl and falls back to the legacy detailUrl', () => {
    expect(sidecarUrlOf({ extrasUrl: '/extras.json', detailUrl: '/detail.json' })).toBe('/extras.json')
    expect(sidecarUrlOf({ extrasUrl: '/extras.json' })).toBe('/extras.json')
    expect(sidecarUrlOf({ detailUrl: '/detail.json' })).toBe('/detail.json')
    expect(sidecarUrlOf({})).toBeUndefined()
  })
})

describe('mergeExtras', () => {
  it('adds the sentences a word does not have yet after its own, without duplicates', () => {
    const own: Word = { ...word('strict'), examples: [{ text: 'Mine.' }, { text: 'Shared.' }] }
    const [merged] = mergeExtras([own], {
      strict: {
        examples: [
          { text: 'Shared.', trans: 'x' },
          { text: 'New.', trans: 'y' },
        ],
      },
    })
    expect(merged.examples).toEqual([{ text: 'Mine.' }, { text: 'Shared.' }, { text: 'New.', trans: 'y' }])
  })

  it('fills a missing detail but never replaces an existing one', () => {
    const [a, b] = mergeExtras([word('a'), { ...word('b'), detail: 'Own' }], { a: { detail: 'Long' }, b: { detail: 'Other' } })
    expect(a.detail).toBe('Long')
    expect(b.detail).toBe('Own')
  })

  it('returns the very same word when nothing is added, and the same array for an empty map', () => {
    const own: Word = { ...word('strict'), examples: [{ text: 'Mine.' }] }
    const words = [own, word('plain')]
    const result = mergeExtras(words, { strict: { examples: [{ text: 'Mine.' }] } })
    expect(result[0]).toBe(own)
    expect(result[1]).toBe(words[1])
    expect(mergeExtras(words, {})).toBe(words)
    expect(mergeExtras(words, undefined)).toBe(words)
  })

  it('matches names without regard to case and does not mutate the input', () => {
    const plain = word('Strict')
    const [merged] = mergeExtras([plain], { STRICT: { examples: [{ text: 'New.' }] } })
    expect(merged.examples).toEqual([{ text: 'New.' }])
    expect(plain.examples).toBeUndefined()
  })

  it('replaces a sentence that has its translation glued to the text by the repaired version, and keeps unrelated ones', () => {
    const own: Word = {
      ...word('assure'),
      examples: [{ text: 'It assures a server. (Nó đảm bảo với máy chủ) — đây chính là câu bạn vừa đọc!' }, { text: 'Mine.' }],
    }
    const [merged] = mergeExtras([own], { assure: { examples: [{ text: 'It assures a server.', trans: 'Nó đảm bảo với máy chủ' }] } })
    expect(merged.examples).toEqual([{ text: 'Mine.' }, { text: 'It assures a server.', trans: 'Nó đảm bảo với máy chủ' }])
  })

  it('does not drop a sentence that merely starts like another one when it has its own translation', () => {
    const own: Word = { ...word('a'), examples: [{ text: 'Go. (not a translation)', trans: 'Đi' }] }
    const [merged] = mergeExtras([own], { a: { examples: [{ text: 'Go.' }] } })
    expect(merged.examples).toEqual([{ text: 'Go. (not a translation)', trans: 'Đi' }, { text: 'Go.' }])
  })
})
