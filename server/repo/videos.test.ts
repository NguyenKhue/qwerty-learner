// @vitest-environment node
import { openDb } from '../adapter'
import { ensureSchema } from '../schema'
import { getVideo, listVideos, removeVideo, saveProgress, saveVideo } from './videos'
import type { DictationVideo } from '@/utils/dictation/types'
import { describe, expect, it } from 'vitest'

const fresh = () => {
  const db = openDb(':memory:')
  ensureSchema(db)
  return db
}

const video = (id: string, preparedAt = 1000): Omit<DictationVideo, 'progress'> => ({
  id,
  title: `Title ${id}`,
  channel: 'TED',
  durationSec: 600,
  subtitleKind: 'auto',
  preparedAt,
  note: 'Translation tool missing',
  sentences: [
    { start: 1, end: 3.5, en: 'Hello there everyone.', vi: 'Xin chào mọi người.', viSource: 'ai' },
    { start: 4, end: 6, en: 'Thanks for coming today.' },
  ],
})

describe('the video repository', () => {
  it('reads back a saved video with its sentences', () => {
    const db = fresh()
    saveVideo(db, video('aaaaaaaaaaa'))
    expect(getVideo(db, 'aaaaaaaaaaa')).toEqual(video('aaaaaaaaaaa'))
    expect(getVideo(db, 'bbbbbbbbbbb')).toBeNull()
  })

  it('stores progress per video and keeps it when the video is saved again', () => {
    const db = fresh()
    saveVideo(db, video('aaaaaaaaaaa'))
    saveProgress(db, 'aaaaaaaaaaa', { position: 1, correct: 30, wrong: 2, finished: false }, 5000)
    saveVideo(db, { ...video('aaaaaaaaaaa'), title: 'New title' })
    const read = getVideo(db, 'aaaaaaaaaaa')
    expect(read?.title).toBe('New title')
    expect(read?.progress).toEqual({ position: 1, correct: 30, wrong: 2, finished: false, updatedAt: 5000 })
  })

  it('refuses progress for a video that is not cached', () => {
    const db = fresh()
    expect(() => saveProgress(db, 'zzzzzzzzzzz', { position: 0, correct: 0, wrong: 0, finished: false }, 1)).toThrow()
  })

  it('lists videos without their sentences, the most recently used first', () => {
    const db = fresh()
    saveVideo(db, video('aaaaaaaaaaa', 1000))
    saveVideo(db, video('bbbbbbbbbbb', 2000))
    saveProgress(db, 'aaaaaaaaaaa', { position: 2, correct: 10, wrong: 0, finished: true }, 9000)
    const list = listVideos(db)
    expect(list.map((v) => v.id)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb'])
    expect(list[0]).toMatchObject({ sentenceCount: 2, progress: { position: 2, finished: true } })
    expect(list[1].progress).toBeUndefined()
    expect('sentences' in list[0]).toBe(false)
  })

  it('removes a video together with its progress', () => {
    const db = fresh()
    saveVideo(db, video('aaaaaaaaaaa'))
    saveProgress(db, 'aaaaaaaaaaa', { position: 1, correct: 1, wrong: 0, finished: false }, 1)
    removeVideo(db, 'aaaaaaaaaaa')
    expect(getVideo(db, 'aaaaaaaaaaa')).toBeNull()
    expect(db.get<{ n: number }>('SELECT COUNT(*) AS n FROM video_progress')?.n).toBe(0)
  })
})
