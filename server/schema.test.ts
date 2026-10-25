// @vitest-environment node
import { openDb } from './adapter'
import { SCHEMA_V1, ensureSchema } from './schema'
import { describe, expect, it } from 'vitest'

const tables = [
  'word_records',
  'chapter_records',
  'review_records',
  'custom_dicts',
  'card_progress',
  'review_log',
  'meta',
  'video_cache',
  'video_progress',
]

const indexes = [
  'idx_word_records_timestamp',
  'idx_word_records_dict_word',
  'idx_word_records_wrong_count',
  'idx_word_records_dict_chapter',
  'idx_chapter_records_dict_chapter',
  'idx_chapter_records_timestamp',
  'idx_review_records_dict',
  'idx_custom_dicts_created_at',
  'idx_card_progress_dict_due',
  'idx_review_log_at',
  'idx_review_log_dict',
]

describe('ensureSchema', () => {
  it('creates every table and index at version 2', () => {
    const db = openDb(':memory:')
    ensureSchema(db)
    expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(2)
    const names = db.all<{ name: string }>('SELECT name FROM sqlite_master WHERE type = ?', ['table']).map((row) => row.name)
    for (const table of tables) expect(names).toContain(table)
    const indexNames = db.all<{ name: string }>('SELECT name FROM sqlite_master WHERE type = ?', ['index']).map((row) => row.name)
    for (const index of indexes) expect(indexNames).toContain(index)
    db.close()
  })

  it('is a no-op when it runs twice', () => {
    const db = openDb(':memory:')
    ensureSchema(db)
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['kept', 'yes'])
    ensureSchema(db)
    expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(2)
    expect(db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['kept'])?.value).toBe('yes')
    db.close()
  })

  it('moves a version 1 database to version 2, keeping its rows', () => {
    const db = openDb(':memory:')
    db.exec(SCHEMA_V1)
    db.exec('PRAGMA user_version = 1')
    db.run('INSERT INTO meta (key, value) VALUES (?, ?)', ['kept', 'yes'])
    ensureSchema(db)
    expect(db.get<{ user_version: number }>('PRAGMA user_version')?.user_version).toBe(2)
    expect(db.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', ['kept'])?.value).toBe('yes')
    const names = db.all<{ name: string }>('SELECT name FROM sqlite_master WHERE type = ?', ['table']).map((row) => row.name)
    expect(names).toEqual(expect.arrayContaining(['video_cache', 'video_progress']))
    db.close()
  })

  it('refuses a database written by a newer server', () => {
    const db = openDb(':memory:')
    db.exec('PRAGMA user_version = 3')
    expect(() => ensureSchema(db)).toThrow('NEWER_SCHEMA')
    db.exec('PRAGMA user_version = 99')
    expect(() => ensureSchema(db)).toThrow('NEWER_SCHEMA')
    db.close()
  })
})
