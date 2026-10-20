// @vitest-environment node
import type { Db } from '../adapter'
import { openDb } from '../adapter'
import { ensureSchema } from '../schema'
import { handlers } from './reviews'
import type { Ctx } from './support'
import { ProcedureError } from './support'
import type { StoredReviewRecord } from '@/data/contract'
import type { IReviewRecord } from '@/utils/db/record'
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

/** A valid error-book review record, with fields overridden per test. */
function review(overrides: Partial<IReviewRecord> = {}): IReviewRecord {
  return { dict: 'dict', index: 0, createTime: 100, isFinished: false, words: [], ...overrides }
}

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

/** Puts a record through the handler and returns its id. */
function putReview(overrides: Partial<IReviewRecord> = {}): number {
  return run('reviews.put', [review(overrides)]) as number
}

describe('reviews procedures', () => {
  it('latestUnfinished returns null when the dict has no record', () => {
    expect(run('reviews.latestUnfinished', ['dict'])).toBeNull()
  })

  it('latestUnfinished returns the newest unfinished record of the dict and ignores other dicts', () => {
    putReview({ dict: 'a', createTime: 100, index: 0 })
    const newest = putReview({ dict: 'a', createTime: 300, index: 2 })
    putReview({ dict: 'a', createTime: 200, index: 1, isFinished: true })
    putReview({ dict: 'b', createTime: 400, index: 3 })

    const latest = run('reviews.latestUnfinished', ['a']) as StoredReviewRecord
    expect(latest.id).toBe(newest)
    expect(latest.dict).toBe('a')
    expect(latest.index).toBe(2)
    expect(latest.isFinished).toBe(false)
  })

  it('latestUnfinished returns null when the newest record is finished, even with older unfinished ones', () => {
    putReview({ dict: 'a', createTime: 100, index: 0 })
    const newest = putReview({ dict: 'a', createTime: 200, index: 1 })
    putReview({ id: newest, dict: 'a', createTime: 200, index: 1, isFinished: true })

    expect(run('reviews.latestUnfinished', ['a'])).toBeNull()
  })

  it('put inserts without an id and replaces the row when the id exists', () => {
    const id = putReview({ dict: 'a', index: 0, createTime: 100 })
    expect(id).toBeGreaterThan(0)

    const inserted = run('reviews.latestUnfinished', ['a']) as StoredReviewRecord
    expect(inserted.index).toBe(0)

    const replaced = run('reviews.put', [review({ id, dict: 'a', index: 3, createTime: 100 })]) as number
    expect(replaced).toBe(id)

    const afterReplace = run('reviews.latestUnfinished', ['a']) as StoredReviewRecord
    expect(afterReplace.id).toBe(id)
    expect(afterReplace.index).toBe(3)
    expect(db.get<{ count: number }>('SELECT COUNT(*) AS count FROM review_records')?.count).toBe(1)
  })
})

describe('reviews procedure argument validation', () => {
  it('rejects a missing argument of every procedure that takes one', () => {
    expectBadRequest('reviews.latestUnfinished', [])
    expectBadRequest('reviews.put', [])
  })

  it('rejects a wrong argument type for every procedure that takes one', () => {
    const cases: Array<[keyof typeof handlers, unknown[]]> = [
      ['reviews.latestUnfinished', [1]],
      ['reviews.put', [{}]],
      ['reviews.put', [{ ...review(), dict: 1 }]],
      ['reviews.put', [{ ...review(), index: '0' }]],
      ['reviews.put', [{ ...review(), createTime: null }]],
      ['reviews.put', [{ ...review(), isFinished: 0 }]],
      ['reviews.put', [{ ...review(), words: 'apple' }]],
      ['reviews.put', [{ ...review(), id: '1' }]],
      ['reviews.put', [review({ id: Number.NaN })]],
    ]
    for (const [name, args] of cases) expectBadRequest(name, args)
  })

  it('accepts an absent or null id as an insert', () => {
    expect(run('reviews.put', [review({ id: undefined })])).toBeGreaterThan(0)
    expect(run('reviews.put', [{ ...review(), id: null }])).toBeGreaterThan(0)
  })
})
