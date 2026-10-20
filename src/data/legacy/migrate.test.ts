import { call } from '../rpc'
import { deleteLegacyCopy, detectLegacy, runMigration } from './index'
import { MigrationMismatch } from './migrate'
import { withTestServer } from '@/test/serverHarness'
import { db as legacy } from '@/utils/db/database'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const COUNTS = { wordRecords: 2, chapterRecords: 1, reviewRecords: 1, customDicts: 1, cardProgress: 1, reviewLog: 1 }

async function populate(): Promise<void> {
  await legacy.open()
  await legacy.wordRecords.bulkAdd([
    { id: 7, word: 'apple', timeStamp: 100, dict: 'd', chapter: 0, timing: [1, 2], wrongCount: 1, mistakes: { 1: ['x'] } },
    { id: 9, word: 'pear', timeStamp: 200, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} },
  ] as never[])
  await legacy.chapterRecords.add({
    id: 3,
    dict: 'd',
    chapter: 0,
    timeStamp: 1,
    time: 5,
    correctCount: 3,
    wrongCount: 0,
    wordCount: 2,
    correctWordIndexes: [0],
    wordNumber: 2,
    wordRecordIds: [7, 9],
  } as never)
  await legacy.reviewRecords.add({ id: 2, dict: 'd', index: 1, createTime: 3, isFinished: false, words: [] } as never)
  await legacy.customDicts.add({
    id: 'abc',
    name: 'Mine',
    description: '',
    words: [{ name: 'x', trans: ['n. x'], usphone: '', ukphone: '' }],
    createdAt: 1,
    updatedAt: 2,
  })
  await legacy.cardProgress.add({
    dict: 'custom:abc',
    word: 'x',
    state: 'review',
    due: 5,
    interval: 2,
    ease: 2.5,
    reps: 3,
    lapses: 0,
    firstSeen: 1,
    lastReviewed: 2,
  })
  await legacy.reviewLog.add({ id: 4, at: 9, dict: 'd', word: 'apple', kind: 'flashcard', grade: 'good' } as never)
}

async function legacyCounts() {
  return {
    wordRecords: await legacy.wordRecords.count(),
    chapterRecords: await legacy.chapterRecords.count(),
    reviewRecords: await legacy.reviewRecords.count(),
    customDicts: await legacy.customDicts.count(),
    cardProgress: await legacy.cardProgress.count(),
    reviewLog: await legacy.reviewLog.count(),
  }
}

const server = withTestServer()
const rowsIn = (table: string) => server.db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)!.n

