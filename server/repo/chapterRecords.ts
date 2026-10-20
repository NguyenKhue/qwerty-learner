import type { Db } from '../adapter'
import type { StoredChapterRecord } from '@/data/contract'
import type { IChapterRecord } from '@/utils/db/record'

/** A row of `chapter_records`, JSON columns still text. */
export interface ChapterRecordRow {
  id: number
  dict: string
  chapter: number | null
  timestamp: number
  time: number
  correct_count: number
  wrong_count: number
  word_count: number
  correct_word_indexes: string
  word_number: number
  word_record_ids: string
}

/** Rebuilds a chapter record from its row. */
export function rowToChapterRecord(row: ChapterRecordRow): StoredChapterRecord {
  return {
    id: row.id,
    dict: row.dict,
    chapter: row.chapter,
    timeStamp: row.timestamp,
    time: row.time,
    correctCount: row.correct_count,
    wrongCount: row.wrong_count,
    wordCount: row.word_count,
    correctWordIndexes: JSON.parse(row.correct_word_indexes) as number[],
    wordNumber: row.word_number,
    wordRecordIds: JSON.parse(row.word_record_ids) as number[],
  }
}

/** Inserts one chapter record and returns its new id. */
export function insert(db: Db, record: IChapterRecord): number {
  const result = db.run(
    `INSERT INTO chapter_records
       (dict, chapter, timestamp, time, correct_count, wrong_count, word_count, correct_word_indexes, word_number, word_record_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.dict,
      record.chapter,
      record.timeStamp,
      record.time,
      record.correctCount,
      record.wrongCount,
      record.wordCount,
      JSON.stringify(record.correctWordIndexes),
      record.wordNumber,
      JSON.stringify(record.wordRecordIds),
    ],
  )
  return result.lastInsertRowid
}

/** Every chapter record of one dict, in insertion order. */
export function byDict(db: Db, dict: string): StoredChapterRecord[] {
  return db.all<ChapterRecordRow>('SELECT * FROM chapter_records WHERE dict = ? ORDER BY id', [dict]).map(rowToChapterRecord)
}

/** Every record of one chapter in one dict, in insertion order. */
export function byDictChapter(db: Db, dict: string, chapter: number): StoredChapterRecord[] {
  return db
    .all<ChapterRecordRow>('SELECT * FROM chapter_records WHERE dict = ? AND chapter = ? ORDER BY id', [dict, chapter])
    .map(rowToChapterRecord)
}

/** Total number of chapter records. */
export function count(db: Db): number {
  return db.get<{ count: number }>('SELECT COUNT(*) AS count FROM chapter_records')?.count ?? 0
}

/** Sum of the chapter records' wrong key presses. */
export function sumWrong(db: Db): number {
  return db.get<{ total: number }>('SELECT COALESCE(SUM(wrong_count), 0) AS total FROM chapter_records')?.total ?? 0
}

/** Deletes every chapter record of one dict and returns the count. */
export function deleteByDict(db: Db, dict: string): number {
  return db.run('DELETE FROM chapter_records WHERE dict = ?', [dict]).changes
}
