// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as meta from './meta'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('meta', () => {
  it('returns an empty object on a fresh database', () => {
    expect(meta.getAll(db)).toEqual({})
  })

  it('sets and overwrites one flag', () => {
    meta.set(db, 'seededPersonalSets', '["myVocab"]')
    meta.set(db, 'other', 'yes')
    expect(meta.getAll(db)).toEqual({ other: 'yes', seededPersonalSets: '["myVocab"]' })
    meta.set(db, 'other', 'no')
    expect(meta.getAll(db)).toEqual({ other: 'no', seededPersonalSets: '["myVocab"]' })
  })
})
