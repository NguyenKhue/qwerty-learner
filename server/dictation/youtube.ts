import type { RunTool } from './tools'
import { ToolError } from './tools'
import type { DictationErrorCode } from '@/utils/dictation/types'
import { isVideoId } from '@/utils/dictation/videoId'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const TIMEOUT_MS = 60_000
const MAX_BYTES = 4 * 1024 * 1024

/** Why a video could not be prepared, worded for the learner. */
export class DictationFailure extends Error {
  readonly code: DictationErrorCode

  constructor(code: DictationErrorCode, message: string) {
    super(message)
    this.name = 'DictationFailure'
    this.code = code
  }
}

export type FetchedSubtitles = {
  title: string
  channel: string
  durationSec: number
  kind: 'manual' | 'auto'
  enJson3: string
  viJson3?: string
}

const keysOf = (value: unknown): string[] => (value && typeof value === 'object' ? Object.keys(value) : [])
const isEnglish = (lang: string) => lang === 'en' || lang.startsWith('en-')

/**
 * Fetches a video's English subtitles (and YouTube's Vietnamese track when there is one) with `yt-dlp`, without downloading
 * the video. Files are written to a temporary folder that is always removed.
 */
export async function fetchSubtitles(id: string, d: { runTool: RunTool; ytDlp: string; tmpDir: string }): Promise<FetchedSubtitles> {
  if (!isVideoId(id)) throw new DictationFailure('BAD_VIDEO', 'That is not a YouTube video id')
  const dir = mkdtempSync(join(d.tmpDir, 'qwerty-dictation-'))
  try {
    const args = [
      '--skip-download',
      '--no-playlist',
      '--no-warnings',
      '--write-info-json',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      'en.*,en,vi',
      '--sub-format',
      'json3',
      '--paths',
      dir,
      '--output',
      '%(id)s.%(ext)s',
      '--',
      `https://www.youtube.com/watch?v=${id}`,
    ]
    let result
    try {
      result = await d.runTool(d.ytDlp, args, { timeoutMs: TIMEOUT_MS, maxBytes: MAX_BYTES })
    } catch (error) {
      if (error instanceof ToolError && error.kind === 'missing') {
        throw new DictationFailure('NO_YTDLP', 'yt-dlp is not installed. Install it with: brew install yt-dlp')
      }
      if (error instanceof ToolError && error.kind === 'timeout')
        throw new DictationFailure('TIMEOUT', 'Fetching the subtitles took too long')
      throw new DictationFailure('FETCH_FAILED', error instanceof Error ? error.message : 'Fetching the subtitles failed')
    }
    if (result.code !== 0) {
      const reason = result.stderr.trim().split('\n').filter(Boolean).pop() ?? `yt-dlp exited with code ${result.code}`
      throw new DictationFailure('FETCH_FAILED', reason.replace(/^ERROR:\s*/, ''))
    }

    const infoFile = join(dir, `${id}.info.json`)
    if (!existsSync(infoFile)) throw new DictationFailure('FETCH_FAILED', 'yt-dlp did not return the video details')
    const info = JSON.parse(readFileSync(infoFile, 'utf8')) as Record<string, unknown>

    const files = readdirSync(dir)
    const langOf = (file: string) => file.slice(id.length + 1, file.length - '.json3'.length)
    const tracks = files.filter((f) => f.startsWith(`${id}.`) && f.endsWith('.json3')).map(langOf)
    const manual = keysOf(info.subtitles).filter(isEnglish)
    const english = [...manual, 'en', 'en-orig', ...tracks.filter(isEnglish)].find((lang) => tracks.indexOf(lang) !== -1)
    if (!english) throw new DictationFailure('NO_SUBTITLES', 'This video has no English subtitles')

    const read = (lang: string) => readFileSync(join(dir, `${id}.${lang}.json3`), 'utf8')
    return {
      title: typeof info.title === 'string' ? info.title : id,
      channel: typeof info.channel === 'string' ? info.channel : typeof info.uploader === 'string' ? info.uploader : '',
      durationSec: typeof info.duration === 'number' ? info.duration : 0,
      kind: manual.indexOf(english) !== -1 ? 'manual' : 'auto',
      enJson3: read(english),
      ...(tracks.indexOf('vi') !== -1 ? { viJson3: read('vi') } : {}),
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
