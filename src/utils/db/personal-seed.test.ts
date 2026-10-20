import * as cardProgress from '../../../server/repo/cardProgress'
import * as chapterRecords from '../../../server/repo/chapterRecords'
import * as customDicts from '../../../server/repo/customDicts'
import * as reviewLog from '../../../server/repo/reviewLog'
import * as reviewRecords from '../../../server/repo/reviewRecords'
import * as wordRecords from '../../../server/repo/wordRecords'
import { getCustomDict } from './custom-dict'
import {
  EXTRAS_VERSION,
  PERSONAL_RENAMES,
  backfillPersonalExtras,
  extrasFlag,
  fixWordNames,
  isPersonalSeedPending,
  migratePersonalSet,
  namesFlag,
} from './personal-seed'
import type { IWordRecord } from './record'
import { withTestServer } from '@/test/serverHarness'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

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

describe('migratePersonalSet', () => {
  const server = withTestServer()
  const wordCount = (dict: string) =>
    server.db.get<{ count: number }>('SELECT COUNT(*) AS count FROM word_records WHERE dict = ?', [dict])?.count ?? 0
  const countIn = (table: string, dict: string) =>
    server.db.get<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table} WHERE dict = ?`, [dict])?.count ?? 0

  it('creates the editable set with the words and details, under a fixed id', async () => {
    const result = await migratePersonalSet(input([word('strict', 'Long text'), word('plain')]))
    expect(result.created).toBe(true)
    const record = await getCustomDict('myvocab')
    expect(record).toMatchObject({ id: 'myvocab', name: 'My Vocabulary', description: 'Mine' })
    expect(record?.words.map((w) => w.name)).toEqual(['strict', 'plain'])
    expect(record?.words[0].detail).toBe('Long text')
  })

  it('moves the study progress to the new set and leaves nothing behind under the old id', async () => {
    cardProgress.put(server.db, card(BUILT_IN, 'strict', { reps: 7 }))
    cardProgress.put(server.db, card(BUILT_IN, 'plain'))
    cardProgress.put(server.db, card('cet4', 'other'))
    const result = await migratePersonalSet(input([word('strict'), word('plain')]))
    expect(result.cards).toBe(2)
    expect(cardProgress.byDict(server.db, BUILT_IN)).toHaveLength(0)
    const moved = cardProgress.get(server.db, 'custom:myvocab', 'strict')
    expect(moved).toMatchObject({ dict: 'custom:myvocab', word: 'strict', reps: 7 })
    expect(cardProgress.get(server.db, 'cet4', 'other')).toBeDefined()
  })

  it('moves typing history, mistake reviews and the review log, and only those of this set', async () => {
    wordRecords.insert(server.db, wordRecord(BUILT_IN))
    wordRecords.insert(server.db, wordRecord(BUILT_IN))
    wordRecords.insert(server.db, wordRecord('cet4'))
    chapterRecords.insert(server.db, {
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
    reviewRecords.put(server.db, { dict: BUILT_IN, index: 0, createTime: 1, isFinished: false, words: [] })
    reviewLog.insert(server.db, { at: 1, dict: BUILT_IN, word: 'strict', kind: 'flashcard' })
    const result = await migratePersonalSet(input([word('strict')]))
    expect(result).toMatchObject({ typedWords: 2, chapters: 1, reviews: 1, log: 1 })
    expect(wordCount('custom:myvocab')).toBe(2)
    expect(wordCount('cet4')).toBe(1)
    expect(chapterRecords.byDict(server.db, 'custom:myvocab')).toHaveLength(1)
    expect(countIn('review_records', 'custom:myvocab')).toBe(1)
    expect(countIn('review_log', 'custom:myvocab')).toBe(1)
    expect(wordCount(BUILT_IN)).toBe(0)
  })

  it("is safe to run again: it neither duplicates the set nor overwrites the user's edits", async () => {
    await migratePersonalSet(input([word('strict', 'Original')]))
    const existing = customDicts.get(server.db, 'myvocab')
    if (!existing) throw new Error('the personal set was not created')
    customDicts.replace(server.db, { ...existing, words: [word('strict', 'My own edit'), word('added')] })
    const again = await migratePersonalSet(input([word('strict', 'Original')]))
    expect(again.created).toBe(false)
    expect(customDicts.list(server.db)).toHaveLength(1)
    const record = await getCustomDict('myvocab')
    expect(record?.words.map((w) => w.detail ?? w.name)).toEqual(['My own edit', 'added'])
  })

  it('keeps the progress that already exists on the new set if a card is on both', async () => {
    cardProgress.put(server.db, card(BUILT_IN, 'strict', { reps: 1 }))
    cardProgress.put(server.db, card('custom:myvocab', 'strict', { reps: 9 }))
    await migratePersonalSet(input([word('strict')]))
    expect(cardProgress.get(server.db, 'custom:myvocab', 'strict')?.reps).toBe(9)
    expect(cardProgress.byDict(server.db, BUILT_IN)).toHaveLength(0)
  })

  it('works on an empty database (a fresh install)', async () => {
    const result = await migratePersonalSet(input([word('a')]))
    expect(result).toMatchObject({ created: true, cards: 0, typedWords: 0, chapters: 0, reviews: 0, log: 0 })
  })
})

describe('isPersonalSeedPending', () => {
  it('is true for the id of a set that is still to be created from a built-in set, false once it has been', () => {
    expect(isPersonalSeedPending('myvocab', [])).toBe(true)
    expect(isPersonalSeedPending('myvocab', ['cet4'])).toBe(true)
    expect(isPersonalSeedPending('myvocab', ['myVocab'])).toBe(false)
  })

  it('is false for any other id, so a missing set is reported as missing', () => {
    expect(isPersonalSeedPending('abc123', [])).toBe(false)
    expect(isPersonalSeedPending('', [])).toBe(false)
  })
})

describe('backfillPersonalExtras', () => {
  withTestServer()
  const map = {
    strict: { detail: 'Long', examples: [{ text: 'Be strict.', trans: 'Hãy nghiêm.' }] },
    plain: { examples: [{ text: 'Plain.' }] },
  }

  it('adds the examples of the sidecar to the words that have none and reports how many words changed', async () => {
    await migratePersonalSet(input([word('strict'), word('plain'), word('other')]))
    expect(await backfillPersonalExtras('myvocab', map)).toBe(2)
    const words = (await getCustomDict('myvocab'))?.words ?? []
    expect(words.find((w) => w.name === 'strict')).toMatchObject({
      detail: 'Long',
      examples: [{ text: 'Be strict.', trans: 'Hãy nghiêm.' }],
    })
    expect(words.find((w) => w.name === 'plain')?.examples).toEqual([{ text: 'Plain.' }])
    expect(words.find((w) => w.name === 'other')?.examples).toBeUndefined()
  })

  it('is idempotent and leaves updatedAt alone when nothing changes', async () => {
    await migratePersonalSet(input([word('strict')]))
    await backfillPersonalExtras('myvocab', map)
    const before = (await getCustomDict('myvocab'))?.updatedAt
    expect(await backfillPersonalExtras('myvocab', map)).toBe(0)
    expect((await getCustomDict('myvocab'))?.updatedAt).toBe(before)
  })

  it('keeps the learner own detail and sentences first and only adds the sentences that are missing', async () => {
    const own: Word = { ...word('strict', 'My own detail'), examples: [{ text: 'Mine.' }] }
    await migratePersonalSet(input([own]))
    expect(await backfillPersonalExtras('myvocab', map)).toBe(1)
    expect((await getCustomDict('myvocab'))?.words[0]).toMatchObject({
      detail: 'My own detail',
      examples: [{ text: 'Mine.' }, { text: 'Be strict.', trans: 'Hãy nghiêm.' }],
    })
    expect(await backfillPersonalExtras('myvocab', map)).toBe(0)
  })

  it('names the done flag after the data version, so an older flag does not count', () => {
    expect(extrasFlag('myVocab')).toBe(`myVocab@${EXTRAS_VERSION}`)
    expect(extrasFlag('myVocab')).not.toBe('myVocab')
  })

  it('returns 0 for a set that does not exist', async () => {
    expect(await backfillPersonalExtras('missing', map)).toBe(0)
  })
})

describe('fixWordNames', () => {
  const server = withTestServer()
  const DICT = 'custom:myvocab'
  const renames = [{ from: 'disclamer', to: 'disclaimer' }]

  it('renames a misspelled word with its detail spelling and moves its card, review log and typing history', async () => {
    const typo: Word = {
      ...word('disclamer', 'Disclamer - Loại từ: Danh từ. Disclamer là lời tuyên bố.'),
      examples: [{ text: 'A disclaimer.' }],
    }
    await migratePersonalSet(input([typo, word('other')]))
    cardProgress.put(server.db, card(DICT, 'disclamer', { reps: 5 }))
    reviewLog.insert(server.db, { at: 1, dict: DICT, word: 'disclamer', kind: 'flashcard', grade: 'good' })
    wordRecords.insert(server.db, { ...wordRecord(DICT), word: 'disclamer' })

    expect(await fixWordNames('myvocab', renames)).toBe(1)

    const words = (await getCustomDict('myvocab'))?.words ?? []
    expect(words.map((w) => w.name)).toEqual(['disclaimer', 'other'])
    expect(words[0].detail).toBe('Disclaimer - Loại từ: Danh từ. Disclaimer là lời tuyên bố.')
    expect(words[0].examples).toEqual([{ text: 'A disclaimer.' }])
    expect(cardProgress.get(server.db, DICT, 'disclamer')).toBeNull()
    expect(cardProgress.get(server.db, DICT, 'disclaimer')?.reps).toBe(5)
    expect(reviewLog.since(server.db, 0).map((entry) => entry.word)).toEqual(['disclaimer'])
    expect(wordRecords.between(server.db, 0, 10).map((entry) => entry.word)).toEqual(['disclaimer'])
  })

  it('merges into the correctly spelled word when both exist, keeping its card and adding what is new', async () => {
    const typo: Word = { ...word('disclamer'), trans: ['n. lời miễn trừ', 'n. extra'], examples: [{ text: 'Typo sentence.' }] }
    const right: Word = { ...word('disclaimer'), trans: ['n. lời miễn trừ'], examples: [{ text: 'Right sentence.' }] }
    await migratePersonalSet(input([typo, right]))
    cardProgress.put(server.db, card(DICT, 'disclamer', { reps: 1 }))
    cardProgress.put(server.db, card(DICT, 'disclaimer', { reps: 9 }))
    reviewLog.insert(server.db, { at: 1, dict: DICT, word: 'disclamer', kind: 'quiz' })

    expect(await fixWordNames('myvocab', renames)).toBe(1)

    const words = (await getCustomDict('myvocab'))?.words ?? []
    expect(words.map((w) => w.name)).toEqual(['disclaimer'])
    expect(words[0].trans).toEqual(['n. lời miễn trừ', 'n. extra'])
    expect(words[0].examples).toEqual([{ text: 'Right sentence.' }, { text: 'Typo sentence.' }])
    expect(cardProgress.get(server.db, DICT, 'disclamer')).toBeNull()
    expect(cardProgress.get(server.db, DICT, 'disclaimer')?.reps).toBe(9)
    expect(reviewLog.since(server.db, 0).map((entry) => entry.word)).toEqual(['disclaimer'])
  })

  it('does nothing when the misspelled word is not in the set, and is safe to run again', async () => {
    await migratePersonalSet(input([word('disclaimer')]))
    const before = (await getCustomDict('myvocab'))?.updatedAt
    expect(await fixWordNames('myvocab', renames)).toBe(0)
    expect((await getCustomDict('myvocab'))?.updatedAt).toBe(before)
    expect(await fixWordNames('missing', renames)).toBe(0)
  })

  it('lists the four known misspellings and names its done flag apart from the extras flag', () => {
    expect(PERSONAL_RENAMES.myVocab.map((r) => r.from)).toEqual(['disclamer', 'reponsive', 'widepread', 'accommplish'])
    expect(PERSONAL_RENAMES.myVocab.map((r) => r.to)).toEqual(['disclaimer', 'responsive', 'widespread', 'accomplish'])
    expect(namesFlag('myVocab')).not.toBe(extrasFlag('myVocab'))
  })
})
