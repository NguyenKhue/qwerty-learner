import { db } from './database'
import type { ICardProgress } from './record'
import { nextState } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'

export async function getDictProgress(dict: string): Promise<ICardProgress[]> {
  return db.cardProgress.where('dict').equals(dict).toArray()
}

/** Grades one card: reads its row, computes the next state, saves it, and returns the saved row. */
export async function reviewCard(dict: string, word: string, grade: Grade, now: number = Date.now()): Promise<ICardProgress> {
  return db.transaction('rw', db.cardProgress, async () => {
    const existing = await db.cardProgress.get([dict, word])
    const next = nextState(existing, { dict, word }, grade, now)
    await db.cardProgress.put(next)
    return next
  })
}
