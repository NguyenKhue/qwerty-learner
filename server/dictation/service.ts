import type { Db } from '../adapter'
import { getVideo, saveVideo } from '../repo/videos'
import type { RunTool } from './tools'
import { translateBatches } from './translate'
import { DictationFailure, fetchSubtitles } from './youtube'
import { parseJson3 } from '@/utils/dictation/captions'
import { buildSentences } from '@/utils/dictation/sentences'
import type { DictationSentence, DictationStatus } from '@/utils/dictation/types'
import { isVideoId } from '@/utils/dictation/videoId'
import { tmpdir } from 'node:os'

export type DictationService = {
  /** Starts preparing a video unless it is cached or already being prepared, and returns where it stands. */
  prepare(id: string): DictationStatus
  status(id: string): DictationStatus
  /** Resolves once no preparation is running (for tests). */
  idle(): Promise<void>
}

type Step = NonNullable<DictationStatus['step']>

const TRANSLATION_NOTE = 'Some sentences have no Vietnamese: the translation with the Claude CLI failed or is not available.'

/** Gives each sentence the words of YouTube's Vietnamese track that start while it is spoken. */
function attachYoutubeVietnamese(sentences: DictationSentence[], viJson3: string): void {
  let words
  try {
    words = parseJson3(viJson3)
  } catch {
    return
  }
  for (const sentence of sentences) {
    const text = words
      .filter((w) => w.startMs >= sentence.start * 1000 && w.startMs < sentence.end * 1000)
      .map((w) => w.text)
      .join(' ')
    if (text !== '') {
      sentence.vi = text
      sentence.viSource = 'youtube'
    }
  }
}

/**
 * Prepares videos for dictation in the background: subtitles with yt-dlp, sentences, Vietnamese from YouTube or the Claude CLI,
 * then the cache. One job per video at a time; a failed job is remembered until the next `prepare`. Each step is announced on
 * `dictation:<id>`, and a finished video also on `dictation`.
 */
export function createDictationService(d: {
  db: Db
  runTool: RunTool
  tools: { ytDlp: string; claude: string }
  publish(topics: string[]): void
  now(): number
  tmpDir?: string
}): DictationService {
  const running = new Map<string, Step>()
  const failed = new Map<string, NonNullable<DictationStatus['error']>>()
  const jobs = new Set<Promise<void>>()

  const status = (id: string): DictationStatus => {
    const step = running.get(id)
    if (step) return { state: 'running', step }
    const error = failed.get(id)
    if (error) return { state: 'error', error }
    return getVideo(d.db, id) ? { state: 'ready' } : { state: 'idle' }
  }

  const setStep = (id: string, step: Step) => {
    running.set(id, step)
    d.publish([`dictation:${id}`])
  }

  async function job(id: string): Promise<void> {
    try {
      const subtitles = await fetchSubtitles(id, { runTool: d.runTool, ytDlp: d.tools.ytDlp, tmpDir: d.tmpDir ?? tmpdir() })
      setStep(id, 'sentences')
      const words = parseJson3(subtitles.enJson3)
      const totalMs = subtitles.durationSec > 0 ? subtitles.durationSec * 1000 : (words[words.length - 1]?.startMs ?? 0) + 2000
      const sentences: DictationSentence[] = buildSentences(words, totalMs)
      if (sentences.length === 0) throw new DictationFailure('NO_SUBTITLES', 'The subtitles of this video have no sentences to type')
      if (subtitles.viJson3) attachYoutubeVietnamese(sentences, subtitles.viJson3)

      let note: string | undefined
      const missing = sentences.filter((s) => s.vi === undefined)
      if (missing.length > 0) {
        setStep(id, 'translating')
        const translated = await translateBatches(
          missing.map((s) => s.en),
          { runTool: d.runTool, claude: d.tools.claude },
        )
        missing.forEach((sentence, i) => {
          const vi = translated[i]
          if (vi === undefined) return
          sentence.vi = vi
          sentence.viSource = 'ai'
        })
        if (translated.some((vi) => vi === undefined)) note = TRANSLATION_NOTE
      }

      saveVideo(d.db, {
        id,
        title: subtitles.title,
        channel: subtitles.channel,
        durationSec: subtitles.durationSec,
        subtitleKind: subtitles.kind,
        sentences,
        preparedAt: d.now(),
        ...(note ? { note } : {}),
      })
      running.delete(id)
      d.publish(['dictation', `dictation:${id}`])
    } catch (error) {
      running.delete(id)
      failed.set(
        id,
        error instanceof DictationFailure
          ? { code: error.code, message: error.message }
          : { code: 'FETCH_FAILED', message: error instanceof Error ? error.message : 'Preparing the video failed' },
      )
      d.publish([`dictation:${id}`])
    }
  }

  return {
    prepare(id) {
      if (!isVideoId(id)) return { state: 'error', error: { code: 'BAD_VIDEO', message: 'That is not a YouTube video id' } }
      if (running.has(id) || getVideo(d.db, id)) return status(id)
      failed.delete(id)
      setStep(id, 'subtitles')
      const promise = job(id).finally(() => jobs.delete(promise))
      jobs.add(promise)
      return status(id)
    },
    status,
    async idle() {
      while (jobs.size > 0) await Promise.all(Array.from(jobs))
    },
  }
}
