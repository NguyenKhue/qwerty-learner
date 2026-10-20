import { openDb } from '../../server/adapter'
import type { Db } from '../../server/adapter'
import { startServer } from '../../server/http'
import { ensureSchema } from '../../server/schema'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach } from 'vitest'

const TABLES = ['word_records', 'chapter_records', 'review_records', 'custom_dicts', 'card_progress', 'review_log', 'meta']

export type TestServer = {
  /** The server's own database: arrange and assert with the repositories in `server/repo` or with plain SQL. */
  db: Db
  url: string
  /** Empties every table and restarts the ids. */
  reset(): void
  close(): Promise<void>
}

/**
 * Starts the real data server (in-memory database, a free port on this machine) and sends the `/api/...` requests of the code under
 * test to it, so the data layer of the app runs against the real server logic exactly as it does in the browser.
 */
export async function installTestServer(): Promise<TestServer> {
  const db = openDb(':memory:')
  ensureSchema(db)
  const dir = mkdtempSync(join(tmpdir(), 'qwerty-test-server-'))
  const server = await startServer({ db, role: 'dev', dir, port: 0 })
  const url = `http://127.0.0.1:${server.port}`
  const realFetch = globalThis.fetch

  const routed = ((input: RequestInfo | URL, init?: RequestInit) =>
    typeof input === 'string' && input.startsWith('/api/') ? realFetch(url + input, init) : realFetch(input, init)) as typeof fetch
  ;(routed as unknown as { isTestServer: boolean }).isTestServer = true
  globalThis.fetch = routed

  return {
    db,
    url,
    reset() {
      for (const table of TABLES) db.exec(`DELETE FROM ${table}`)
      db.exec('DELETE FROM sqlite_sequence')
    },
    async close() {
      globalThis.fetch = realFetch
      await server.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

/** Registers the hooks of a test suite: one server for the suite, emptied before every test. Returns a handle whose `db` is current. */
export function withTestServer(): { readonly db: Db } {
  let current: TestServer | null = null
  beforeAll(async () => {
    current = await installTestServer()
  })
  beforeEach(() => current?.reset())
  afterAll(async () => {
    await current?.close()
    current = null
  })
  return {
    get db() {
      if (!current) throw new Error('The test server is not running yet: use it inside a test or a hook')
      return current.db
    },
  }
}
