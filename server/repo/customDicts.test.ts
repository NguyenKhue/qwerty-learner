// @vitest-environment node
import { openDb } from '../adapter'
import type { Db } from '../adapter'
import { ensureSchema } from '../schema'
import * as customDicts from './customDicts'
import type { CustomDictRecord } from '@/utils/db/record'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const words = (names: string[]) => names.map((name) => ({ name })) as unknown as CustomDictRecord['words']

const record = (overrides: Partial<CustomDictRecord> = {}): CustomDictRecord => ({
  id: 'a',
  name: 'Mine',
  description: 'my words',
  words: words(['apple', 'pear']),
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  ensureSchema(db)
})

afterEach(() => db.close())

describe('custom_dicts', () => {
  it('inserts a set and reads it back with its words intact', () => {
    customDicts.insert(db, record())
    const stored = customDicts.get(db, 'a')
    expect(stored?.name).toBe('Mine')
    expect(stored?.description).toBe('my words')
    expect(stored?.words).toEqual(words(['apple', 'pear']))
    expect(stored?.createdAt).toBe(1000)
    expect(stored?.updatedAt).toBe(1000)
    expect(customDicts.get(db, 'missing')).toBe(null)
  })

  it('lists sets by created time, then id', () => {
    customDicts.insert(db, record({ id: 'c', createdAt: 2000 }))
    customDicts.insert(db, record({ id: 'b', createdAt: 1000 }))
    customDicts.insert(db, record({ id: 'a', createdAt: 1000 }))
    expect(customDicts.list(db).map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(customDicts.list(db)[2].id).toBe('c')
  })

  it('replaces a set without inserting a second row', () => {
    customDicts.insert(db, record())
    customDicts.replace(db, record({ name: 'Renamed', words: words(['fig']), updatedAt: 2000 }))
    const rows = customDicts.list(db)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Renamed')
    expect(rows[0].words).toEqual(words(['fig']))
    expect(rows[0].updatedAt).toBe(2000)
  })

  it('deletes a set and reports the count', () => {
    customDicts.insert(db, record())
    expect(customDicts.delete(db, 'a')).toBe(1)
    expect(customDicts.delete(db, 'a')).toBe(0)
    expect(customDicts.list(db)).toEqual([])
  })
})
