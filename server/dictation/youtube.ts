import type { RunTool } from './tools'
import { ToolError } from './tools'
import type { DictationErrorCode } from '@/utils/dictation/types'
import { isVideoId } from '@/utils/dictation/videoId'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** Listing a video is quick; downloads can wait out YouTube's slow answers and retries. */
const LIST_TIMEOUT_MS = 90_000
const DOWNLOAD_TIMEOUT_MS = 150_000
const MAX_BYTES = 8 * 1024 * 1024
/** Waits before trying again after YouTube answers 429 Too Many Requests: three tries in all. */
const RATE_LIMIT_WAITS_MS = [5000, 15000]
const RATE_LIMIT_MESSAGE = 'YouTube is limiting requests from this computer right now. Wait a few minutes, then try again.'

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Why a video could not be prepared, worded for the learner. */
export class DictationFailure extends Error {
  readonly code: DictationErrorCode

  constructor(code: DictationErrorCode, message: string) {
    super(message)
    this.name = 'DictationFailure'
    this.code = code
  }
}

export type SubtitleFile = { text: string; format: 'json3' | 'vtt' }

export type FetchedSubtitles = {
  title: string
  channel: string
  durationSec: number
  kind: 'manual' | 'auto'
  en: SubtitleFile
  vi?: SubtitleFile
}

type Track = { lang: string; manual: boolean }
type Info = Record<string, unknown>

const keysOf = (value: unknown): string[] => (value && typeof value === 'object' ? Object.keys(value) : [])
const isEnglish = (lang: string) => lang === 'en' || /^en-[A-Za-z]{2,}$/.test(lang)
const ENGLISH_ORDER = ['en', 'en-US', 'en-GB']

/** The English track to dictate: one written by people first, else YouTube's own recognition of an English video. */
function englishTrack(info: Info): Track | null {
  const manual = keysOf(info.subtitles).filter((lang) => isEnglish(lang) && lang !== 'en-orig')
  if (manual.length > 0) {
    const rank = (lang: string) => (ENGLISH_ORDER.indexOf(lang) === -1 ? ENGLISH_ORDER.length : ENGLISH_ORDER.indexOf(lang))
    return { lang: manual.sort((a, b) => rank(a) - rank(b))[0], manual: true }
  }
  const auto = keysOf(info.automatic_captions)
  const language = typeof info.language === 'string' ? info.language : ''
  // For a video in another language, YouTube's "en" auto track is a machine translation, not what is spoken
  if (language !== '' && !isEnglish(language)) return null
  if (auto.indexOf('en-orig') !== -1) return { lang: 'en-orig', manual: false }
  if (auto.indexOf('en') !== -1) return { lang: 'en', manual: false }
  return null
}

function vietnameseTrack(info: Info): Track | null {
  if (keysOf(info.subtitles).indexOf('vi') !== -1) return { lang: 'vi', manual: true }
  if (keysOf(info.automatic_captions).indexOf('vi') !== -1) return { lang: 'vi', manual: false }
  return null
}

/** Runs yt-dlp, turning its failures into the learner's messages. */
async function runYtDlp(d: { runTool: RunTool; ytDlp: string }, args: string[], timeoutMs: number) {
  let result
  try {
    result = await d.runTool(d.ytDlp, args, { timeoutMs, maxBytes: MAX_BYTES })
  } catch (error) {
    if (error instanceof ToolError && error.kind === 'missing') {
      throw new DictationFailure('NO_YTDLP', 'yt-dlp is not installed. Install it with: brew install yt-dlp')
    }
    if (error instanceof ToolError && error.kind === 'timeout')
      throw new DictationFailure('TIMEOUT', 'YouTube took too long to answer. Try again later.')
    throw new DictationFailure('FETCH_FAILED', error instanceof Error ? error.message : 'Fetching the subtitles failed')
  }
  if (result.code !== 0) {
    if (/HTTP Error 429|Too Many Requests/i.test(result.stderr)) throw new DictationFailure('RATE_LIMITED', RATE_LIMIT_MESSAGE)
    const reason = result.stderr.trim().split('\n').filter(Boolean).pop() ?? `yt-dlp exited with code ${result.code}`
    throw new DictationFailure('FETCH_FAILED', reason.replace(/^ERROR:\s*/, ''))
  }
  return result
}

