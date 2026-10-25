import type { Word } from '@/typings'
import type { PersonalSeedInput, PersonalSeedResult } from '@/utils/db/personal-seed'
import type { CustomDictRecord, ICardProgress, IChapterRecord, IReviewRecord, IWordRecord } from '@/utils/db/record'
import type { WordExtras } from '@/utils/detail/sidecar'
import type { DictationStatus, DictationVideo, DictationVideoSummary, VideoProgress } from '@/utils/dictation/types'
import type { Grade } from '@/utils/srs/scheduler'

/** The input of creating or updating a set of the learner's own (the same shape the app uses today). */
export type CustomDictInput = { name: string; description?: string; words: Word[] }

export type StoredWordRecord = IWordRecord & { id: number }
export type StoredChapterRecord = IChapterRecord & { id: number }
export type StoredReviewRecord = IReviewRecord & { id: number }

export type DataErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL' | 'UNREACHABLE'

/**
 * Every operation of the data server: the single list that both the server handlers and the client callers are typed from.
 * The server shares the pure TypeScript logic (scheduling, set normalising) by import; only these operations cross the wire.
 */
export type Procedures = {
  'cards.byDict': { args: [dict: string]; result: ICardProgress[] }
  'cards.review': { args: [dict: string, word: string, grade: Grade, now?: number]; result: ICardProgress }
  'cards.reviewQuiz': { args: [dict: string, word: string, correct: boolean, now?: number]; result: ICardProgress | null }
  'log.hardWordsSince': { args: [dict: string, sinceMs: number]; result: string[] }
  'activity.times': { args: [fromMs: number]; result: { reviewTimes: number[]; typedSeconds: number[] } }
  'sets.list': { args: []; result: CustomDictRecord[] }
  'sets.get': { args: [id: string]; result: CustomDictRecord | null }
  'sets.create': { args: [input: CustomDictInput]; result: CustomDictRecord }
  'sets.update': { args: [id: string, input: CustomDictInput]; result: null }
  'sets.delete': { args: [id: string]; result: null }
  'personal.migrate': { args: [input: PersonalSeedInput]; result: PersonalSeedResult }
  'personal.backfill': { args: [customId: string, extras: Record<string, WordExtras>]; result: number }
  'personal.fixNames': { args: [customId: string, renames: { from: string; to: string }[]]; result: number }
  'words.add': { args: [record: IWordRecord]; result: number }
  'words.deleteByWord': { args: [word: string, dict: string]; result: number }
  'words.between': { args: [startTs: number, endTs: number]; result: StoredWordRecord[] }
  'words.wrong': { args: []; result: StoredWordRecord[] }
  'words.wrongByDict': { args: [dict: string]; result: StoredWordRecord[] }
  'words.revisionCount': { args: [dict: string]; result: number }
  'chapters.add': { args: [record: IChapterRecord]; result: number }
  'chapters.byDict': { args: [dict: string]; result: StoredChapterRecord[] }
  'chapters.byDictChapter': { args: [dict: string, chapter: number]; result: StoredChapterRecord[] }
  'stats.summary': {
    args: []
    result: { chapterCount: number; wordCount: number; firstWordTimestamp: number | null; sumWrongCount: number }
  }
  'reviews.latestUnfinished': { args: [dict: string]; result: StoredReviewRecord | null }
  'reviews.put': { args: [record: IReviewRecord]; result: number }
  'meta.getAll': { args: []; result: Record<string, string> }
  'dictation.videos': { args: []; result: DictationVideoSummary[] }
  'dictation.get': { args: [videoId: string]; result: DictationVideo | null }
  'dictation.prepare': { args: [videoId: string]; result: DictationStatus }
  'dictation.status': { args: [videoId: string]; result: DictationStatus }
  'dictation.saveProgress': { args: [videoId: string, progress: Omit<VideoProgress, 'updatedAt'>]; result: null }
  'dictation.remove': { args: [videoId: string]; result: null }
  'meta.set': { args: [key: string, value: string]; result: null }
}

export type ProcedureName = keyof Procedures

const NAME_TABLE: Record<ProcedureName, true> = {
  'cards.byDict': true,
  'cards.review': true,
  'cards.reviewQuiz': true,
  'log.hardWordsSince': true,
  'activity.times': true,
  'sets.list': true,
  'sets.get': true,
  'sets.create': true,
  'sets.update': true,
  'sets.delete': true,
  'personal.migrate': true,
  'personal.backfill': true,
  'personal.fixNames': true,
  'words.add': true,
  'words.deleteByWord': true,
  'words.between': true,
  'words.wrong': true,
  'words.wrongByDict': true,
  'words.revisionCount': true,
  'chapters.add': true,
  'chapters.byDict': true,
  'chapters.byDictChapter': true,
  'stats.summary': true,
  'reviews.latestUnfinished': true,
  'reviews.put': true,
  'meta.getAll': true,
  'meta.set': true,
  'dictation.videos': true,
  'dictation.get': true,
  'dictation.prepare': true,
  'dictation.status': true,
  'dictation.saveProgress': true,
  'dictation.remove': true,
}

/** Every operation name at run time. The table above is typed against `Procedures`, so a missing or extra name is a compile error. */
export const PROCEDURE_NAMES = Object.keys(NAME_TABLE) as ProcedureName[]

/**
 * The live-update topics a call changes. The server publishes them after the write has committed; a read changes nothing.
 * Topics: `customDicts`, `cards:<dict>`, `reviewLog`, `wordRecords`, `chapterRecords`, `reviewRecords`, `meta`, `dictation` (the list of
 * prepared videos) and `dictation:<videoId>` (one video's preparation and progress).
 */
export function topicsOf(name: ProcedureName, args: unknown[]): string[] {
  switch (name) {
    case 'cards.review':
    case 'cards.reviewQuiz':
      return [`cards:${args[0]}`, 'reviewLog']
    case 'sets.create':
    case 'sets.update':
    case 'personal.backfill':
      return ['customDicts']
    case 'sets.delete':
      return ['customDicts', `cards:custom:${args[0]}`, 'wordRecords', 'chapterRecords', 'reviewRecords']
    case 'personal.migrate': {
      const input = args[0] as Pick<PersonalSeedInput, 'builtInId' | 'customId'>
      return [
        'customDicts',
        `cards:${input.builtInId}`,
        `cards:custom:${input.customId}`,
        'reviewLog',
        'wordRecords',
        'chapterRecords',
        'reviewRecords',
      ]
    }
    case 'personal.fixNames':
      return ['customDicts', `cards:custom:${args[0]}`, 'reviewLog', 'wordRecords']
    case 'words.add':
    case 'words.deleteByWord':
      return ['wordRecords']
    case 'chapters.add':
      return ['chapterRecords']
    case 'reviews.put':
      return ['reviewRecords']
    case 'meta.set':
      return ['meta']
    case 'dictation.prepare':
    case 'dictation.saveProgress':
    case 'dictation.remove':
      return ['dictation', `dictation:${args[0]}`]
    default:
      return []
  }
}
