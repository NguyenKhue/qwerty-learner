import * as cardProgress from '../../../server/repo/cardProgress'
import * as wordRecords from '../../../server/repo/wordRecords'
import {
  CUSTOM_DICT_PREFIX,
  createCustomDict,
  customDictToDictionary,
  customEditPath,
  customIdOf,
  customViewPath,
  deleteCustomDict,
  duplicateCustomDict,
  getCustomDict,
  getCustomDictWords,
  isCustomDictId,
  listCustomDicts,
  updateCustomDict,
} from './custom-dict'
import type { ICardProgress, IWordRecord } from './record'
import { withTestServer } from '@/test/serverHarness'
import { describe, expect, it } from 'vitest'

const word = (name: string) => ({ name, trans: [`n. ${name}`], usphone: '', ukphone: '' })
const progress = (dict: string, w: string): ICardProgress => ({
  dict,
  word: w,
  state: 'review',
  due: 0,
  interval: 1,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: 0,
  lastReviewed: 0,
})
const typingRecord = (dict: string) =>
  ({ word: 'x', timeStamp: 1, dict, chapter: 0, timing: [], wrongCount: 0, mistakes: {} } as unknown as IWordRecord)

describe('custom dictionaries', () => {
  const server = withTestServer()

  it('creates, reads and lists sets; ids are unique and words are de-duplicated', async () => {
    const a = await createCustomDict({ name: ' Set A ', description: 'd', words: [word('x'), word('x'), word('y')] })
    // createdAt is the list order; make sure the second set gets a later timestamp
    await new Promise((resolve) => setTimeout(resolve, 5))
    const b = await createCustomDict({ name: 'Set B', words: [word('z')] })
    expect(a.id).not.toBe(b.id)
    expect(a.name).toBe('Set A')
    expect(a.words.map((w) => w.name)).toEqual(['x', 'y'])
    expect((await getCustomDict(a.id))?.words).toHaveLength(2)
    expect((await listCustomDicts()).map((r) => r.name)).toEqual(['Set A', 'Set B'])
    expect(b.description).toBe('')
  })

  it('updates a set and throws for an unknown id', async () => {
    const a = await createCustomDict({ name: 'A', words: [word('x')] })
    await updateCustomDict(a.id, { name: 'A2', description: 'new', words: [word('y'), word('z')] })
    const updated = await getCustomDict(a.id)
    expect(updated?.name).toBe('A2')
    expect(updated?.words.map((w) => w.name)).toEqual(['y', 'z'])
    expect(updated?.createdAt).toBe(a.createdAt)
    expect((updated?.updatedAt ?? 0) >= a.updatedAt).toBe(true)
    await expect(updateCustomDict('missing', { name: 'x', words: [] })).rejects.toThrow()
  })

  it('deleting a set removes only its own progress and typing records', async () => {
    const a = await createCustomDict({ name: 'A', words: [word('x')] })
    const b = await createCustomDict({ name: 'B', words: [word('x')] })
    const dictA = CUSTOM_DICT_PREFIX + a.id
    const dictB = CUSTOM_DICT_PREFIX + b.id
    cardProgress.put(server.db, progress(dictA, 'x'))
    cardProgress.put(server.db, progress(dictB, 'x'))
    wordRecords.insert(server.db, typingRecord(dictA))
    wordRecords.insert(server.db, typingRecord(dictB))
    wordRecords.insert(server.db, typingRecord('cet4'))
    const wordCount = (dict: string) =>
      server.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM word_records WHERE dict = ?', [dict])?.count ?? 0

    await deleteCustomDict(a.id)

    expect(await getCustomDict(a.id)).toBeUndefined()
    expect(cardProgress.byDict(server.db, dictA)).toHaveLength(0)
    expect(wordCount(dictA)).toBe(0)
    expect(cardProgress.byDict(server.db, dictB)).toHaveLength(1)
    expect(wordCount(dictB)).toBe(1)
    expect(wordCount('cet4')).toBe(1)
    expect(await getCustomDict(b.id)).toBeDefined()
  })

  it('getCustomDictWords returns the words and throws for an unknown id', async () => {
    const a = await createCustomDict({ name: 'A', words: [word('x')] })
    expect((await getCustomDictWords(a.id)).map((w) => w.name)).toEqual(['x'])
    await expect(getCustomDictWords('missing')).rejects.toThrow()
  })

  it('maps a record to a Dictionary', () => {
    const dict = customDictToDictionary({
      id: 'abc',
      name: 'My set',
      description: 'desc',
      words: Array.from({ length: 41 }, (_, i) => word(`w${i}`)),
      createdAt: 1,
      updatedAt: 2,
    })
    expect(dict).toEqual({
      id: 'custom:abc',
      name: 'My set',
      description: 'desc',
      category: 'My Sets',
      tags: ['Custom'],
      url: 'idb:abc',
      length: 41,
      language: 'en',
      languageCategory: 'en',
      chapterCount: 3,
    })
    expect(customIdOf(dict.id)).toBe('abc')
    expect(customIdOf('cet4')).toBe('cet4')
  })
})

describe('isCustomDictId', () => {
  it('recognises custom dictionary ids only', () => {
    expect(isCustomDictId('custom:abc')).toBe(true)
    expect(isCustomDictId('cet4')).toBe(false)
    expect(isCustomDictId('')).toBe(false)
  })
})

describe('duplicateCustomDict', () => {
  const server = withTestServer()

  it('copies a set under a new id and name, leaving the original untouched', async () => {
    const a = await createCustomDict({ name: 'A', description: 'd', words: [word('x'), word('y')] })
    const copy = await duplicateCustomDict(a.id)
    expect(copy.id).not.toBe(a.id)
    expect(copy.name).toBe('A (copy)')
    expect(copy.description).toBe('d')
    expect(copy.words).toEqual(a.words)
    copy.words[0].trans.push('changed')
    expect((await getCustomDict(a.id))?.words[0].trans).toEqual(['n. x'])
    await expect(duplicateCustomDict('missing')).rejects.toThrow()
  })
})

describe('customEditPath', () => {
  it('points a user-made set at its editor and gives nothing for a built-in set', () => {
    expect(customEditPath('custom:abc123')).toBe('/my-sets/abc123/edit')
    expect(customEditPath('cet4')).toBeNull()
    expect(customEditPath('myVocab')).toBeNull()
    expect(customEditPath('')).toBeNull()
  })

  it('does not build a path for a custom id with nothing after the prefix', () => {
    expect(customEditPath('custom:')).toBeNull()
    expect(customViewPath('custom:')).toBeNull()
  })

  it('points a user-made set at its detail page and a built-in set nowhere', () => {
    expect(customViewPath('custom:abc123')).toBe('/my-sets/abc123')
    expect(customViewPath('cet4')).toBeNull()
  })
})