/** Runs `attempt`, and runs it again after a wait each time YouTube answers 429 (three tries in all). */
async function retryRateLimited<T>(attempt: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt()
    } catch (error) {
      if (!(error instanceof DictationFailure) || error.code !== 'RATE_LIMITED' || i >= RATE_LIMIT_WAITS_MS.length) throw error
      await sleep(RATE_LIMIT_WAITS_MS[i])
    }
  }
}

/**
 * Fetches a video's English subtitles (and a Vietnamese track when YouTube has one) with yt-dlp, without downloading the video:
 * first the video's details and list of tracks, then only the chosen tracks (asking for many tracks makes YouTube refuse with
 * "Too Many Requests"). Files go to a temporary folder that is always removed.
 */
export async function fetchSubtitles(
  id: string,
  d: { runTool: RunTool; ytDlp: string; tmpDir: string; sleep?: (ms: number) => Promise<void> },
): Promise<FetchedSubtitles> {
  const sleep = d.sleep ?? realSleep
  if (!isVideoId(id)) throw new DictationFailure('BAD_VIDEO', 'That is not a YouTube video id')
  const url = `https://www.youtube.com/watch?v=${id}`

  const listing = await retryRateLimited(
    () => runYtDlp(d, ['--skip-download', '--no-playlist', '--no-warnings', '--dump-single-json', '--', url], LIST_TIMEOUT_MS),
    sleep,
  )
  let info: Info
  try {
    info = JSON.parse(listing.stdout) as Info
  } catch {
    throw new DictationFailure('FETCH_FAILED', 'yt-dlp did not return the video details')
  }

  const english = englishTrack(info)
  if (!english) {
    const language = typeof info.language === 'string' ? info.language : ''
    throw new DictationFailure(
      'NO_SUBTITLES',
      language !== '' && !isEnglish(language) ? 'This video is not in English' : 'This video has no English subtitles',
    )
  }
  const vietnamese = vietnameseTrack(info)

  const dir = mkdtempSync(join(d.tmpDir, 'qwerty-dictation-'))
  try {
    const read = (lang: string): SubtitleFile | undefined => {
      for (const format of ['json3', 'vtt'] as const) {
        const file = join(dir, `${id}.${lang}.${format}`)
        if (existsSync(file)) return { text: readFileSync(file, 'utf8'), format }
      }
      return undefined
    }
    // One track per call: a refused Vietnamese track (auto-translated tracks are the first YouTube limits) must not cost the English one
    const download = (track: Track) =>
      runYtDlp(
        d,
        [
          '--skip-download',
          '--no-playlist',
          '--no-warnings',
          track.manual ? '--write-subs' : '--write-auto-subs',
          '--sub-langs',
          track.lang,
          '--sub-format',
          'json3/vtt',
          '--paths',
          dir,
          '--output',
          '%(id)s.%(ext)s',
          '--',
          url,
        ],
        DOWNLOAD_TIMEOUT_MS,
      )

    await retryRateLimited(() => download(english), sleep)
    const en = read(english.lang)
    if (!en) throw new DictationFailure('FETCH_FAILED', 'YouTube did not send the English subtitles. Try again later.')

    let vi: SubtitleFile | undefined
    if (vietnamese) {
      try {
        await download(vietnamese)
        vi = read(vietnamese.lang)
      } catch {
        // Without YouTube's Vietnamese the sentences are translated by the Claude CLI instead
        vi = undefined
      }
    }
    return {
      title: typeof info.title === 'string' ? info.title : id,
      channel: typeof info.channel === 'string' ? info.channel : typeof info.uploader === 'string' ? info.uploader : '',
      durationSec: typeof info.duration === 'number' ? info.duration : 0,
      kind: english.manual ? 'manual' : 'auto',
      en,
      ...(vi ? { vi } : {}),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
