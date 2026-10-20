import type { Db } from '../adapter'
import type { CustomDictRecord } from '@/utils/db/record'

/** A row of `custom_dicts`, the words still text. */
export interface CustomDictRow {
  id: string
  name: string
  description: string
  words: string
  created_at: number
  updated_at: number
}

/** Rebuilds one of the learner's sets from its row. */
export function rowToCustomDict(row: CustomDictRow): CustomDictRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    words: JSON.parse(row.words) as CustomDictRecord['words'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Every set, oldest first, ties broken by id. */
export function list(db: Db): CustomDictRecord[] {
  return db.all<CustomDictRow>('SELECT * FROM custom_dicts ORDER BY created_at, id').map(rowToCustomDict)
}

/** One set by its bare id, or null. */
export function get(db: Db, id: string): CustomDictRecord | null {
  const row = db.get<CustomDictRow>('SELECT * FROM custom_dicts WHERE id = ?', [id])
  return row ? rowToCustomDict(row) : null
}

/** Inserts one set. */
export function insert(db: Db, record: CustomDictRecord): void {
  db.run('INSERT INTO custom_dicts (id, name, description, words, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    record.id,
    record.name,
    record.description,
    JSON.stringify(record.words),
    record.createdAt,
    record.updatedAt,
  ])
}

/** Inserts or overwrites one set, keeping its id. */
export function replace(db: Db, record: CustomDictRecord): void {
  db.run('INSERT OR REPLACE INTO custom_dicts (id, name, description, words, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [
    record.id,
    record.name,
    record.description,
    JSON.stringify(record.words),
    record.createdAt,
    record.updatedAt,
  ])
}

/** Deletes one set and returns the count. */
function deleteById(db: Db, id: string): number {
  return db.run('DELETE FROM custom_dicts WHERE id = ?', [id]).changes
}

export { deleteById as delete }
