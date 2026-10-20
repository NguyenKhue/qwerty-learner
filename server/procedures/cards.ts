import * as cardProgress from '../repo/cardProgress'
import * as reviewLog from '../repo/reviewLog'
import { ProcedureError, argBoolean, argOptionalNumber, argString } from './support'
import type { Handler } from './support'
import type { ProcedureName } from '@/data/contract'
import { srsEffect } from '@/utils/quiz/effect'
import { GRADES, nextState } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'

function argGrade(args: unknown[], index: number): Grade {
  const value = argString(args, index, 'grade')
  if (GRADES.indexOf(value as Grade) === -1) throw new ProcedureError('BAD_REQUEST', `grade must be one of ${GRADES.join(', ')}`)
  return value as Grade
}

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  'cards.byDict': ({ db }, args) => cardProgress.byDict(db, argString(args, 0, 'dict')),

  /** Grades one card: reads its row, computes the next state, saves it and logs the review, all or nothing. */
  'cards.review': ({ db, now }, args) => {
    const dict = argString(args, 0, 'dict')
    const word = argString(args, 1, 'word')
    const grade = argGrade(args, 2)
    const at = argOptionalNumber(args, 3, 'now') ?? now()
    return db.transaction(() => {
      const existing = cardProgress.get(db, dict, word) ?? undefined
      const next = nextState(existing, { dict, word }, grade, at)
      cardProgress.put(db, next)
      reviewLog.insert(db, { at, dict, word, kind: 'flashcard', grade })
      return next
    })
  },

  /**
   * Records the effect of a quiz answer on the schedule (see `srsEffect`). The decision is made inside one transaction from the row
   * as it is now. Returns the saved card, or null when the answer does not touch the schedule.
   */
  'cards.reviewQuiz': ({ db, now }, args) => {
    const dict = argString(args, 0, 'dict')
    const word = argString(args, 1, 'word')
    const correct = argBoolean(args, 2, 'correct')
    const at = argOptionalNumber(args, 3, 'now') ?? now()
    return db.transaction(() => {
      const existing = cardProgress.get(db, dict, word) ?? undefined
      const grade = srsEffect(correct, existing, at)
      if (!grade) return null
      const next = nextState(existing, { dict, word }, grade, at)
      cardProgress.put(db, next)
      reviewLog.insert(db, { at, dict, word, kind: 'quiz' })
      return next
    })
  },
}
