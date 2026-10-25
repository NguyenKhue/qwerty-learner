// @vitest-environment node
import { fakeTools } from './fakes'
import { ToolError } from './tools'
import { DictationFailure, fetchSubtitles } from './youtube'
import auto from '@/utils/dictation/fixtures/auto.json3.json'
import manual from '@/utils/dictation/fixtures/manual.json3.json'
import { mkdtempSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'
const info = (extra: Record<string, unknown> = {}) => ({ title: 'A talk', channel: 'TED', duration: 612.5, ...extra })
const setup = (ytDlp: Parameters<typeof fakeTools>[0]['ytDlp']) => {
  const tools = fakeTools({ ytDlp })
  const tmpDir = mkdtempSync(join(tmpdir(), 'qwerty-yt-'))
  return { tools, deps: { runTool: tools.runTool, ytDlp: '/opt/bin/yt-dlp', tmpDir }, tmpDir }
}

describe('fetchSubtitles', () => {
  it('reads auto subtitles, the video details and the Vietnamese track, and cleans up its files', async () => {
    const { tools, deps, tmpDir } = setup({
      info: info({ subtitles: {}, automatic_captions: { en: [{}], vi: [{}] } }),
      subtitles: { en: auto, vi: manual },
    })
    const result = await fetchSubtitles(ID, deps)
    expect(result).toMatchObject({ title: 'A talk', channel: 'TED', durationSec: 612.5, kind: 'auto' })
    expect(JSON.parse(result.enJson3)).toEqual(auto)
    expect(JSON.parse(result.viJson3 as string)).toEqual(manual)
    expect(tools.calls[0].command).toBe('/opt/bin/yt-dlp')
    expect(tools.calls[0].args).toEqual(
      expect.arrayContaining(['--skip-download', '--write-subs', '--write-auto-subs', '--', `https://www.youtube.com/watch?v=${ID}`]),
    )
    expect(tools.calls[0].args).not.toContain('--write-video')
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it('says manual when the video has English subtitles written by people, and prefers them', async () => {
    const { deps } = setup({ info: info({ subtitles: { 'en-US': [{}] } }), subtitles: { 'en-US': manual, en: auto } })
    const result = await fetchSubtitles(ID, deps)
    expect(result.kind).toBe('manual')
    expect(JSON.parse(result.enJson3)).toEqual(manual)
    expect(result.viJson3).toBeUndefined()
  })

  it('fails with NO_SUBTITLES when there is no English track', async () => {
    const { deps } = setup({ info: info(), subtitles: { fr: auto } })
    await expect(fetchSubtitles(ID, deps)).rejects.toMatchObject({ code: 'NO_SUBTITLES' })
  })

  it('names the missing tool, a time-out and a failed download', async () => {
    await expect(fetchSubtitles(ID, setup({ fail: new ToolError('missing', 'x') }).deps)).rejects.toMatchObject({ code: 'NO_YTDLP' })
    await expect(fetchSubtitles(ID, setup({ fail: new ToolError('timeout', 'x') }).deps)).rejects.toMatchObject({ code: 'TIMEOUT' })
    const failed = fetchSubtitles(ID, setup({ code: 1, stderr: 'ERROR: [youtube] dQw4w9WgXcQ: Video unavailable\n' }).deps)
    await expect(failed).rejects.toMatchObject({ code: 'FETCH_FAILED', message: expect.stringContaining('Video unavailable') })
  })

  it('never runs anything for a value that is not a video id', async () => {
    const { tools, deps } = setup({ info: info(), subtitles: { en: auto } })
    const error = await fetchSubtitles('abc; rm -rf ~', deps).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DictationFailure)
    expect((error as DictationFailure).code).toBe('BAD_VIDEO')
    expect(tools.calls).toEqual([])
  })
})
