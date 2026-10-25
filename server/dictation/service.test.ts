// @vitest-environment node
import { openDb } from '../adapter'
import { getVideo } from '../repo/videos'
import { ensureSchema } from '../schema'
import { fakeTools } from './fakes'
import type { FakeYtDlp } from './fakes'
import { createDictationService } from './service'
import { ToolError } from './tools'
import auto from '@/utils/dictation/fixtures/auto.json3.json'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'
const info = { title: 'Memory', channel: 'TED', duration: 20, language: 'en', automatic_captions: { en: [{}], vi: [{}] } }
/** A Vietnamese track whose only line falls inside the second sentence of the auto fixture (8 s to 10.5 s). */
const vi = { events: [{ tStartMs: 8100, dDurationMs: 1500, segs: [{ utf8: 'và tại sao chúng ta quên' }] }] }

function setup(ytDlp: FakeYtDlp, translate?: Parameters<typeof fakeTools>[0]['translate']) {
  const db = openDb(':memory:')
  ensureSchema(db)
  const tools = fakeTools({ ytDlp, translate })
  const published: string[][] = []
  const service = createDictationService({
    db,
    runTool: tools.runTool,
    tools: { ytDlp: 'yt-dlp', claude: 'claude' },
    publish: (topics) => published.push(topics),
    now: () => 42,
  })
  return { db, tools, service, published }
}

/** One preparation lists the video once (then downloads its tracks). */
const ytCalls = (calls: { command: string; args: string[] }[]) =>
  calls.filter((c) => c.command === 'yt-dlp' && c.args.indexOf('--dump-single-json') !== -1).length

describe('the dictation service', () => {
  it('prepares a video: sentences, Vietnamese from YouTube where it has it and from the CLI for the rest', async () => {
    const { db, service, published } = setup({ info, files: { 'en.json3': JSON.stringify(auto), 'vi.json3': JSON.stringify(vi) } })
    expect(service.status(ID)).toEqual({ state: 'idle' })
    expect(service.prepare(ID).state).toBe('running')
    await service.idle()
    expect(service.status(ID)).toEqual({ state: 'ready' })
    const video = getVideo(db, ID)
    expect(video).toMatchObject({ title: 'Memory', channel: 'TED', durationSec: 20, subtitleKind: 'auto', preparedAt: 42 })
    expect(video?.sentences.map((s) => [s.en, s.viSource])).toEqual([
      ["so today we're going to talk about how memory works", 'ai'],
      ['and why we forget things', 'youtube'],
    ])
    expect(video?.sentences[1].vi).toBe('và tại sao chúng ta quên')
    expect(published).toContainEqual([`dictation:${ID}`])
    expect(published[published.length - 1]).toEqual(['dictation', `dictation:${ID}`])
  })

  it('shares one job between two calls and does not fetch a cached video again', async () => {
    const { tools, service } = setup({ info, files: { 'en.json3': JSON.stringify(auto) } })
    service.prepare(ID)
    service.prepare(ID)
    await service.idle()
    expect(ytCalls(tools.calls)).toBe(1)
    expect(service.prepare(ID)).toEqual({ state: 'ready' })
    await service.idle()
    expect(ytCalls(tools.calls)).toBe(1)
  })

  it('ends in NO_SUBTITLES and stores nothing when the subtitles are only sound tags', async () => {
    const onlyMusic = { events: [{ tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: '[Music]' }] }] }
    const { db, service } = setup({ info, files: { 'en.json3': JSON.stringify(onlyMusic) } })
    service.prepare(ID)
    await service.idle()
    expect(service.status(ID)).toMatchObject({ state: 'error', error: { code: 'NO_SUBTITLES' } })
    expect(getVideo(db, ID)).toBeNull()
  })

  it('starts again after a failure', async () => {
    const { tools, service } = setup({ fail: new ToolError('missing', 'no yt-dlp') })
    service.prepare(ID)
    await service.idle()
    expect(service.status(ID)).toMatchObject({ state: 'error', error: { code: 'NO_YTDLP' } })
    expect(service.prepare(ID).state).toBe('running')
    await service.idle()
    expect(ytCalls(tools.calls)).toBe(2)
  })

  it('keeps a usable video with a note when the translation fails', async () => {
    const { db, service } = setup({ info, files: { 'en.json3': JSON.stringify(auto) } }, () => new ToolError('missing', 'no claude'))
    service.prepare(ID)
    await service.idle()
    const video = getVideo(db, ID)
    expect(video?.sentences).toHaveLength(2)
    expect(video?.sentences.every((s) => s.vi === undefined)).toBe(true)
    expect(video?.note).toMatch(/Vietnamese/)
  })

  it('refuses a value that is not a video id without running anything', async () => {
    const { tools, service } = setup({ info, files: { 'en.json3': JSON.stringify(auto) } })
    expect(service.prepare('../../etc')).toMatchObject({ state: 'error', error: { code: 'BAD_VIDEO' } })
    await service.idle()
    expect(tools.calls).toEqual([])
  })
})
