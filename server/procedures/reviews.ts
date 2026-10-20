import * as reviewRecords from '../repo/reviewRecords'
import type { Handler } from './support'
import { argArray, argBoolean, argNumber, argObject, argOptionalNumber, argString } from './support'
import type { ProcedureName } from '@/data/contract'
import type { IReviewRecord } from '@/utils/db/record'

/** Reads and validates the review record at `args[0]`. */
function reviewRecord(args: unknown[]): IReviewRecord {
  const record = argObject(args, 0, 'record')
  const result: IReviewRecord = {
    dict: argString([record.dict], 0, 'record.dict'),
    index: argNumber([record.index], 0, 'record.index'),
    createTime: argNumber([record.createTime], 0, 'record.createTime'),
    isFinished: argBoolean([record.isFinished], 0, 'record.isFinished'),
    words: argArray([record.words], 0, 'record.words') as IReviewRecord['words'],
  }
  const id = argOptionalNumber([record.id], 0, 'record.id')
  if (id !== undefined) result.id = id
  return result
}

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  'reviews.latestUnfinished': (ctx, args) => reviewRecords.latestUnfinished(ctx.db, argString(args, 0, 'dict')),

  'reviews.put': (ctx, args) => reviewRecords.put(ctx.db, reviewRecord(args)),
}
