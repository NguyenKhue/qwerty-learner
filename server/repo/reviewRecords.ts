import type { Db } from '../adapter'
import type { StoredReviewRecord } from '@/data/contract'
import type { IReviewRecord } from '@/utils/db/record'

/** A row of `review_records`, the word list still text. */
export interface ReviewRecordRow {
  id: number
  dict: string
  position: number
  create_time: number
  is_finished: number
  words: string
}

/** Rebuilds an error-book review record from its row. */
export function rowToReviewRecord(row: ReviewRecordRow): StoredReviewRecord {
  return {
    id: row.id,
    dict: row.dict,
    index: row.position,
    createTime: row.create_time,
    isFinished: row.is_finished !== 0,
    words: JSON.parse(row.words) as StoredReviewRecord['words'],
  }
}

/** The newest record of the dict when it is still unfinished, otherwise null. */
export function latestUnfinished(db: Db, dict: string): StoredReviewRecord | null {
  const row = db.get<ReviewRecordRow>('SELECT * FROM review_records WHERE dict = ? ORDER BY create_time DESC, id DESC LIMIT 1', [dict])
  if (!row || row.is_finished !== 0) return null
  return rowToReviewRecord(row)
}

/** Inserts a record without an id, or replaces the row with the given id, and returns the id. */
export function put(db: Db, record: IReviewRecord): number {
  const params = [record.dict, record.index, record.createTime, record.isFinished ? 1 : 0, JSON.stringify(record.words)]
  if (record.id === undefined) {
    return db.run('INSERT INTO review_records (dict, position, create_time, is_finished, words) VALUES (?, ?, ?, ?, ?)', params)
      .lastInsertRowid
  }
  db.run('INSERT OR REPLACE INTO review_records (id, dict, position, create_time, is_finished, words) VALUES (?, ?, ?, ?, ?, ?)', [
    record.id,
    ...params,
  ])
  return record.id
}

/** Deletes every review record of one dict and returns the count. */
export function deleteByDict(db: Db, dict: string): number {
  return db.run('DELETE FROM review_records WHERE dict = ?', [dict]).changes
}
