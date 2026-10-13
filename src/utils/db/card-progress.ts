import { db } from './database'
import type { ICardProgress } from './record'
import { srsEffect } from '@/utils/quiz/effect'
import { nextState } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'

export async function getDictProgress(dict: string): Promise<ICardProgress[]> {
  return db.cardProgress.where('dict').equals(dict).toArray()
}

/** Grades one card: reads its row, computes the next state, saves it, and returns the saved row. */
export async function reviewCard(dict: string, word: string, grade: Grade, now: number = Date.now()): Promise<ICardProgress> {
  return db.transaction('rw', db.cardProgress, db.reviewLog, async () => {
    const existing = await db.cardProgress.get([dict, word])
    const next = nextState(existing, { dict, word }, grade, now)
    await db.cardProgress.put(next)
    await db.reviewLog.add({ at: now, dict, word, kind: 'flashcard' })
    return next
  })
}

/**
 * Records the effect of a quiz answer on the schedule (see `srsEffect`). The decision is made inside one transaction from the row as it is
 * now, so a card that another tab studied in the meantime is judged by its current state, not by a snapshot taken when the quiz started.
 * Returns the saved card, or null when the answer does not touch the schedule.
 */
export async function reviewQuizAnswer(
  dict: string,
  word: string,
  correct: boolean,
  now: number = Date.now(),
): Promise<ICardProgress | null> {
  return db.transaction('rw', db.cardProgress, db.reviewLog, async () => {
    const existing = await db.cardProgress.get([dict, word])
    const grade = srsEffect(correct, existing, now)
    if (!grade) return null
    const next = nextState(existing, { dict, word }, grade, now)
    await db.cardProgress.put(next)
    await db.reviewLog.add({ at: now, dict, word, kind: 'quiz' })
    return next
  })
}
