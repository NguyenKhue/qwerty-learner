// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import * as cardProgress from '../repo/cardProgress'
import * as chapterRecords from '../repo/chapterRecords'
import * as customDicts from '../repo/customDicts'
import * as reviewLog from '../repo/reviewLog'
import * as reviewRecords from '../repo/reviewRecords'
import * as wordRecords from '../repo/wordRecords'
import { ensureSchema } from '../schema'
import { handlers as personalHandlers } from './personal'
import { ProcedureError } from './support'
import type { Word } from '@/typings'
import type { ICardProgress, IWordRecord } from '@/utils/db/record'
import { beforeEach, describe, expect, it } from 'vitest'

const BUILT_IN = 'myVocab'
const NEW_DICT = 'custom:myvocab'

let db: Db
beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

const call = (name: keyof typeof personalHandlers, ...args: unknown[]) => personalHandlers[name]!({ db, now: () => 5000 }, args)
const input = (words: Word[] = []) => ({ builtInId: BUILT_IN, customId: 'myvocab', name: 'My Vocabulary', description: 'Mine', words })
const migrate = (words: Word[] = []) => call('personal.migrate', input(words)) as Record<string, unknown>
const word = (name: string, detail?: string): Word => ({
  name,
  trans: [`n. ${name}`],
  usphone: '',
  ukphone: '',
  ...(detail ? { detail } : {}),
})
const card = (dict: string, name: string, over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict,
  word: name,
  state: 'review',
  due: 1000,
  interval: 3,
  ease: 2.5,
  reps: 2,
  lapses: 0,
  firstSeen: 1,
  lastReviewed: 2,
  ...over,
})
const wordRecord = (dict: string, name = 'w'): IWordRecord => ({
  word: name,
  timeStamp: 5,
  dict,
  chapter: 0,
  timing: [],
  wrongCount: 0,
  mistakes: {},
})
const set = () => customDicts.get(db, 'myvocab')
const countIn = (table: string, dict: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE dict = ?`, [dict])!.n

describe('personal.migrate', () => {
  it('creates the editable set with the words and details, under a fixed id', () => {
    const result = migrate([word('strict', 'Long text'), word('plain')])
    expect(result.created).toBe(true)
    expect(set()).toMatchObject({ id: 'myvocab', name: 'My Vocabulary', description: 'Mine', createdAt: 5000, updatedAt: 5000 })
    expect(set()?.words.map((w) => w.name)).toEqual(['strict', 'plain'])
    expect(set()?.words[0].detail).toBe('Long text')
  })

  it('moves the study progress to the new set and leaves nothing behind under the old id', () => {
    cardProgress.put(db, card(BUILT_IN, 'strict', { reps: 7 }))
    cardProgress.put(db, card(BUILT_IN, 'plain'))
    cardProgress.put(db, card('cet4', 'other'))
    const result = migrate([word('strict'), word('plain')])
    expect(result.cards).toBe(2)
    expect(cardProgress.byDict(db, BUILT_IN)).toEqual([])
    expect(cardProgress.get(db, NEW_DICT, 'strict')).toMatchObject({ dict: NEW_DICT, word: 'strict', reps: 7 })
    expect(cardProgress.get(db, 'cet4', 'other')).not.toBeNull()
  })

  it('moves typing history, mistake reviews and the review log, and only those of this set', () => {
    wordRecords.insert(db, wordRecord(BUILT_IN))
    wordRecords.insert(db, wordRecord(BUILT_IN))
    wordRecords.insert(db, wordRecord('cet4'))
    chapterRecords.insert(db, {
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
    reviewRecords.put(db, { dict: BUILT_IN, index: 0, createTime: 1, isFinished: false, words: [] })
    reviewLog.insert(db, { at: 1, dict: BUILT_IN, word: 'strict', kind: 'flashcard' })
    const result = migrate([word('strict')])
    expect(result).toMatchObject({ typedWords: 2, chapters: 1, reviews: 1, log: 1 })
    expect(countIn('word_records', NEW_DICT)).toBe(2)
    expect(countIn('word_records', 'cet4')).toBe(1)
    expect(countIn('chapter_records', NEW_DICT)).toBe(1)
    expect(countIn('review_records', NEW_DICT)).toBe(1)
    expect(countIn('review_log', NEW_DICT)).toBe(1)
    expect(countIn('word_records', BUILT_IN)).toBe(0)
  })

  it('keeps the ids of the moved records, so chapter records still point at their words', () => {
    wordRecords.insert(db, wordRecord(BUILT_IN))
    const ids = [wordRecords.insert(db, wordRecord(BUILT_IN)), wordRecords.insert(db, wordRecord(BUILT_IN))]
    const chapterId = chapterRecords.insert(db, {
      dict: BUILT_IN,
      chapter: 0,
      timeStamp: 1,
      time: 1,
      correctCount: 1,
      wrongCount: 0,
      wordCount: 2,
      correctWordIndexes: [],
      wordNumber: 2,
      wordRecordIds: ids,
    })
    migrate([word('strict')])
    expect(chapterRecords.byDict(db, NEW_DICT)).toEqual([expect.objectContaining({ id: chapterId, wordRecordIds: ids })])
    expect(wordRecords.between(db, 0, 1e12).map((r) => r.id)).toEqual([1, ...ids])
  })

  it("is safe to run again: it neither duplicates the set nor overwrites the user's edits", () => {
    migrate([word('strict', 'Original')])
    customDicts.replace(db, { ...set()!, words: [word('strict', 'My own edit'), word('added')] })
    const again = migrate([word('strict', 'Original')])
    expect(again.created).toBe(false)
    expect(customDicts.list(db)).toHaveLength(1)
    expect(set()?.words.map((w) => w.detail ?? w.name)).toEqual(['My own edit', 'added'])
  })

  it('keeps the progress that already exists on the new set if a card is on both', () => {
    cardProgress.put(db, card(BUILT_IN, 'strict', { reps: 1 }))
    cardProgress.put(db, card(NEW_DICT, 'strict', { reps: 9 }))
    migrate([word('strict')])
    expect(cardProgress.get(db, NEW_DICT, 'strict')?.reps).toBe(9)
    expect(cardProgress.byDict(db, BUILT_IN)).toEqual([])
  })

  it('works on an empty database (a fresh install)', () => {
    expect(migrate([word('a')])).toMatchObject({ created: true, cards: 0, typedWords: 0, chapters: 0, reviews: 0, log: 0 })
  })

  it('moves everything or nothing: a failure in the last step leaves the old ids and no set', () => {
    cardProgress.put(db, card(BUILT_IN, 'strict'))
    wordRecords.insert(db, wordRecord(BUILT_IN))
    db.exec("CREATE TRIGGER block_moves BEFORE UPDATE ON review_log BEGIN SELECT RAISE(ABORT, 'refused'); END")
    reviewLog.insert(db, { at: 1, dict: BUILT_IN, word: 'strict', kind: 'flashcard' })
    expect(() => migrate([word('strict')])).toThrow()
    expect(set()).toBeNull()
    expect(cardProgress.byDict(db, BUILT_IN)).toHaveLength(1)
    expect(countIn('word_records', BUILT_IN)).toBe(1)
  })

  it('rejects input of the wrong shape', () => {
    expect(() => call('personal.migrate')).toThrow(ProcedureError)
    expect(() => call('personal.migrate', { builtInId: 'x' })).toThrow(ProcedureError)
    expect(() => call('personal.migrate', { ...input(), words: 'no' })).toThrow(ProcedureError)
  })
})

describe('personal.backfill', () => {
  const extras = {
    strict: { detail: 'Long', examples: [{ text: 'Be strict.', trans: 'Hãy nghiêm.' }] },
    plain: { examples: [{ text: 'Plain.' }] },
  }

  it('adds the examples of the sidecar to the words that have none and reports how many words changed', () => {
    migrate([word('strict'), word('plain'), word('other')])
    expect(call('personal.backfill', 'myvocab', extras)).toBe(2)
    const words = set()?.words ?? []
    expect(words.find((w) => w.name === 'strict')).toMatchObject({
      detail: 'Long',
      examples: [{ text: 'Be strict.', trans: 'Hãy nghiêm.' }],
    })
    expect(words.find((w) => w.name === 'plain')?.examples).toEqual([{ text: 'Plain.' }])
    expect(words.find((w) => w.name === 'other')?.examples).toBeUndefined()
  })

  it('is idempotent and leaves updatedAt alone when nothing changes', () => {
    migrate([word('strict')])
    call('personal.backfill', 'myvocab', extras)
    const before = set()?.updatedAt
    expect(call('personal.backfill', 'myvocab', extras)).toBe(0)
    expect(set()?.updatedAt).toBe(before)
  })

  it('keeps the learner own detail and sentences first and only adds the sentences that are missing', () => {
    migrate([{ ...word('strict', 'My own detail'), examples: [{ text: 'Mine.' }] }])
    expect(call('personal.backfill', 'myvocab', extras)).toBe(1)
    expect(set()?.words[0]).toMatchObject({
      detail: 'My own detail',
      examples: [{ text: 'Mine.' }, { text: 'Be strict.', trans: 'Hãy nghiêm.' }],
    })
    expect(call('personal.backfill', 'myvocab', extras)).toBe(0)
  })

  it('returns 0 for a set that does not exist, and rejects a map of the wrong shape', () => {
    expect(call('personal.backfill', 'missing', extras)).toBe(0)
    expect(() => call('personal.backfill', 'myvocab', 'no')).toThrow(ProcedureError)
  })
})

describe('personal.fixNames', () => {
  const renames = [{ from: 'disclamer', to: 'disclaimer' }]

  it('renames a misspelled word with its detail spelling and moves its card, review log and typing history', () => {
    migrate([
      { ...word('disclamer', 'Disclamer - Loại từ: Danh từ. Disclamer là lời tuyên bố.'), examples: [{ text: 'A disclaimer.' }] },
      word('other'),
    ])
    cardProgress.put(db, card(NEW_DICT, 'disclamer', { reps: 5 }))
    reviewLog.insert(db, { at: 1, dict: NEW_DICT, word: 'disclamer', kind: 'flashcard', grade: 'good' })
    wordRecords.insert(db, wordRecord(NEW_DICT, 'disclamer'))

    expect(call('personal.fixNames', 'myvocab', renames)).toBe(1)

    const words = set()?.words ?? []
    expect(words.map((w) => w.name)).toEqual(['disclaimer', 'other'])
    expect(words[0].detail).toBe('Disclaimer - Loại từ: Danh từ. Disclaimer là lời tuyên bố.')
    expect(words[0].examples).toEqual([{ text: 'A disclaimer.' }])
    expect(cardProgress.get(db, NEW_DICT, 'disclamer')).toBeNull()
    expect(cardProgress.get(db, NEW_DICT, 'disclaimer')?.reps).toBe(5)
    expect(reviewLog.since(db, 0).map((entry) => entry.word)).toEqual(['disclaimer'])
    expect(wordRecords.between(db, 0, 1e12).map((entry) => entry.word)).toEqual(['disclaimer'])
  })

  it('merges into the correctly spelled word when both exist, keeping its card and adding what is new', () => {
    migrate([
      { ...word('disclamer'), trans: ['n. lời miễn trừ', 'n. extra'], examples: [{ text: 'Typo sentence.' }] },
      { ...word('disclaimer'), trans: ['n. lời miễn trừ'], examples: [{ text: 'Right sentence.' }] },
    ])
    cardProgress.put(db, card(NEW_DICT, 'disclamer', { reps: 1 }))
    cardProgress.put(db, card(NEW_DICT, 'disclaimer', { reps: 9 }))
    reviewLog.insert(db, { at: 1, dict: NEW_DICT, word: 'disclamer', kind: 'quiz' })

    expect(call('personal.fixNames', 'myvocab', renames)).toBe(1)

    const words = set()?.words ?? []
    expect(words.map((w) => w.name)).toEqual(['disclaimer'])
    expect(words[0].trans).toEqual(['n. lời miễn trừ', 'n. extra'])
    expect(words[0].examples).toEqual([{ text: 'Right sentence.' }, { text: 'Typo sentence.' }])
    expect(cardProgress.get(db, NEW_DICT, 'disclamer')).toBeNull()
    expect(cardProgress.get(db, NEW_DICT, 'disclaimer')?.reps).toBe(9)
    expect(reviewLog.since(db, 0).map((entry) => entry.word)).toEqual(['disclaimer'])
  })

  it('does nothing when the misspelled word is not in the set, and is safe to run again', () => {
    migrate([word('disclaimer')])
    const before = set()?.updatedAt
    expect(call('personal.fixNames', 'myvocab', renames)).toBe(0)
    expect(set()?.updatedAt).toBe(before)
    expect(call('personal.fixNames', 'missing', renames)).toBe(0)
  })

  it('changes nothing when a step fails', () => {
    migrate([word('disclamer')])
    cardProgress.put(db, card(NEW_DICT, 'disclamer'))
    db.exec("CREATE TRIGGER block_log BEFORE UPDATE ON review_log BEGIN SELECT RAISE(ABORT, 'refused'); END")
    reviewLog.insert(db, { at: 1, dict: NEW_DICT, word: 'disclamer', kind: 'quiz' })
    expect(() => call('personal.fixNames', 'myvocab', renames)).toThrow()
    expect(set()?.words.map((w) => w.name)).toEqual(['disclamer'])
    expect(cardProgress.get(db, NEW_DICT, 'disclamer')).not.toBeNull()
  })

  it('rejects renames of the wrong shape', () => {
    expect(() => call('personal.fixNames', 'myvocab', 'no')).toThrow(ProcedureError)
    expect(() => call('personal.fixNames', 'myvocab', [{ from: 'a' }])).toThrow(ProcedureError)
  })
})
