// @vitest-environment node
import type { Rpc } from './args'
import { fakeRepo } from './fakes'
import { createLibrary } from './library'
import { createStudyTools } from './study'
import type { ICardProgress } from '@/utils/db/record'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 28, 10, 0, 0).getTime()
const HOUR = 60 * 60 * 1000

const card = (word: string, state: ICardProgress['state'], due: number): ICardProgress => ({
  dict: 'birds',
  word,
  state,
  due,
  interval: 1,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: NOW - 48 * HOUR,
  lastReviewed: NOW - 24 * HOUR,
})

function setup(answers: Record<string, unknown>, fetchFn?: typeof fetch) {
  const calls: { name: string; args: unknown[] }[] = []
  const rpc: Rpc = async (name, args) => {
    calls.push({ name, args })
    if (name === 'sets.list') return []
    return answers[name] ?? null
  }
  const tools = createStudyTools(rpc, createLibrary(rpc, fakeRepo()), { baseUrl: 'http://127.0.0.1:5199', now: () => NOW, fetchFn })
  const run = (name: string, args: Record<string, unknown> = {}) =>
    (tools.find((t) => t.name === name) as { run: (a: Record<string, unknown>) => Promise<unknown> }).run(args) as Promise<
      Record<string, unknown>
    >
  return { calls, run }
}

const record = (word: string, at: number, wrongCount: number, dict = 'birds') => ({
  id: 1,
  word,
  dict,
  chapter: 0,
  timeStamp: Math.floor(at / 1000),
  timing: [],
  wrongCount,
  mistakes: {},
})

describe('the study tools', () => {
  it('counts new, learning, review and due cards of a dictionary', async () => {
    const { run } = setup({ 'cards.byDict': [card('wren', 'learning', NOW - HOUR), card('finch', 'review', NOW + 20 * HOUR)] })
    const overview = await run('flashcard_overview', { dict: 'birds' })
    expect(overview).toMatchObject({ words: 2, new: 0, learning: 1, review: 1, dueNow: 1, dueToday: 1 })
    expect(overview.next).toEqual([{ word: 'finch', due: new Date(NOW + 20 * HOUR).toISOString() }])
  })

  it('maps a grade to cards.review and refuses a word that is not in the dictionary', async () => {
    const { calls, run } = setup({ 'cards.review': card('wren', 'review', NOW + 24 * HOUR) })
    const graded = await run('grade_flashcard', { dict: 'birds', word: 'wren', grade: 'good' })
    expect(calls.find((c) => c.name === 'cards.review')?.args).toEqual(['birds', 'wren', 'good'])
    expect(graded.card).toMatchObject({ word: 'wren', due: new Date(NOW + 24 * HOUR).toISOString() })
    await expect(run('grade_flashcard', { dict: 'birds', word: 'eagle', grade: 'good' })).rejects.toThrow(/not in/)
  })

  it('groups mistakes by word and sorts them by how many', async () => {
    const { run } = setup({
      'words.wrong': [record('wren', NOW - HOUR, 1), record('finch', NOW - 2 * HOUR, 2), record('wren', NOW - 3 * HOUR, 3)],
    })
    const result = await run('mistake_words')
    expect(result.words).toEqual([
      { word: 'wren', dict: 'birds', mistakes: 4, times: 2, last: new Date(Math.floor((NOW - HOUR) / 1000) * 1000).toISOString() },
      { word: 'finch', dict: 'birds', mistakes: 2, times: 1, last: new Date(Math.floor((NOW - 2 * HOUR) / 1000) * 1000).toISOString() },
    ])
  })

  it('groups the typing history per local day and asks for the range in seconds', async () => {
    const yesterday = NOW - 24 * HOUR
    const { calls, run } = setup({
      'words.between': [record('wren', yesterday, 1), record('wren', yesterday + HOUR, 0), record('finch', NOW, 2)],
    })
    const result = await run('typing_history', { from: '2026-10-27', to: '2026-10-28' })
    expect(result.days).toEqual([
      { day: '2026-10-27', words: 2, mistakes: 1, distinctWords: 1 },
      { day: '2026-10-28', words: 1, mistakes: 2, distinctWords: 1 },
    ])
    const [from, to] = calls.find((c) => c.name === 'words.between')?.args as number[]
    expect(from).toBe(new Date(2026, 9, 27).getTime() / 1000)
    expect(to).toBe(Math.floor((new Date(2026, 9, 29).getTime() - 1) / 1000))
  })

  it('saves a backup to a new file and refuses an existing one', async () => {
    const fetchFn = (async () => new Response(new Uint8Array([31, 139, 8]), { status: 200 })) as unknown as typeof fetch
    const { run } = setup({}, fetchFn)
    const dir = mkdtempSync(join(tmpdir(), 'qwerty-mcp-backup-'))
    const path = join(dir, 'backup.json.gz')
    expect(await run('backup_data', { path })).toEqual({ path, bytes: 3 })
    expect(Array.from(readFileSync(path))).toEqual([31, 139, 8])
    writeFileSync(join(dir, 'old.json.gz'), 'x')
    await expect(run('backup_data', { path: join(dir, 'old.json.gz') })).rejects.toThrow(/exists/)
  })
})
