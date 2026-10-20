import { useTestServer } from './serverHarness'
import { call } from '@/data/rpc'
import { describe, expect, it } from 'vitest'

describe('the in-process test server', () => {
  const server = useTestServer()

  it('answers the same calls the app makes, through the real server logic', async () => {
    await call('meta.set', 'k', 'v')
    expect(await call('meta.getAll')).toEqual({ k: 'v' })
    expect(server.db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'k'")?.value).toBe('v')
  })

  it('starts every test from an empty database', async () => {
    expect(await call('meta.getAll')).toEqual({})
    expect(server.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM card_progress')?.n).toBe(0)
  })

  it('restarts the ids too, so a test can rely on the first id being 1', async () => {
    const first = await call('words.add', { word: 'a', timeStamp: 1, dict: 'd', chapter: 0, timing: [], wrongCount: 0, mistakes: {} })
    expect(first).toBe(1)
  })

  it('maps an error of the server to a DataError like the real app sees it', async () => {
    await expect(call('sets.update', 'missing', { name: 'x', words: [] })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('without the helper', () => {
  it('the previous suite put the real fetch back', () => {
    expect((globalThis.fetch as unknown as { isTestServer?: boolean }).isTestServer).toBeUndefined()
  })
})
