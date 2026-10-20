import * as reviewLog from '../../../server/repo/reviewLog'
import * as wordRecords from '../../../server/repo/wordRecords'
import { STREAK_WINDOW_DAYS, loadActivity } from './activity'
import type { IWordRecord } from './record'
import { withTestServer } from '@/test/serverHarness'
import { addLocalDays } from '@/utils/srs/time'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 14, 15, 30).getTime()
const at = (offset: number, hours: number) => {
  const d = new Date(addLocalDays(NOW, offset))
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hours).getTime()
}

describe('loadActivity', () => {
  const server = withTestServer()
  const review = (time: number) => reviewLog.insert(server.db, { at: time, dict: 'd', word: 'w', kind: 'flashcard' })
  // Word records store epoch SECONDS
  const typed = (ms: number) =>
    wordRecords.insert(server.db, {
      word: 'w',
      timeStamp: Math.floor(ms / 1000),
      dict: 'd',
      chapter: 0,
      timing: [],
      wrongCount: 0,
      mistakes: {},
    } as unknown as IWordRecord)

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
    server.db.exec('DELETE FROM review_log')
    await review(at(-(STREAK_WINDOW_DAYS + 5), 9))
    expect((await loadActivity(NOW)).streak).toBe(0)
  })
})
