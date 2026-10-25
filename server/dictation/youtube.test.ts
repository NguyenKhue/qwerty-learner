// @vitest-environment node
import { fakeTools } from './fakes'
import type { FakeYtDlp } from './fakes'
import { ToolError } from './tools'
import { DictationFailure, fetchSubtitles } from './youtube'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'
const fixture = (name: string) => readFileSync(join(__dirname, '../../src/utils/dictation/fixtures', name), 'utf8')
const track = [{ ext: 'vtt' }]
const info = (extra: Record<string, unknown> = {}) => ({ title: 'A talk', channel: 'TED', duration: 612.5, language: 'en', ...extra })

const setup = (ytDlp: FakeYtDlp) => {
  const tools = fakeTools({ ytDlp })
  const tmpDir = mkdtempSync(join(tmpdir(), 'qwerty-yt-'))
  return { tools, deps: { runTool: tools.runTool, ytDlp: '/opt/bin/yt-dlp', tmpDir }, tmpDir }
}
const argAfter = (args: string[], flag: string) => args[args.indexOf(flag) + 1]

describe('fetchSubtitles', () => {
  it('lists the video first, then downloads only the English and Vietnamese tracks it needs', async () => {
    const { tools, deps, tmpDir } = setup({
      info: info({ subtitles: {}, automatic_captions: { en: track, vi: track, fr: track, 'zh-CN': track } }),
      files: { 'en.vtt': fixture('auto.vtt'), 'vi.vtt': fixture('manual.vtt'), 'fr.vtt': 'x' },
    })
    const result = await fetchSubtitles(ID, deps)
    expect(result).toMatchObject({ title: 'A talk', channel: 'TED', durationSec: 612.5, kind: 'auto' })
    expect(result.en).toEqual({ text: fixture('auto.vtt'), format: 'vtt' })
    expect(result.vi).toEqual({ text: fixture('manual.vtt'), format: 'vtt' })
    expect(tools.calls).toHaveLength(2)
    expect(tools.calls[0].args).toEqual(
      expect.arrayContaining(['--dump-single-json', '--skip-download', '--', `https://www.youtube.com/watch?v=${ID}`]),
    )
    const download = tools.calls[1].args
    expect(argAfter(download, '--sub-langs')).toBe('en,vi')
    expect(argAfter(download, '--sub-format')).toBe('json3/vtt')
    expect(download).toEqual(expect.arrayContaining(['--skip-download', '--write-auto-subs']))
    expect(readdirSync(tmpDir)).toEqual([])
  })

  it('prefers subtitles written by people, and the original auto track over a translated one', async () => {
    const manual = setup({
      info: info({ subtitles: { 'en-US': [{ ext: 'json3' }] }, automatic_captions: { en: track } }),
      files: { 'en-US.json3': '{"events":[]}' },
    })
    const result = await fetchSubtitles(ID, manual.deps)
    expect(result.kind).toBe('manual')
    expect(result.en.format).toBe('json3')
    expect(result.vi).toBeUndefined()
    expect(argAfter(manual.tools.calls[1].args, '--sub-langs')).toBe('en-US')
    expect(manual.tools.calls[1].args).toContain('--write-subs')

    const orig = setup({
      info: info({ automatic_captions: { en: track, 'en-orig': track } }),
      files: { 'en-orig.vtt': fixture('auto.vtt') },
    })
    await fetchSubtitles(ID, orig.deps)
    expect(argAfter(orig.tools.calls[1].args, '--sub-langs')).toBe('en-orig')
  })

  it('refuses a video that is not in English: its auto English track would be a translation', async () => {
    const { tools, deps } = setup({ info: info({ language: 'vi', automatic_captions: { en: track, vi: track } }) })
    await expect(fetchSubtitles(ID, deps)).rejects.toMatchObject({
      code: 'NO_SUBTITLES',
      message: expect.stringContaining('not in English'),
    })
    expect(tools.calls).toHaveLength(1)
  })

  it('fails with NO_SUBTITLES, after listing only, when there is no English track', async () => {
    const { tools, deps } = setup({ info: info({ automatic_captions: { fr: track } }) })
    await expect(fetchSubtitles(ID, deps)).rejects.toMatchObject({ code: 'NO_SUBTITLES' })
    expect(tools.calls).toHaveLength(1)
  })

  it('names the missing tool, a time-out, an unavailable video and a refused download', async () => {
    await expect(fetchSubtitles(ID, setup({ fail: new ToolError('missing', 'x') }).deps)).rejects.toMatchObject({ code: 'NO_YTDLP' })
    await expect(fetchSubtitles(ID, setup({ fail: new ToolError('timeout', 'x') }).deps)).rejects.toMatchObject({ code: 'TIMEOUT' })
    const gone = fetchSubtitles(ID, setup({ code: 1, stderr: 'ERROR: [youtube] dQw4w9WgXcQ: Video unavailable\n' }).deps)
    await expect(gone).rejects.toMatchObject({ code: 'FETCH_FAILED', message: expect.stringContaining('Video unavailable') })
    const limited = setup({
      info: info({ automatic_captions: { en: track } }),
      downloadCode: 1,
      stderr: "ERROR: Unable to download video subtitles for 'en': HTTP Error 429: Too Many Requests\n",
    })
    await expect(fetchSubtitles(ID, limited.deps)).rejects.toMatchObject({ code: 'FETCH_FAILED', message: expect.stringContaining('429') })
  })

  it('never runs anything for a value that is not a video id', async () => {
    const { tools, deps } = setup({ info: info() })
    const error = await fetchSubtitles('abc; rm -rf ~', deps).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(DictationFailure)
    expect((error as DictationFailure).code).toBe('BAD_VIDEO')
    expect(tools.calls).toEqual([])
  })
})
