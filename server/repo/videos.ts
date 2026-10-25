import type { Db } from '../adapter'
import type { DictationSentence, DictationVideo, DictationVideoSummary, VideoProgress } from '@/utils/dictation/types'

type CacheRow = {
  id: string
  title: string
  channel: string
  duration_sec: number
  subtitle_kind: string
  prepared_at: number
  note: string | null
  sentences?: string
  sentence_count?: number
}
type ProgressRow = { position: number; correct: number; wrong: number; finished: number; updated_at: number }

function progressOf(row: ProgressRow | undefined): VideoProgress | undefined {
  if (!row) return undefined
  return { position: row.position, correct: row.correct, wrong: row.wrong, finished: row.finished === 1, updatedAt: row.updated_at }
}

function base(row: CacheRow): Omit<DictationVideo, 'sentences' | 'progress'> {
  return {
    id: row.id,
    title: row.title,
    channel: row.channel,
    durationSec: row.duration_sec,
    subtitleKind: row.subtitle_kind === 'manual' ? 'manual' : 'auto',
    preparedAt: row.prepared_at,
    ...(row.note === null ? {} : { note: row.note }),
  }
}

const progressRow = (db: Db, id: string) =>
  db.get<ProgressRow>('SELECT position, correct, wrong, finished, updated_at FROM video_progress WHERE video_id = ?', [id])

/** Caches a prepared video, replacing an earlier cache of it; the learner's progress in it is kept. */
export function saveVideo(db: Db, video: Omit<DictationVideo, 'progress'>): void {
  db.run(
    `INSERT INTO video_cache (id, title, channel, duration_sec, subtitle_kind, prepared_at, note, sentences)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET title = excluded.title, channel = excluded.channel, duration_sec = excluded.duration_sec,
       subtitle_kind = excluded.subtitle_kind, prepared_at = excluded.prepared_at, note = excluded.note, sentences = excluded.sentences`,
    [
      video.id,
      video.title,
      video.channel,
      video.durationSec,
      video.subtitleKind,
      video.preparedAt,
      video.note ?? null,
      JSON.stringify(video.sentences),
    ],
  )
}

/** A cached video with its sentences and progress, or null when it was never prepared. */
export function getVideo(db: Db, id: string): DictationVideo | null {
  const row = db.get<CacheRow>('SELECT * FROM video_cache WHERE id = ?', [id])
  if (!row) return null
  const progress = progressOf(progressRow(db, id))
  return { ...base(row), sentences: JSON.parse(row.sentences ?? '[]') as DictationSentence[], ...(progress ? { progress } : {}) }
}

/** Every cached video without its sentences, the most recently studied or prepared first. */
export function listVideos(db: Db): DictationVideoSummary[] {
  const rows = db.all<CacheRow & Partial<ProgressRow> & { video_id: string | null }>(
    `SELECT c.id, c.title, c.channel, c.duration_sec, c.subtitle_kind, c.prepared_at, c.note,
       json_array_length(c.sentences) AS sentence_count,
       p.video_id, p.position, p.correct, p.wrong, p.finished, p.updated_at
     FROM video_cache c LEFT JOIN video_progress p ON p.video_id = c.id
     ORDER BY MAX(c.prepared_at, COALESCE(p.updated_at, 0)) DESC, c.id`,
  )
  return rows.map((row) => {
    const progress = row.video_id === null ? undefined : progressOf(row as ProgressRow)
    return { ...base(row), sentenceCount: row.sentence_count ?? 0, ...(progress ? { progress } : {}) }
  })
}

/** Records how far the learner got in a cached video; throws when the video is not cached. */
export function saveProgress(db: Db, id: string, progress: Omit<VideoProgress, 'updatedAt'>, now: number): void {
  if (!db.get('SELECT 1 FROM video_cache WHERE id = ?', [id])) throw new Error(`Video ${id} is not prepared`)
  db.run(
    `INSERT INTO video_progress (video_id, position, correct, wrong, finished, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (video_id) DO UPDATE SET position = excluded.position, correct = excluded.correct, wrong = excluded.wrong,
       finished = excluded.finished, updated_at = excluded.updated_at`,
    [id, progress.position, progress.correct, progress.wrong, progress.finished ? 1 : 0, now],
  )
}

/** Forgets a cached video and the learner's progress in it. */
export function removeVideo(db: Db, id: string): void {
  db.transaction(() => {
    db.run('DELETE FROM video_progress WHERE video_id = ?', [id])
    db.run('DELETE FROM video_cache WHERE id = ?', [id])
  })
}
