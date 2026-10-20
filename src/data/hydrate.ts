import type { StoredChapterRecord, StoredReviewRecord, StoredWordRecord } from './contract'
import { ChapterRecord, ReviewRecord, WordRecord } from '@/utils/db/record'

/**
 * The records come over the wire as plain objects. The screens use the getters of the record classes (`totalTime`, `wpm`, …), so
 * the classes are put back on them; the stored `id` and every field are kept as they are.
 */
function withPrototype<T extends object, R>(prototype: T, row: R): R {
  return Object.assign(Object.create(prototype), row) as R
}

export function toWordRecord(row: StoredWordRecord): WordRecord & { id: number } {
  return withPrototype(WordRecord.prototype, row) as unknown as WordRecord & { id: number }
}

export function toChapterRecord(row: StoredChapterRecord): ChapterRecord & { id: number } {
  return withPrototype(ChapterRecord.prototype, row) as unknown as ChapterRecord & { id: number }
}

export function toReviewRecord(row: StoredReviewRecord): ReviewRecord & { id: number } {
  return withPrototype(ReviewRecord.prototype, row) as unknown as ReviewRecord & { id: number }
}
