// @vitest-environment node
import { start } from './main'
import type { RunningServer } from './main'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let root: string
const running: RunningServer[] = []
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'qwerty-main-'))
})
afterEach(async () => {
  for (const server of running.splice(0)) await server.stop()
  rmSync(root, { recursive: true, force: true })
})

const begin = async (role: 'dev' | 'stable' = 'dev', dir = join(root, 'data'), now?: () => number) => {
  const server = await start({ role, dir, port: 0, staticDir: undefined }, { now, backupEveryMs: 3_600_000, log: () => undefined })
  running.push(server)
  return server
}
const rpc = async (server: RunningServer, name: string, ...args: unknown[]) => {
  const response = await fetch(`${server.url}/api/rpc/${name}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ args }),
  })
  return (await response.json()) as { result?: unknown; error?: { code: string } }
}

describe('start', () => {
  it('serves the data folder over HTTP on the port it reports', async () => {
    const server = await begin()
    expect(server.port).toBeGreaterThan(0)
    expect(server.url).toBe(`http://127.0.0.1:${server.port}`)
    expect(await rpc(server, 'meta.set', 'k', 'v')).toEqual({ result: null })
    expect(await rpc(server, 'meta.getAll')).toEqual({ result: { k: 'v' } })
  })

  it('keeps what was written when the server is stopped and started again on the same folder', async () => {
    const dir = join(root, 'data')
    const first = await begin('dev', dir)
    await rpc(first, 'meta.set', 'k', 'kept')
    await first.stop()
    running.splice(running.indexOf(first), 1)

    const second = await begin('dev', dir)
    expect(await rpc(second, 'meta.getAll')).toEqual({ result: { k: 'kept' } })
  })

  it('refuses a second server on a folder that is in use, and a server with the other role', async () => {
    const dir = join(root, 'data')
    await begin('dev', dir)
    await expect(begin('dev', dir)).rejects.toMatchObject({ code: 'LOCKED' })
    await running[0].stop()
    running.length = 0
    await expect(begin('stable', dir)).rejects.toMatchObject({ code: 'ROLE_MISMATCH' })
  })

  it('makes the backup of the day when it starts', async () => {
    const dir = join(root, 'data')
    await begin('dev', dir, () => new Date(2026, 9, 20, 9, 30).getTime())
    expect(readdirSync(join(dir, 'backups'))).toEqual(['qwerty-2026-10-20.db'])
  })

  it('stops cleanly: the port is closed and the lock file is released', async () => {
    const dir = join(root, 'data')
    const server = await begin('dev', dir)
    await server.stop()
    running.length = 0
    expect(existsSync(join(dir, 'server.lock'))).toBe(false)
    await expect(fetch(`${server.url}/api/health`)).rejects.toThrow()
  })

  it('does not leave the folder locked when the port cannot be opened', async () => {
    const first = await begin('dev', join(root, 'a'))
    await expect(
      start({ role: 'dev', dir: join(root, 'b'), port: first.port, staticDir: undefined }, { log: () => undefined }),
    ).rejects.toThrow()
    expect(existsSync(join(root, 'b', 'server.lock'))).toBe(false)
  })
})
