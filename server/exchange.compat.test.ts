import { type Db, openDb } from './adapter'
import { importDexieJson } from './exchange'
import * as cardProgress from './repo/cardProgress'
import * as chapterRecords from './repo/chapterRecords'
import * as customDicts from './repo/customDicts'
import * as reviewLog from './repo/reviewLog'
import * as reviewRecords from './repo/reviewRecords'
import * as wordRecords from './repo/wordRecords'
import { ensureSchema } from './schema'
import type { Word } from '@/typings'
import { db as legacy } from '@/utils/db/database'
import type { IChapterRecord, IReviewLogEntry, IWordRecord } from '@/utils/db/record'
import { exportDB } from 'dexie-export-import'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const apple: Word = { name: 'apple', trans: ['苹果'], usphone: 'ˈæpl', ukphone: 'ˈæpl' }

/** The app's own data, written through the legacy Dexie database. */
async function populateLegacy(): Promise<void> {
  await legacy.wordRecords.bulkAdd([
    {
      id: 7,
      word: 'apple',
      timeStamp: 1000,
      dict: 'd',
      chapter: 0,
      timing: [5, 6],
      wrongCount: 1,
      mistakes: { 1: ['x'] },
    } as IWordRecord & { id: number },
    { id: 9, word: 'pear', timeStamp: 2000, dict: 'd', chapter: null, timing: [7], wrongCount: 0, mistakes: {} } as IWordRecord & {
      id: number
    },
  ])
  await legacy.chapterRecords.add({
    id: 21,
    dict: 'd',
    chapter: 0,
    timeStamp: 3000,
    time: 30,
    correctCount: 20,
    wrongCount: 1,
    wordCount: 7,
    correctWordIndexes: [0, 1],
    wordNumber: 7,
    wordRecordIds: [7, 9],
  } as IChapterRecord & { id: number })
  await legacy.reviewRecords.add({ id: 41, dict: 'd', index: 2, createTime: 5000, isFinished: false, words: [apple] })
  await legacy.customDicts.add({
    id: 'set1',
    name: 'Mine',
    description: 'a custom set',
    words: [apple],
    createdAt: 6000,
    updatedAt: 7000,
  })
  await legacy.cardProgress.put({
    dict: 'd',
    word: 'apple',
    state: 'review',
    due: 8000,
    interval: 2,
    ease: 2.5,
    reps: 3,
    lapses: 1,
    firstSeen: 1000,
    lastReviewed: 8000,
  })
  await legacy.reviewLog.add({ id: 31, at: 9000, dict: 'd', word: 'apple', kind: 'flashcard', grade: 'good' } as IReviewLogEntry & {
    id: number
  })
}

let target: Db | null = null

beforeEach(async () => {
  await Promise.all([
    legacy.wordRecords.clear(),
    legacy.chapterRecords.clear(),
    legacy.reviewRecords.clear(),
    legacy.customDicts.clear(),
    legacy.cardProgress.clear(),
    legacy.reviewLog.clear(),
  ])
})

afterEach(() => {
  target?.close()
  target = null
})

describe('the real legacy export', () => {
  it('imports from the app format with counts, ids and rows intact', async () => {
    await populateLegacy()

    const blob = await exportDB(legacy)
    // jsdom's Blob has no text(), so the file reader does the same job
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
    const bytes = new Uint8Array(gzipSync(text))

    const db = openDb(':memory:')
    target = db
    ensureSchema(db)
    const result = importDexieJson(db, bytes, () => undefined)

    expect(result.counts).toEqual({ wordRecords: 2, chapterRecords: 1, reviewRecords: 1, customDicts: 1, cardProgress: 1, reviewLog: 1 })
    expect(result.warnings).toEqual([])

    const words = wordRecords.between(db, 0, 10_000)
    expect(words.map((row) => row.id)).toEqual([7, 9])
    expect(words[0].mistakes).toEqual({ 1: ['x'] })
    expect(words[0].timing).toEqual([5, 6])
    expect(words[1].chapter).toBe(null)

    const chapters = chapterRecords.byDict(db, 'd')
    expect(chapters.map((row) => row.id)).toEqual([21])
    expect(chapters[0].wordRecordIds).toEqual([7, 9])
    expect(chapters[0].wordCount).toBe(7)

    const review = reviewRecords.latestUnfinished(db, 'd')
    expect(review?.id).toBe(41)
    expect(review?.words).toEqual([apple])

    expect(customDicts.get(db, 'set1')).toEqual({
      id: 'set1',
      name: 'Mine',
      description: 'a custom set',
      words: [apple],
      createdAt: 6000,
      updatedAt: 7000,
    })

    const card = cardProgress.get(db, 'd', 'apple')
    expect(card?.reps).toBe(3)
    expect(card?.lastReviewed).toBe(8000)

    const entries = reviewLog.since(db, 0)
    expect(entries.map((row) => row.id)).toEqual([31])
    expect(entries[0].grade).toBe('good')

    const next = { word: 'next', timeStamp: 10_000, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} }
    expect(wordRecords.insert(db, next)).toBe(10)
  })
})
