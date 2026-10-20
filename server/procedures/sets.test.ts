// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import * as cardProgress from '../repo/cardProgress'
import * as chapterRecords from '../repo/chapterRecords'
import * as reviewRecords from '../repo/reviewRecords'
import * as wordRecords from '../repo/wordRecords'
import { ensureSchema } from '../schema'
import { handlers as setHandlers } from './sets'
import { ProcedureError } from './support'
import type { CustomDictRecord, ICardProgress } from '@/utils/db/record'
import { beforeEach, describe, expect, it } from 'vitest'

let db: Db
let clock = 1_000_000
beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
  clock = 1_000_000
})

const call = (name: keyof typeof setHandlers, ...args: unknown[]) => setHandlers[name]!({ db, now: () => clock }, args)
const create = (input: unknown) => call('sets.create', input) as CustomDictRecord
const get = (id: string) => call('sets.get', id) as CustomDictRecord | null
const word = (name: string) => ({ name, trans: [`n. ${name}`], usphone: '', ukphone: '' })
const card = (dict: string, w: string): ICardProgress => ({
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
const typed = (dict: string) =>
  wordRecords.insert(db, { word: 'x', timeStamp: 1, dict, chapter: 0, timing: [], wrongCount: 0, mistakes: {} })
const count = (table: string, dict: string) => db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE dict = ?`, [dict])!.n

describe('sets.create, sets.get and sets.list', () => {
  it('creates and lists sets; ids are unique, names are trimmed and words are de-duplicated', () => {
    const a = create({ name: ' Set A ', description: 'd', words: [word('x'), word('x'), word('y')] })
    clock += 5
    const b = create({ name: 'Set B', words: [word('z')] })
    expect(a.id).not.toBe(b.id)
    expect(a.name).toBe('Set A')
    expect(a.words.map((w) => w.name)).toEqual(['x', 'y'])
    expect(a.createdAt).toBe(1_000_000)
    expect(a.updatedAt).toBe(1_000_000)
    expect(b.description).toBe('')
    expect(get(a.id)?.words).toHaveLength(2)
    expect((call('sets.list') as CustomDictRecord[]).map((r) => r.name)).toEqual(['Set A', 'Set B'])
  })

  it('returns null for an unknown id', () => {
    expect(get('missing')).toBeNull()
  })

  it('keeps the examples and details of the words', () => {
    const rich = { ...word('x'), detail: 'long', examples: [{ text: 'A sentence.', trans: 'Một câu.' }] }
    const a = create({ name: 'A', words: [rich] })
    expect(get(a.id)?.words[0]).toMatchObject({ detail: 'long', examples: [{ text: 'A sentence.', trans: 'Một câu.' }] })
  })

  it('rejects input of the wrong shape and stores nothing', () => {
    expect(() => call('sets.create')).toThrow(ProcedureError)
    expect(() => call('sets.create', { words: [] })).toThrow(ProcedureError)
    expect(() => call('sets.create', { name: 'A', words: 'no' })).toThrow(ProcedureError)
    expect(call('sets.list')).toEqual([])
  })
})

describe('sets.update', () => {
  it('updates a set, keeps createdAt and moves updatedAt', () => {
    const a = create({ name: 'A', words: [word('x')] })
    clock += 1000
    expect(call('sets.update', a.id, { name: 'A2', description: 'new', words: [word('y'), word('z')] })).toBeNull()
    const updated = get(a.id)
    expect(updated?.name).toBe('A2')
    expect(updated?.description).toBe('new')
    expect(updated?.words.map((w) => w.name)).toEqual(['y', 'z'])
    expect(updated?.createdAt).toBe(a.createdAt)
    expect(updated?.updatedAt).toBe(clock)
  })

  it('refuses an unknown id with NOT_FOUND and creates nothing', () => {
    expect(() => call('sets.update', 'missing', { name: 'x', words: [] })).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    expect(call('sets.list')).toEqual([])
  })
})

describe('sets.delete', () => {
  it('removes the set with its own progress and records, and only those', () => {
    const a = create({ name: 'A', words: [word('x')] })
    const b = create({ name: 'B', words: [word('x')] })
    const dictA = `custom:${a.id}`
    const dictB = `custom:${b.id}`
    cardProgress.put(db, card(dictA, 'x'))
    cardProgress.put(db, card(dictB, 'x'))
    typed(dictA)
    typed(dictB)
    typed('cet4')
    chapterRecords.insert(db, {
      dict: dictA,
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
    reviewRecords.put(db, { dict: dictA, index: 0, createTime: 1, isFinished: false, words: [] })
    reviewRecords.put(db, { dict: dictB, index: 0, createTime: 1, isFinished: false, words: [] })

    expect(call('sets.delete', a.id)).toBeNull()

    expect(get(a.id)).toBeNull()
    expect(count('card_progress', dictA)).toBe(0)
    expect(count('word_records', dictA)).toBe(0)
    expect(count('chapter_records', dictA)).toBe(0)
    expect(count('review_records', dictA)).toBe(0)
    expect(count('card_progress', dictB)).toBe(1)
    expect(count('word_records', dictB)).toBe(1)
    expect(count('review_records', dictB)).toBe(1)
    expect(count('word_records', 'cet4')).toBe(1)
    expect(get(b.id)).not.toBeNull()
  })

  it('removes nothing at all when the last step fails', () => {
    const a = create({ name: 'A', words: [word('x')] })
    const dictA = `custom:${a.id}`
    cardProgress.put(db, card(dictA, 'x'))
    typed(dictA)
    db.exec("CREATE TRIGGER keep_sets BEFORE DELETE ON custom_dicts BEGIN SELECT RAISE(ABORT, 'refused'); END")

    expect(() => call('sets.delete', a.id)).toThrow()

    expect(get(a.id)).not.toBeNull()
    expect(count('card_progress', dictA)).toBe(1)
    expect(count('word_records', dictA)).toBe(1)
  })

  it('does nothing and does not fail for an id that does not exist', () => {
    expect(call('sets.delete', 'missing')).toBeNull()
  })
})
