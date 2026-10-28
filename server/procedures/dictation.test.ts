// @vitest-environment node
import { openDb } from '../adapter'
import type { DictationService } from '../dictation/service'
import { saveVideo } from '../repo/videos'
import { ensureSchema } from '../schema'
import { handlers } from './dictation'
import type { Ctx } from './support'
import { ProcedureError } from './support'
import type { DictationSentence, DictationStatus } from '@/utils/dictation/types'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'

function setup() {
  const db = openDb(':memory:')
  ensureSchema(db)
  const prepared: string[] = []
  const refetched: string[] = []
  const retranslated: string[] = []
  const dictation: DictationService = {
    prepare: (id, opts) => {
      prepared.push(id)
      if (opts?.refetch) refetched.push(id)
      return { state: 'running', step: 'subtitles' }
    },
    status: (): DictationStatus => ({ state: 'idle' }),
    preparing: () => false,
    retranslate: (id) => {
      retranslated.push(id)
      return { state: 'running', step: 'translating' }
    },
    idle: async () => undefined,
  }
  const ctx: Ctx = { db, now: () => 777, dictation }
  const call = (name: keyof typeof handlers, ...args: unknown[]) => (handlers[name] as (c: Ctx, a: unknown[]) => unknown)(ctx, args)
  const cache = (sentences: DictationSentence[] = [{ start: 0, end: 2, en: 'one two three' }]) =>
    saveVideo(db, {
      id: ID,
      title: 'T',
      channel: 'C',
      durationSec: 10,
      subtitleKind: 'auto',
      preparedAt: 1,
      sentences,
    })
  return { db, ctx, call, prepared, refetched, retranslated, cache }
}

const codeOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (error) {
    return error instanceof ProcedureError ? error.code : 'OTHER'
  }
  return 'NONE'
}

