// @vitest-environment node
import type { Db } from '../adapter'
import { openDb } from '../adapter'
import { ensureSchema } from '../schema'
import { handlers } from './meta'
import type { Ctx } from './support'
import { ProcedureError } from './support'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let db: Db
let ctx: Ctx

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
  ctx = { db, now: () => 0 }
})

afterEach(() => {
  db.close()
})

/** Calls a handler directly, as the HTTP layer would. */
function run(name: keyof typeof handlers, args: unknown[] = []): unknown {
  return handlers[name]!(ctx, args)
}

/** Calls a handler and asserts the contract's BAD_REQUEST error. */
function expectBadRequest(name: keyof typeof handlers, args: unknown[]): void {
  let error: unknown
  try {
    run(name, args)
  } catch (caught) {
    error = caught
  }
  expect(error).toBeInstanceOf(ProcedureError)
  expect((error as ProcedureError).code).toBe('BAD_REQUEST')
}

describe('meta procedures', () => {
  it('meta.getAll is empty on a fresh database', () => {
    expect(run('meta.getAll')).toEqual({})
  })

  it('meta.set writes a flag, replaces it and returns null', () => {
    expect(run('meta.set', ['seededPersonalSets', '["myVocab"]'])).toBeNull()
    expect(run('meta.set', ['other', 'one'])).toBeNull()
    expect(run('meta.getAll')).toEqual({ other: 'one', seededPersonalSets: '["myVocab"]' })

    expect(run('meta.set', ['other', 'two'])).toBeNull()
    expect(run('meta.getAll')).toEqual({ other: 'two', seededPersonalSets: '["myVocab"]' })
  })
})

describe('meta procedure argument validation', () => {
  it('rejects a missing argument of every procedure that takes one', () => {
    expectBadRequest('meta.set', [])
    expectBadRequest('meta.set', ['key'])
  })

  it('rejects a wrong argument type for every procedure that takes one', () => {
    const cases: Array<[keyof typeof handlers, unknown[]]> = [
      ['meta.set', [1, 'value']],
      ['meta.set', ['key', 1]],
      ['meta.set', [null, null]],
    ]
    for (const [name, args] of cases) expectBadRequest(name, args)
  })
})
