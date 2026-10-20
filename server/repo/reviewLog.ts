import type { Db } from '../adapter'
import type { IReviewLogEntry } from '@/utils/db/record'

/** A stored review log entry; the table always has an id. */
export type StoredReviewLogEntry = IReviewLogEntry & { id: number }

/** A row of `review_log`. */
export interface ReviewLogRow {
  id: number
  at: number
  dict: string
  word: string
  kind: 'flashcard' | 'quiz'
  grade: 'again' | 'hard' | 'good' | 'easy' | null
}

/** Rebuilds a log entry from its row. */
export function rowToReviewLogEntry(row: ReviewLogRow): StoredReviewLogEntry {
  const entry: StoredReviewLogEntry = { id: row.id, at: row.at, dict: row.dict, word: row.word, kind: row.kind }
  if (row.grade !== null) entry.grade = row.grade
  return entry
}

/** Inserts one graded card or quiz answer and returns its new id. */
export function insert(db: Db, entry: IReviewLogEntry): number {
  return db.run('INSERT INTO review_log (at, dict, word, kind, grade) VALUES (?, ?, ?, ?, ?)', [
    entry.at,
    entry.dict,
    entry.word,
    entry.kind,
    entry.grade ?? null,
  ]).lastInsertRowid
}

/** Every entry at or after `at`, oldest first. */
export function since(db: Db, at: number): StoredReviewLogEntry[] {
  return db.all<ReviewLogRow>('SELECT * FROM review_log WHERE at >= ? ORDER BY at, id', [at]).map(rowToReviewLogEntry)
}

/** Distinct words of one dict graded again or hard at or after `since`. */
export function hardWordsSince(db: Db, dict: string, since: number): string[] {
  return db
    .all<{ word: string }>('SELECT DISTINCT word FROM review_log WHERE dict = ? AND at >= ? AND grade IN (?, ?) ORDER BY word', [
      dict,
      since,
      'again',
      'hard',
    ])
    .map((row) => row.word)
}

/** Every logged time at or after `from`, in order. */
export function times(db: Db, from: number): number[] {
  return db.all<{ at: number }>('SELECT at FROM review_log WHERE at >= ? ORDER BY at', [from]).map((row) => row.at)
}

/** Renames a word inside one dict and returns the number of changed entries. */
export function renameWord(db: Db, dict: string, from: string, to: string): number {
  return db.run('UPDATE review_log SET word = ? WHERE dict = ? AND word = ?', [to, dict, from]).changes
}

/** Moves every entry to another dict and returns the count. */
export function moveDict(db: Db, from: string, to: string): number {
  return db.run('UPDATE review_log SET dict = ? WHERE dict = ?', [to, from]).changes
}
