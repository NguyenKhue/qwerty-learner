// @vitest-environment node
import { openDb } from '../adapter'
import type { DictationService } from '../dictation/service'
import { saveVideo } from '../repo/videos'
import { ensureSchema } from '../schema'
import { handlers } from './dictation'
import type { Ctx } from './support'
import { ProcedureError } from './support'
import type { DictationStatus } from '@/utils/dictation/types'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'

function setup() {
  const db = openDb(':memory:')
  ensureSchema(db)
  const prepared: string[] = []
  const dictation: DictationService = {
    prepare: (id) => {
      prepared.push(id)
      return { state: 'running', step: 'subtitles' }
    },
    status: (): DictationStatus => ({ state: 'idle' }),
    idle: async () => undefined,
  }
  const ctx: Ctx = { db, now: () => 777, dictation }
  const call = (name: keyof typeof handlers, ...args: unknown[]) => (handlers[name] as (c: Ctx, a: unknown[]) => unknown)(ctx, args)
  const cache = () =>
    saveVideo(db, {
      id: ID,
      title: 'T',
      channel: 'C',
      durationSec: 10,
      subtitleKind: 'auto',
      preparedAt: 1,
      sentences: [{ start: 0, end: 2, en: 'one two three' }],
    })
  return { db, ctx, call, prepared, cache }
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

  it('hands prepare and status to the service', () => {
    const { call, prepared } = setup()
    expect(call('dictation.prepare', ID)).toEqual({ state: 'running', step: 'subtitles' })
    expect(prepared).toEqual([ID])
    expect(call('dictation.status', ID)).toEqual({ state: 'idle' })
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

  it('reports that dictation is unavailable when the server has no service', () => {
    const { db } = setup()
    const bare: Ctx = { db, now: () => 1 }
    expect(codeOf(() => (handlers['dictation.prepare'] as (c: Ctx, a: unknown[]) => unknown)(bare, [ID]))).toBe('INTERNAL')
  })
})