describe('the dictation procedures', () => {
  it('refuses anything that is not a video id before it reaches the service', () => {
    const { call, prepared } = setup()
    expect(codeOf(() => call('dictation.prepare', '../etc'))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.get', 'abc; rm -rf ~'))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.prepare'))).toBe('BAD_REQUEST')
    expect(prepared).toEqual([])
  })

  it('hands prepare, status, retranslate and refetch to the service', () => {
    const { call, cache, prepared, refetched, retranslated } = setup()
    expect(call('dictation.prepare', ID)).toEqual({ state: 'running', step: 'subtitles' })
    expect(prepared).toEqual([ID])
    expect(call('dictation.status', ID)).toEqual({ state: 'idle' })
    cache()
    expect(call('dictation.retranslate', ID)).toEqual({ state: 'running', step: 'translating' })
    expect(retranslated).toEqual([ID])
    expect(call('dictation.refetch', ID)).toEqual({ state: 'running', step: 'subtitles' })
    expect(refetched).toEqual([ID])
  })

  it('reads, lists, saves progress for and removes cached videos', () => {
    const { call, cache } = setup()
    expect(call('dictation.get', ID)).toBeNull()
    cache()
    expect(call('dictation.saveProgress', ID, { position: 1, correct: 12, wrong: 3, finished: false })).toBeNull()
    expect(call('dictation.get', ID)).toMatchObject({
      id: ID,
      progress: { position: 1, correct: 12, wrong: 3, finished: false, updatedAt: 777 },
    })
    expect(call('dictation.videos')).toMatchObject([{ id: ID, sentenceCount: 1 }])
    expect(call('dictation.remove', ID)).toBeNull()
    expect(call('dictation.get', ID)).toBeNull()
  })

  it('refuses progress for a video that is not cached, and progress of the wrong shape', () => {
    const { call, cache } = setup()
    expect(codeOf(() => call('dictation.saveProgress', ID, { position: 0, correct: 0, wrong: 0, finished: false }))).toBe('NOT_FOUND')
    cache()
    expect(codeOf(() => call('dictation.saveProgress', ID, { position: -1, correct: 0, wrong: 0, finished: false }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.saveProgress', ID, { position: 1.5, correct: 0, wrong: 0, finished: false }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.saveProgress', ID, { position: 0, correct: 0, wrong: 0, finished: 'yes' }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.saveProgress', ID, null))).toBe('BAD_REQUEST')
  })

  it('imports lyric lines onto the video timeline and retranslates the new sentences', () => {
    const { call, cache, retranslated } = setup()
    cache([
      { start: 0, end: 10, en: 'we walk to the river' },
      { start: 14, end: 27.5, en: 'the water is cold and clear' },
    ])
    const report = call('dictation.importLines', ID, ['we walk to the river', 'the water is cold and clear'])
    expect(report).toMatchObject({ lineCount: 2, previousSentenceCount: 2, matchedLineCount: 2, lowConfidence: [] })
    expect(call('dictation.get', ID)).toMatchObject({
      sentences: [
        { start: 0, end: 10, en: 'we walk to the river' },
        { start: 14, end: 27.5, en: 'the water is cold and clear' },
      ],
    })
    expect(retranslated).toEqual([ID])
  })

  it('edits a sentence, dropping its Vietnamese when the English changes unless a new one is given', () => {
    const { call, cache, retranslated } = setup()
    cache([{ start: 0, end: 3, en: 'we walk to the river at night', vi: 'chúng ta đi dọc bờ sông', viSource: 'ai' }])
    expect(call('dictation.editSentence', ID, 0, { en: 'we walk to the river at dawn' })).toEqual({
      start: 0,
      end: 3,
      en: 'we walk to the river at dawn',
    })
    expect(retranslated).toEqual([ID])
    expect(
      call('dictation.editSentence', ID, 0, { en: 'we walk to the river at noon', vi: 'chúng ta đi dọc bờ sông lúc trưa' }),
    ).toMatchObject({
      en: 'we walk to the river at noon',
      vi: 'chúng ta đi dọc bờ sông lúc trưa',
      viSource: 'manual',
    })
    expect(retranslated).toEqual([ID])
  })

  it('merges two sentences, taking the first start, the second end and both texts', () => {
    const { call, cache, retranslated } = setup()
    cache([
      { start: 0, end: 2, en: 'we walk to', vi: 'chúng ta đi', viSource: 'ai' },
      { start: 2, end: 5, en: 'the river', vi: 'dòng sông', viSource: 'ai' },
    ])
    expect(call('dictation.mergeSentences', ID, 0)).toEqual({ start: 0, end: 5, en: 'we walk to the river' })
    expect(retranslated).toEqual([ID])
    expect(call('dictation.get', ID)).toMatchObject({ sentences: [{ start: 0, end: 5, en: 'we walk to the river' }] })
  })

  it('splits a sentence in proportion to the characters of its two parts', () => {
    const { call, cache, retranslated } = setup()
    cache([{ start: 0, end: 5, en: 'we walk to the river', vi: 'chúng ta đi dọc bờ sông', viSource: 'ai' }])
    const parts = call('dictation.splitSentence', ID, 0, 2) as DictationSentence[]
    const splitAt = 5 * (7 / 19)
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatchObject({ start: 0, en: 'we walk' })
    expect(parts[0].end).toBeCloseTo(splitAt)
    expect(parts[1]).toMatchObject({ end: 5, en: 'to the river' })
    expect(parts[1].start).toBeCloseTo(splitAt)
    expect(parts[0].vi).toBeUndefined()
    expect(parts[1].vi).toBeUndefined()
    expect(retranslated).toEqual([ID])
  })

  it('deletes a sentence, but refuses to delete the last one', () => {
    const { call, cache } = setup()
    cache([
      { start: 0, end: 2, en: 'we walk to' },
      { start: 2, end: 5, en: 'the river' },
    ])
    expect(call('dictation.deleteSentence', ID, 0)).toBeNull()
    expect(call('dictation.get', ID)).toMatchObject({ sentences: [{ start: 2, end: 5, en: 'the river' }] })
    expect(codeOf(() => call('dictation.deleteSentence', ID, 0))).toBe('BAD_REQUEST')
  })

  it('refuses the sentence writes for a video that is not cached', () => {
    const { call } = setup()
    expect(codeOf(() => call('dictation.importLines', ID, ['we walk to the river']))).toBe('NOT_FOUND')
    expect(codeOf(() => call('dictation.editSentence', ID, 0, { en: 'we walk to the river' }))).toBe('NOT_FOUND')
    expect(codeOf(() => call('dictation.mergeSentences', ID, 0))).toBe('NOT_FOUND')
    expect(codeOf(() => call('dictation.splitSentence', ID, 0, 1))).toBe('NOT_FOUND')
    expect(codeOf(() => call('dictation.deleteSentence', ID, 0))).toBe('NOT_FOUND')
    expect(codeOf(() => call('dictation.retranslate', ID))).toBe('NOT_FOUND')
    expect(codeOf(() => call('dictation.refetch', ID))).toBe('NOT_FOUND')
  })

  it('refuses sentence indices and patches that do not fit', () => {
    const { call, cache } = setup()
    cache([
      { start: 0, end: 2, en: 'one two three' },
      { start: 2, end: 5, en: 'four five six' },
    ])
    expect(codeOf(() => call('dictation.editSentence', ID, 2, { en: 'we walk to the river' }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.editSentence', ID, 0.5, { en: 'we walk to the river' }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.editSentence', ID, 0, null))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.editSentence', ID, 0, { en: 'café at night' }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.editSentence', ID, 0, { start: 3, end: 2 }))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.mergeSentences', ID, 1))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.splitSentence', ID, 0, 0))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.splitSentence', ID, 0, 3))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.splitSentence', ID, 0, 1.5))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.importLines', ID, []))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.importLines', ID, ['we walk to the river', 7]))).toBe('BAD_REQUEST')
    expect(codeOf(() => call('dictation.deleteSentence', ID, -1))).toBe('BAD_REQUEST')
  })

  it('reports that dictation is unavailable when the server has no service', () => {
    const { db } = setup()
    const bare: Ctx = { db, now: () => 1 }
    expect(codeOf(() => (handlers['dictation.prepare'] as (c: Ctx, a: unknown[]) => unknown)(bare, [ID]))).toBe('INTERNAL')
  })
})
