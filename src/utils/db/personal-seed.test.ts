import { getCustomDict } from './custom-dict'
import { db } from './database'
import { migratePersonalSet } from './personal-seed'
import type { IWordRecord } from './record'
import type { Word } from '@/typings'
import { beforeEach, describe, expect, it } from 'vitest'

const BUILT_IN = 'myVocab'
const input = (words: Word[] = []) => ({ builtInId: BUILT_IN, customId: 'myvocab', name: 'My Vocabulary', description: 'Mine', words })
const word = (name: string, detail?: string): Word => ({
  name,
  trans: [`n. ${name}`],
  usphone: '',
  ukphone: '',
  ...(detail ? { detail } : {}),
})
const card = (dict: string, name: string, over: Record<string, unknown> = {}) => ({
  dict,
  word: name,
  state: 'review' as const,
  due: 1000,
  interval: 3,
  ease: 2.5,
  reps: 2,
  lapses: 0,
  firstSeen: 1,
  lastReviewed: 2,
  ...over,
})
const wordRecord = (dict: string) =>
  ({ word: 'w', timeStamp: 5, dict, chapter: 0, timing: [], wrongCount: 0, mistakes: {} } as unknown as IWordRecord)

beforeEach(async () => {
  await Promise.all([
    db.customDicts.clear(),
    db.cardProgress.clear(),
    db.wordRecords.clear(),
    db.chapterRecords.clear(),
    db.reviewRecords.clear(),
    db.reviewLog.clear(),
  ])
})

describe('migratePersonalSet', () => {
  it('creates the editable set with the words and details, under a fixed id', async () => {
    const result = await migratePersonalSet(input([word('strict', 'Long text'), word('plain')]))
    expect(result.created).toBe(true)
    const record = await getCustomDict('myvocab')
    expect(record).toMatchObject({ id: 'myvocab', name: 'My Vocabulary', description: 'Mine' })
    expect(record?.words.map((w) => w.name)).toEqual(['strict', 'plain'])
    expect(record?.words[0].detail).toBe('Long text')
  })

  it('moves the study progress to the new set and leaves nothing behind under the old id', async () => {
    await db.cardProgress.bulkPut([card(BUILT_IN, 'strict', { reps: 7 }), card(BUILT_IN, 'plain'), card('cet4', 'other')])
    const result = await migratePersonalSet(input([word('strict'), word('plain')]))
    expect(result.cards).toBe(2)
    expect(await db.cardProgress.where('dict').equals(BUILT_IN).count()).toBe(0)
    const moved = await db.cardProgress.get(['custom:myvocab', 'strict'])
    expect(moved).toMatchObject({ dict: 'custom:myvocab', word: 'strict', reps: 7 })
    expect(await db.cardProgress.get(['cet4', 'other'])).toBeDefined()
  })

  it('moves typing history, mistake reviews and the review log, and only those of this set', async () => {
    await db.wordRecords.bulkAdd([wordRecord(BUILT_IN), wordRecord(BUILT_IN), wordRecord('cet4')])
    await db.chapterRecords.add({
      dict: BUILT_IN,
      chapter: 0,
      timeStamp: 1,
      time: 1,
      correctCount: 1,
      wrongCount: 0,
      wordCount: 1,
      correctWordIndexes: [],
      wordNumber: 1,
      wordRecordIds: [],
    })
    await db.reviewRecords.add({ dict: BUILT_IN, createTime: 1, isFinished: false } as never)
    await db.reviewLog.add({ at: 1, dict: BUILT_IN, word: 'strict', kind: 'flashcard' })
    const result = await migratePersonalSet(input([word('strict')]))
    expect(result).toMatchObject({ typedWords: 2, chapters: 1, reviews: 1, log: 1 })
    expect(await db.wordRecords.where('dict').equals('custom:myvocab').count()).toBe(2)
    expect(await db.wordRecords.where('dict').equals('cet4').count()).toBe(1)
    expect(await db.chapterRecords.where('dict').equals('custom:myvocab').count()).toBe(1)
    expect(await db.reviewRecords.where('dict').equals('custom:myvocab').count()).toBe(1)
    expect(await db.reviewLog.where('dict').equals('custom:myvocab').count()).toBe(1)
    expect(await db.wordRecords.where('dict').equals(BUILT_IN).count()).toBe(0)
  })

  it("is safe to run again: it neither duplicates the set nor overwrites the user's edits", async () => {
    await migratePersonalSet(input([word('strict', 'Original')]))
    await db.customDicts.update('myvocab', { words: [word('strict', 'My own edit'), word('added')] })
    const again = await migratePersonalSet(input([word('strict', 'Original')]))
    expect(again.created).toBe(false)
    expect(await db.customDicts.count()).toBe(1)
    const record = await getCustomDict('myvocab')
    expect(record?.words.map((w) => w.detail ?? w.name)).toEqual(['My own edit', 'added'])
  })

  it('keeps the progress that already exists on the new set if a card is on both', async () => {
    await db.cardProgress.bulkPut([card(BUILT_IN, 'strict', { reps: 1 }), card('custom:myvocab', 'strict', { reps: 9 })])
    await migratePersonalSet(input([word('strict')]))
    expect((await db.cardProgress.get(['custom:myvocab', 'strict']))?.reps).toBe(9)
    expect(await db.cardProgress.where('dict').equals(BUILT_IN).count()).toBe(0)
  })

  it('works on an empty database (a fresh install)', async () => {
    const result = await migratePersonalSet(input([word('a')]))
    expect(result).toMatchObject({ created: true, cards: 0, typedWords: 0, chapters: 0, reviews: 0, log: 0 })
  })
})