beforeEach(async () => {
  await legacy.delete()
  localStorage.clear()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('detectLegacy', () => {
  it('finds nothing, and does not create the database, when the browser never had one', async () => {
    expect(await detectLegacy()).toBeNull()
    const names = (await indexedDB.databases()).map((d) => d.name)
    expect(names).not.toContain('RecordDB')
  })

  it('finds nothing when the database exists but every table is empty', async () => {
    await legacy.open()
    expect(await detectLegacy()).toBeNull()
  })

  it('counts the rows of every table when there is data', async () => {
    await populate()
    expect(await detectLegacy()).toEqual(COUNTS)
  })
})

describe('runMigration', () => {
  it('moves every row with its id and the flags, and the server then holds exactly what the browser held', async () => {
    await populate()
    localStorage.setItem('seededPersonalSets', JSON.stringify(['myVocab']))
    localStorage.setItem('backfilledPersonalExtras', JSON.stringify(['myVocab@2']))

    const result = await runMigration()

    expect(result.counts).toEqual(COUNTS)
    expect(rowsIn('word_records')).toBe(2)
    expect(server.db.all<{ id: number }>('SELECT id FROM word_records ORDER BY id').map((r) => r.id)).toEqual([7, 9])
    expect(
      JSON.parse(server.db.get<{ word_record_ids: string }>('SELECT word_record_ids FROM chapter_records WHERE id = 3')!.word_record_ids),
    ).toEqual([7, 9])
    const meta = (await call('meta.getAll')) as Record<string, string>
    expect(meta.seededPersonalSets).toBe(JSON.stringify(['myVocab']))
    expect(meta.backfilledPersonalExtras).toBe(JSON.stringify(['myVocab@2']))
    expect(JSON.parse(meta.migratedFrom)).toEqual(COUNTS)
    expect(await call('words.add', { word: 'next', timeStamp: 1, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} })).toBe(10)
  })

  it('sends the rows in batches of the given size and reports progress', async () => {
    await populate()
    const progress = vi.fn()
    const realFetch = globalThis.fetch
    const batchCalls: string[] = []
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.endsWith('/migrate/batch')) batchCalls.push(JSON.parse(String(init?.body)).table)
      return realFetch(input, init)
    }) as typeof fetch
    try {
      await runMigration({ batchSize: 1, onProgress: progress })
    } finally {
      globalThis.fetch = realFetch
    }
    // 2 word records in two batches, one batch for each of the other tables
    expect(batchCalls.filter((table) => table === 'wordRecords')).toHaveLength(2)
    expect(batchCalls).toHaveLength(7)
    expect(progress).toHaveBeenCalled()
    expect(progress.mock.calls[progress.mock.calls.length - 1][0]).toMatchObject({ done: 7, total: 7 })
  })

  it('keeps the browser data and leaves the server empty when the upload fails halfway', async () => {
    await populate()
    const realFetch = globalThis.fetch
    let batches = 0
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string' && input.endsWith('/migrate/batch') && ++batches === 3)
        return Promise.reject(new TypeError('network down'))
      return realFetch(input, init)
    }) as typeof fetch
    try {
      await expect(runMigration()).rejects.toThrow()
    } finally {
      globalThis.fetch = realFetch
    }
    expect(await legacyCounts()).toEqual(COUNTS)
    for (const table of ['word_records', 'chapter_records', 'review_records', 'custom_dicts', 'card_progress', 'review_log'])
      expect(rowsIn(table)).toBe(0)
    expect(((await call('meta.getAll')) as Record<string, string>).migratedAt).toBeUndefined()
    // the staging file was dropped, so the whole thing can be started again
    await expect(runMigration()).resolves.toMatchObject({ counts: COUNTS })
  })

  it('refuses to run a second time and does not duplicate anything', async () => {
    await populate()
    await runMigration()
    await expect(runMigration()).rejects.toThrow()
    expect(rowsIn('word_records')).toBe(2)
  })

  it('reports a mismatch when the server says it holds something different from what was read', async () => {
    await populate()
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await realFetch(input, init)
      if (typeof input === 'string' && input.endsWith('/migrate/commit')) {
        const body = (await response.json()) as { result: { counts: Record<string, number> } }
        body.result.counts.wordRecords += 1
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return response
    }) as typeof fetch
    try {
      await expect(runMigration()).rejects.toBeInstanceOf(MigrationMismatch)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('does nothing when the browser has no data', async () => {
    await expect(runMigration()).rejects.toThrow(/nothing/i)
  })
})

describe('deleteLegacyCopy', () => {
  it('deletes the old database and the two old flag keys, and nothing else in localStorage', async () => {
    await populate()
    localStorage.setItem('seededPersonalSets', '["myVocab"]')
    localStorage.setItem('backfilledPersonalExtras', '[]')
    localStorage.setItem('currentDict', '"cet4"')
    legacy.close()

    await deleteLegacyCopy()

    expect(await detectLegacy()).toBeNull()
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain('RecordDB')
    expect(localStorage.getItem('seededPersonalSets')).toBeNull()
    expect(localStorage.getItem('backfilledPersonalExtras')).toBeNull()
    expect(localStorage.getItem('currentDict')).toBe('"cet4"')
  })
})
