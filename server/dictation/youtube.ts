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
    const reason = result.stderr.trim().split('\n').filter(Boolean).pop() ?? `yt-dlp exited with code ${result.code}`
    throw new DictationFailure('FETCH_FAILED', reason.replace(/^ERROR:\s*/, ''))
  }
  return result
}

/**
 * Fetches a video's English subtitles (and a Vietnamese track when YouTube has one) with yt-dlp, without downloading the video:
 * first the video's details and list of tracks, then only the chosen tracks (asking for many tracks makes YouTube refuse with
 * "Too Many Requests"). Files go to a temporary folder that is always removed.
 */
export async function fetchSubtitles(id: string, d: { runTool: RunTool; ytDlp: string; tmpDir: string }): Promise<FetchedSubtitles> {
  if (!isVideoId(id)) throw new DictationFailure('BAD_VIDEO', 'That is not a YouTube video id')
  const url = `https://www.youtube.com/watch?v=${id}`

  const listing = await runYtDlp(d, ['--skip-download', '--no-playlist', '--no-warnings', '--dump-single-json', '--', url], LIST_TIMEOUT_MS)
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
  const tracks = vietnamese ? [english, vietnamese] : [english]

  const dir = mkdtempSync(join(d.tmpDir, 'qwerty-dictation-'))
  try {
    const args = [
      '--skip-download',
      '--no-playlist',
      '--no-warnings',
      ...(tracks.some((t) => t.manual) ? ['--write-subs'] : []),
      ...(tracks.some((t) => !t.manual) ? ['--write-auto-subs'] : []),
      '--sub-langs',
      tracks.map((t) => t.lang).join(','),
      '--sub-format',
      'json3/vtt',
      '--paths',
      dir,
      '--output',
      '%(id)s.%(ext)s',
      '--',
      url,
    ]
    await runYtDlp(d, args, DOWNLOAD_TIMEOUT_MS)

    const read = (lang: string): SubtitleFile | undefined => {
      for (const format of ['json3', 'vtt'] as const) {
        const file = join(dir, `${id}.${lang}.${format}`)
        if (existsSync(file)) return { text: readFileSync(file, 'utf8'), format }
      }
      return undefined
    }
    const en = read(english.lang)
    if (!en) throw new DictationFailure('FETCH_FAILED', 'YouTube did not send the English subtitles. Try again later.')
    const vi = vietnamese ? read(vietnamese.lang) : undefined
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
