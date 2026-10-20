import * as chapterRecords from '../repo/chapterRecords'
import * as reviewLog from '../repo/reviewLog'
import * as wordRecords from '../repo/wordRecords'
import type { Handler } from './support'
import { argArray, argNumber, argObject, argString } from './support'
import type { ProcedureName } from '@/data/contract'
import type { IChapterRecord, IWordRecord } from '@/utils/db/record'

/** Reads a nullable number: `null` passes, anything else must be a finite number. */
function numberOrNull(args: unknown[], index: number, name: string): number | null {
  if (args[index] === null) return null
  return argNumber(args, index, name)
}

/** Reads and validates the word record at `args[0]`. */
function wordRecord(args: unknown[]): IWordRecord {
  const record = argObject(args, 0, 'record')
  return {
    word: argString([record.word], 0, 'record.word'),
    dict: argString([record.dict], 0, 'record.dict'),
    timeStamp: argNumber([record.timeStamp], 0, 'record.timeStamp'),
    chapter: numberOrNull([record.chapter], 0, 'record.chapter'),
    timing: argArray([record.timing], 0, 'record.timing') as number[],
    wrongCount: argNumber([record.wrongCount], 0, 'record.wrongCount'),
    mistakes: argObject([record.mistakes], 0, 'record.mistakes') as unknown as IWordRecord['mistakes'],
  }
}

/** Reads and validates the chapter record at `args[0]`. */
function chapterRecord(args: unknown[]): IChapterRecord {
  const record = argObject(args, 0, 'record')
  return {
    dict: argString([record.dict], 0, 'record.dict'),
    timeStamp: argNumber([record.timeStamp], 0, 'record.timeStamp'),
    time: argNumber([record.time], 0, 'record.time'),
    correctCount: argNumber([record.correctCount], 0, 'record.correctCount'),
    wrongCount: argNumber([record.wrongCount], 0, 'record.wrongCount'),
    wordCount: argNumber([record.wordCount], 0, 'record.wordCount'),
    wordNumber: argNumber([record.wordNumber], 0, 'record.wordNumber'),
    correctWordIndexes: argArray([record.correctWordIndexes], 0, 'record.correctWordIndexes') as number[],
    wordRecordIds: argArray([record.wordRecordIds], 0, 'record.wordRecordIds') as number[],
    chapter: numberOrNull([record.chapter], 0, 'record.chapter'),
  }
}

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  'words.add': (ctx, args) => wordRecords.insert(ctx.db, wordRecord(args)),

  'words.deleteByWord': (ctx, args) => {
    const word = argString(args, 0, 'word')
    const dict = argString(args, 1, 'dict')
    return wordRecords.deleteByWordDict(ctx.db, word, dict)
  },

  'words.between': (ctx, args) => {
    const startTs = argNumber(args, 0, 'startTs')
    const endTs = argNumber(args, 1, 'endTs')
    return wordRecords.between(ctx.db, startTs, endTs)
  },

  'words.wrong': (ctx) => wordRecords.wrong(ctx.db),

  'words.wrongByDict': (ctx, args) => wordRecords.wrongByDict(ctx.db, argString(args, 0, 'dict')),

  'words.revisionCount': (ctx, args) => wordRecords.revisionCount(ctx.db, argString(args, 0, 'dict')),

  'chapters.add': (ctx, args) => chapterRecords.insert(ctx.db, chapterRecord(args)),

  'chapters.byDict': (ctx, args) => chapterRecords.byDict(ctx.db, argString(args, 0, 'dict')),

  'chapters.byDictChapter': (ctx, args) => {
    const dict = argString(args, 0, 'dict')
    const chapter = argNumber(args, 1, 'chapter')
    return chapterRecords.byDictChapter(ctx.db, dict, chapter)
  },

  'stats.summary': (ctx) => {
    const first = wordRecords.firstByTimestamp(ctx.db)
    return {
      chapterCount: chapterRecords.count(ctx.db),
      wordCount: wordRecords.count(ctx.db),
      firstWordTimestamp: first ? first.timeStamp : null,
      sumWrongCount: chapterRecords.sumWrong(ctx.db),
    }
  },

  'activity.times': (ctx, args) => {
    const fromMs = argNumber(args, 0, 'fromMs')
    return {
      reviewTimes: reviewLog.times(ctx.db, fromMs),
      typedSeconds: wordRecords.typedSeconds(ctx.db, Math.floor(fromMs / 1000)),
    }
  },

  'log.hardWordsSince': (ctx, args) => {
    const dict = argString(args, 0, 'dict')
    const sinceMs = argNumber(args, 1, 'sinceMs')
    return reviewLog.hardWordsSince(ctx.db, dict, sinceMs)
  },
}
