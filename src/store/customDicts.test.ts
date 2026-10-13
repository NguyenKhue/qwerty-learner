import {
  allDictionariesAtom,
  classifyDictId,
  customDictionariesAtom,
  customDictionariesLoadedAtom,
  dictionaryByIdAtom,
  isCustomDictPending,
  lookupDictionary,
  shouldResetDictId,
} from './customDicts'
import { seededPersonalSetsAtom } from './personal'
import { dictionaries } from '@/resources/dictionary'
import type { Dictionary } from '@/typings'
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

const custom: Dictionary = {
  id: 'custom:abc',
  name: 'Mine',
  description: '',
  category: 'My Sets',
  tags: ['Custom'],
  url: 'idb:abc',
  length: 3,
  language: 'en',
  languageCategory: 'en',
  chapterCount: 1,
}

describe('dictionary atoms', () => {
  it('merges custom sets (first) with built-ins and resolves ids', () => {
    const store = createStore()
    expect(store.get(allDictionariesAtom)).toHaveLength(dictionaries.length)
    store.set(customDictionariesAtom, [custom])
    const all = store.get(allDictionariesAtom)
    expect(all[0].id).toBe('custom:abc')
    expect(all).toHaveLength(dictionaries.length + 1)
    const byId = store.get(dictionaryByIdAtom)
    expect(byId['custom:abc']).toBe(custom)
    expect(byId.cet4.id).toBe('cet4')
  })

  it('starts with loaded = false', () => {
    expect(createStore().get(customDictionariesLoadedAtom)).toBe(false)
  })
})

describe('shouldResetDictId', () => {
  const byId = { cet4: dictionaries.find((d) => d.id === 'cet4') as Dictionary, 'custom:abc': custom }

  it('keeps known dictionaries', () => {
    expect(shouldResetDictId('cet4', false, byId)).toBe(false)
    expect(shouldResetDictId('custom:abc', true, byId)).toBe(false)
  })

  it('does not reset a custom id before the custom sets have loaded (reload case)', () => {
    expect(shouldResetDictId('custom:gone', false, { cet4: byId.cet4 })).toBe(false)
  })

  it('resets a custom id that is missing after loading (deleted set)', () => {
    expect(shouldResetDictId('custom:gone', true, { cet4: byId.cet4 })).toBe(true)
  })

  it('resets an unknown built-in id regardless of loading', () => {
    expect(shouldResetDictId('nope', false, byId)).toBe(true)
    expect(shouldResetDictId('nope', true, byId)).toBe(true)
  })
})

describe('isCustomDictPending', () => {
  it('is true only for a custom id before the custom sets have loaded', () => {
    expect(isCustomDictPending('custom:abc', false)).toBe(true)
    expect(isCustomDictPending('custom:abc', true)).toBe(false)
    expect(isCustomDictPending('cet4', false)).toBe(false)
  })
})

describe('lookupDictionary', () => {
  it('finds own entries only, never Object.prototype members', () => {
    const byId = { cet4: custom }
    expect(lookupDictionary(byId, 'cet4')).toBe(custom)
    expect(lookupDictionary(byId, 'constructor')).toBeUndefined()
    expect(lookupDictionary(byId, 'toString')).toBeUndefined()
    expect(lookupDictionary(byId, '__proto__')).toBeUndefined()
    expect(lookupDictionary(byId, 'missing')).toBeUndefined()
  })
})

describe('classifyDictId', () => {
  const byId = { cet4: dictionaries.find((d) => d.id === 'cet4') as Dictionary, 'custom:abc': custom }

  it('knows valid ids, pending custom ids and unknown ids', () => {
    expect(classifyDictId('cet4', false, byId)).toBe('valid')
    expect(classifyDictId('custom:abc', true, byId)).toBe('valid')
    expect(classifyDictId('custom:gone', false, byId)).toBe('pending')
    expect(classifyDictId('custom:gone', true, byId)).toBe('unknown')
    expect(classifyDictId('nope', true, byId)).toBe('unknown')
  })

  it('treats names of Object.prototype members as unknown', () => {
    expect(classifyDictId('constructor', true, byId)).toBe('unknown')
    expect(classifyDictId('toString', false, byId)).toBe('unknown')
    expect(shouldResetDictId('constructor', true, byId)).toBe(true)
  })
})

describe("built-in sets that were turned into the user's own sets", () => {
  it('are hidden from the lists but still resolve by id, so old links and the stored current set keep working', () => {
    const store = createStore()
    store.set(seededPersonalSetsAtom, ['myVocab'])
    expect(store.get(allDictionariesAtom).some((d) => d.id === 'myVocab')).toBe(false)
    expect(store.get(allDictionariesAtom)).toHaveLength(dictionaries.length - 1)
    expect(store.get(dictionaryByIdAtom).myVocab.id).toBe('myVocab')
  })

  it('show up normally until the move has happened', () => {
    const store = createStore()
    expect(store.get(allDictionariesAtom).some((d) => d.id === 'myVocab')).toBe(true)
  })
})
