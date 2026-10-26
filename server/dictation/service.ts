import type { Db } from '../adapter'
import { getVideo, saveVideo } from '../repo/videos'
import type { RunTool } from './tools'
import { translateBatches } from './translate'
import { DictationFailure, fetchSubtitles } from './youtube'
import type { SubtitleFile } from './youtube'
import { parseCues, parseSubtitles } from '@/utils/dictation/captions'
import type { Cue } from '@/utils/dictation/captions'
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

/** How far apart a Vietnamese line and an English line may start and still count as shown together. */
const ALIGN_TOLERANCE_MS = 500
/** The time shifts tried against the Vietnamese track, to see whether one fits the English lines better than none. */
const MAX_SHIFT_MS = 60_000
const SHIFT_STEP_MS = 100

/** The share of the Vietnamese lines that start near an English line once moved by `shiftMs`. */
function startsMatched(enStarts: number[], viStarts: number[], shiftMs: number): number {
  let matched = 0
  for (const start of viStarts) {
    const at = start + shiftMs
    let lo = 0
    let hi = enStarts.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (enStarts[mid] < at) lo = mid + 1
      else hi = mid
    }
    const near = [lo - 1, lo].some((i) => i >= 0 && i < enStarts.length && Math.abs(enStarts[i] - at) <= ALIGN_TOLERANCE_MS)
    if (near) matched++
  }
  return matched / viStarts.length
}

/**
 * True when the Vietnamese track is timed like the English one. Some videos' tracks are not: the English track was retimed (an
 * intro cut or added) and the Vietnamese one was not, so time overlap hands each sentence the lines of another. A translation
 * written for the English lines starts its lines with them, so most of its lines must start near an English line as they are, and
 * no shift of the whole track may fit clearly better. The second test catches a shifted track even when the English lines are so
 * dense that many lines start near one by chance.
 */
function timedLikeEnglish(en: Cue[], vi: Cue[]): boolean {
  if (vi.length === 0 || en.length === 0) return false
  const enStarts = en.map((cue) => cue.startMs).sort((a, b) => a - b)
  const viStarts = vi.map((cue) => cue.startMs)
  const asIs = startsMatched(enStarts, viStarts, 0)
  let best = asIs
  for (let shift = -MAX_SHIFT_MS; shift <= MAX_SHIFT_MS; shift += SHIFT_STEP_MS)
    best = Math.max(best, startsMatched(enStarts, viStarts, shift))
  return asIs >= 0.5 && asIs >= 0.8 * best
}

/**
 * Gives each line of YouTube's Vietnamese track, whole, to the sentence it overlaps most in time, unless the track is timed
 * differently from the English one (then the sentences are left to the Claude CLI).
 */
function attachYoutubeVietnamese(sentences: DictationSentence[], en: SubtitleFile, vi: SubtitleFile): void {
  let cues
  try {
    cues = parseCues(vi.text, vi.format)
    if (!timedLikeEnglish(parseCues(en.text, en.format), cues)) return
  } catch {
    return
  }
  const parts: string[][] = sentences.map(() => [])
  for (const cue of cues) {
    let best = -1
    let bestOverlap = 0
    sentences.forEach((sentence, i) => {
      const overlap = Math.min(cue.endMs, sentence.end * 1000) - Math.max(cue.startMs, sentence.start * 1000)
      if (overlap > bestOverlap) {
        bestOverlap = overlap
        best = i
      }
    })
    if (best !== -1) parts[best].push(cue.text)
  }
  sentences.forEach((sentence, i) => {
    if (parts[i].length === 0) return
    sentence.vi = parts[i].join(' ')
    sentence.viSource = 'youtube'
  })
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
      const words = parseSubtitles(subtitles.en.text, subtitles.en.format)
      const totalMs = subtitles.durationSec > 0 ? subtitles.durationSec * 1000 : (words[words.length - 1]?.startMs ?? 0) + 2000
      const sentences: DictationSentence[] = buildSentences(words, totalMs)
      if (sentences.length === 0) throw new DictationFailure('NO_SUBTITLES', 'The subtitles of this video have no sentences to type')
      if (subtitles.vi) attachYoutubeVietnamese(sentences, subtitles.en, subtitles.vi)

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
