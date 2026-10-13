import { STREAK_WINDOW_DAYS, loadActivity } from './activity'
import { db } from './database'
import type { IWordRecord } from './record'
import { addLocalDays } from '@/utils/srs/time'
import { beforeEach, describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 14, 15, 30).getTime()
const at = (offset: number, hours: number) => {
  const d = new Date(addLocalDays(NOW, offset))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours).getTime()
}
const review = (time: number) => db.reviewLog.add({ at: time, dict: 'd', word: 'w', kind: 'flashcard' })
// Word records store epoch SECONDS
const typed = (ms: number) =>
  db.wordRecords.add({
    word: 'w',
    timeStamp: Math.floor(ms / 1000),
    dict: 'd',
    chapter: 0,
    timing: [],
    wrongCount: 0,
    mistakes: {},
  } as unknown as IWordRecord)

beforeEach(async () => {
  await db.reviewLog.clear()
  await db.wordRecords.clear()
})

describe('loadActivity', () => {
  it('is seven empty days and no streak for an empty database', async () => {
    const { week, streak } = await loadActivity(NOW)
    expect(week).toHaveLength(7)
    expect(week.every((d) => d.reviews === 0 && d.typed === 0)).toBe(true)
    expect(streak).toBe(0)
  })

  it('combines reviews and typed words (stored in seconds) per day', async () => {
    await review(at(0, 9))
    await review(at(0, 10))
    await typed(at(0, 11))
    await typed(at(-1, 20))
    const { week } = await loadActivity(NOW)
    expect(week[6]).toMatchObject({ reviews: 2, typed: 1 })
    expect(week[5]).toMatchObject({ reviews: 0, typed: 1 })
  })

  it('counts a day with only typing, or only reviews, towards the streak', async () => {
    await review(at(0, 9))
    await typed(at(-1, 9))
    await review(at(-2, 9))
    expect((await loadActivity(NOW)).streak).toBe(3)
  })

  it('looks back past the visible week for the streak and ignores activity older than the window', async () => {
    for (let i = 0; i < 20; i++) await review(at(-i, 9))
    expect((await loadActivity(NOW)).streak).toBe(20)
    await db.reviewLog.clear()
    await review(at(-(STREAK_WINDOW_DAYS + 5), 9))
    expect((await loadActivity(NOW)).streak).toBe(0)
  })
})
