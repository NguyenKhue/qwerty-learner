import type { Db } from '../adapter'
import type { StoredWordRecord } from '@/data/contract'
import type { IWordRecord, LetterMistakes } from '@/utils/db/record'

/** A row of `word_records`, JSON columns still text. */
export interface WordRecordRow {
  id: number
  word: string
  timestamp: number
  dict: string
  chapter: number | null
  wrong_count: number
  timing: string
  mistakes: string
}

/** Rebuilds a word record from its row. */
export function rowToWordRecord(row: WordRecordRow): StoredWordRecord {
  return {
    id: row.id,
    word: row.word,
    timeStamp: row.timestamp,
    dict: row.dict,
    chapter: row.chapter,
    wrongCount: row.wrong_count,
    timing: JSON.parse(row.timing) as number[],
    mistakes: JSON.parse(row.mistakes) as LetterMistakes,
  }
}

/** Inserts one typing record and returns its new id. */
export function insert(db: Db, record: IWordRecord): number {
  const result = db.run(
    `INSERT INTO word_records (word, timestamp, dict, chapter, wrong_count, timing, mistakes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      record.word,
      record.timeStamp,
      record.dict,
      record.chapter,
      record.wrongCount,
      JSON.stringify(record.timing),
      JSON.stringify(record.mistakes),
    ],
  )
  return result.lastInsertRowid
}

/** Deletes every record of one word in one dict and returns the count. */
export function deleteByWordDict(db: Db, word: string, dict: string): number {
  return db.run('DELETE FROM word_records WHERE word = ? AND dict = ?', [word, dict]).changes
}

/** Records from `startTs` up to, but not including, `endTs` (the range semantics Dexie's `between` had), in typing order. */
export function between(db: Db, startTs: number, endTs: number): StoredWordRecord[] {
  return db
    .all<WordRecordRow>('SELECT * FROM word_records WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp, id', [startTs, endTs])
    .map(rowToWordRecord)
}

/** Every record that had at least one mistake. */
export function wrong(db: Db): StoredWordRecord[] {
  return db.all<WordRecordRow>('SELECT * FROM word_records WHERE wrong_count > 0 ORDER BY wrong_count, id').map(rowToWordRecord)
}

/** Every record of one dict that had at least one mistake, fewest mistakes first (the order of the old wrongCount index). */
export function wrongByDict(db: Db, dict: string): StoredWordRecord[] {
  return db
    .all<WordRecordRow>('SELECT * FROM word_records WHERE dict = ? AND wrong_count > 0 ORDER BY wrong_count, id', [dict])
    .map(rowToWordRecord)
}

/** Number of distinct words with a wrong record in the dict. */
export function revisionCount(db: Db, dict: string): number {
  const row = db.get<{ count: number }>('SELECT COUNT(DISTINCT word) AS count FROM word_records WHERE dict = ? AND wrong_count > 0', [dict])
  return row?.count ?? 0
}

/** Total number of word records. */
export function count(db: Db): number {
  return db.get<{ count: number }>('SELECT COUNT(*) AS count FROM word_records')?.count ?? 0
}

/** The oldest record by timestamp, or null when the table is empty. */
export function firstByTimestamp(db: Db): StoredWordRecord | null {
  const row = db.get<WordRecordRow>('SELECT * FROM word_records ORDER BY timestamp, id LIMIT 1')
  return row ? rowToWordRecord(row) : null
}

/** Typing timestamps (seconds) at or after `from`, in order. */
export function typedSeconds(db: Db, from: number): number[] {
  return db
    .all<{ timestamp: number }>('SELECT timestamp FROM word_records WHERE timestamp >= ? ORDER BY timestamp', [from])
    .map((row) => row.timestamp)
}

/** Deletes every typing record of one dict and returns the count. */
export function deleteByDict(db: Db, dict: string): number {
  return db.run('DELETE FROM word_records WHERE dict = ?', [dict]).changes
}

/** Renames a word inside one dict and returns the number of changed records. */
export function renameWord(db: Db, dict: string, from: string, to: string): number {
  return db.run('UPDATE word_records SET word = ? WHERE dict = ? AND word = ?', [to, dict, from]).changes
}
