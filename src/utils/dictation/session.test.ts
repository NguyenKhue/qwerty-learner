import { toItems } from './items'
import type { DictationItem } from './items'
import { typeDictationKey } from './session'
import { advance, createSession, retryItems } from '@/utils/sentences/session'
import type { SentenceSession } from '@/utils/sentences/session'
import { describe, expect, it } from 'vitest'

const items = toItems([
  { start: 0, end: 2, en: 'Do it now.' },
  { start: 2, end: 4, en: 'Go home.' + ' Rest well.' },
])

const typeAll = (s: SentenceSession<DictationItem>, keys: string) =>
  Array.from(keys).reduce((cur, key, i) => typeDictationKey(cur, key, 100 + i), s)

describe('typeDictationKey', () => {
  it('accepts a capital letter for its lowercase character', () => {
    const s = typeDictationKey(createSession(items), 'D', 1)
    expect(s.turn.typed).toBe(1)
    expect(s.turn.wrong).toBe(0)
  })

  it('ignores a punctuation key: punctuation is not part of what is typed', () => {
    const s = createSession(items)
    expect(typeDictationKey(s, ',', 1)).toBe(s)
    expect(typeDictationKey(s, '.', 1)).toBe(s)
  })

  it('rejects a wrong key and counts it', () => {
    const s = typeDictationKey(createSession(items), 'x', 1)
    expect(s.turn.typed).toBe(0)
    expect(s.turn.wrong).toBe(1)
  })

  it('records a typed sentence and gives back the ones with mistakes to practise', () => {
    let s = typeAll(createSession(items), 'Do it now')
    s = advance(s)
    expect(s.results).toHaveLength(1)
    expect(s.results[0].item.en).toBe('Do it now.')
    s = typeAll(s, 'gx')
    s = typeAll(s, 'o home rest well')
    s = advance(s)
    expect(retryItems(s).map((i) => i.index)).toEqual([1])
  })
})
