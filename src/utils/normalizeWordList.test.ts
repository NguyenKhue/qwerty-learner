import { normalizeWordList } from './normalizeWordList'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

describe('normalizeWordList', () => {
  it('keeps a clean word as the very same object', () => {
    const clean: Word = { name: 'a', trans: ['x', 'y'], usphone: '', ukphone: '' }
    expect(normalizeWordList([clean])[0]).toBe(clean)
  })

  it('repairs the shapes found in the built-in data: null, a plain string, a missing field, null entries', () => {
    const raw = [
      { name: 'a', trans: null },
      { name: 'b', trans: 'một nghĩa' },
      { name: 'c' },
      { name: 'd', trans: [null, 'ok', 5] },
    ] as unknown as Word[]
    const result = normalizeWordList(raw)
    expect(result.map((w) => w.trans)).toEqual([[], ['một nghĩa'], [], ['ok']])
    expect(result.map((w) => w.name)).toEqual(['a', 'b', 'c', 'd'])
    expect(result[0].usphone).toBe('')
    expect(result[0].ukphone).toBe('')
  })

  it('drops entries that are not words and tolerates a non-array payload', () => {
    expect(normalizeWordList([null, 3, { trans: ['x'] }, { name: 'ok', trans: ['y'] }] as unknown as Word[]).map((w) => w.name)).toEqual([
      'ok',
    ])
    expect(normalizeWordList({ not: 'an array' } as unknown as Word[])).toEqual([])
  })
})

describe('normalizeWordList detail', () => {
  it('keeps a string detail and drops one that is not a string', () => {
    const [kept, dropped] = normalizeWordList([
      { name: 'a', trans: ['x'], usphone: '', ukphone: '', detail: 'Long text' },
      { name: 'b', trans: ['y'], usphone: '', ukphone: '', detail: 42 },
    ])
    expect(kept.detail).toBe('Long text')
    expect('detail' in dropped).toBe(false)
  })
})

describe('normalizeWordList examples', () => {
  it('keeps a valid examples array as the very same word object', () => {
    const word: Word = { name: 'a', trans: ['x'], usphone: '', ukphone: '', examples: [{ text: 'A', trans: 'B' }] }
    expect(normalizeWordList([word])[0]).toBe(word)
  })

  it('repairs or drops examples that are not an array of examples', () => {
    const raw = [
      { name: 'a', trans: ['x'], usphone: '', ukphone: '', examples: 'x' },
      { name: 'b', trans: ['y'], usphone: '', ukphone: '', examples: [1, { text: 2 }] },
      { name: 'c', trans: ['z'], usphone: '', ukphone: '', examples: [1, { text: ' ok ' }] },
    ] as unknown as Word[]
    const result = normalizeWordList(raw)
    expect('examples' in result[0]).toBe(false)
    expect('examples' in result[1]).toBe(false)
    expect(result[2].examples).toEqual([{ text: 'ok' }])
  })

  it('leaves a word without the key as the same object', () => {
    const word: Word = { name: 'a', trans: ['x'], usphone: '', ukphone: '' }
    expect(normalizeWordList([word])[0]).toBe(word)
  })
})
