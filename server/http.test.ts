// @vitest-environment node
import { openDb } from './adapter'
import type { Db } from './adapter'
import { startServer } from './http'
import type { AppDeps, RunningServer } from './http'
import { ProcedureError } from './procedures/index'
import { ensureSchema } from './schema'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

type ResponseHeaders = { get(name: string): string | null }
type Answer = { status: number; headers: ResponseHeaders; text: string; json: unknown }
type Download = { status: number; headers: ResponseHeaders; bytes: Buffer }
type Health = {
  ok: boolean
  schemaVersion: number
  role: string
  dataDir: string
  dbBytes: number
  empty: boolean
  migrated: boolean
}
type ImportResult = { counts: Record<string, number>; warnings: string[] }
type RawAnswer = { status: number; headers: IncomingHttpHeaders; text: string }

type Extra = { db: Db; dir: string; running: RunningServer; base: string }

let db: Db | undefined
let dir = ''
let running: RunningServer | undefined
let base = ''
const extras: Extra[] = []

function currentServer(): RunningServer {
  if (!running) throw new Error('The server is not running')
  return running
}

function currentDb(): Db {
  if (!db) throw new Error('The database is not open')
  return db
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((done) => setTimeout(done, ms))
}

async function waitUntil(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('Timed out waiting for the condition')
    await wait(10)
  }
}

async function asAnswer(response: { status: number; headers: ResponseHeaders; text(): Promise<string> }): Promise<Answer> {
  const text = await response.text()
  let json: unknown = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: response.status, headers: response.headers, text, json }
}

async function get(path: string): Promise<Answer> {
  return asAnswer(await fetch(`${base}${path}`))
}

async function getAt(baseUrl: string, path: string): Promise<Answer> {
  return asAnswer(await fetch(`${baseUrl}${path}`))
}

async function post(path: string, body: string | Uint8Array, contentType: string): Promise<Answer> {
  return asAnswer(await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': contentType }, body }))
}

async function postAt(baseUrl: string, path: string, body: string | Uint8Array, contentType: string): Promise<Answer> {
  return asAnswer(await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'content-type': contentType }, body }))
}

function rpc(name: string, args: unknown[] = []): Promise<Answer> {
  return post(`/api/rpc/${name}`, JSON.stringify({ args }), 'application/json')
}

function rpcAt(baseUrl: string, name: string, args: unknown[] = []): Promise<Answer> {
  return postAt(baseUrl, `/api/rpc/${name}`, JSON.stringify({ args }), 'application/json')
}

async function download(path: string): Promise<Download> {
  const response = await fetch(`${base}${path}`)
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) }
}

function errorCode(answer: Answer): string | undefined {
  const body = answer.json as { error?: { code?: string } } | null
  return body?.error?.code
}

function rawRequest(opts: { method?: string; path: string; headers?: Record<string, string> }): Promise<RawAnswer> {
  return new Promise<RawAnswer>((resolveAnswer, reject) => {
    const req = request(
      { host: '127.0.0.1', port: currentServer().port, method: opts.method ?? 'GET', path: opts.path, headers: opts.headers },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          text += chunk
        })
        res.on('end', () => resolveAnswer({ status: res.statusCode ?? 0, headers: res.headers, text }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

type Sse = {
  text(): string
  frames(): number
  waitFor(needle: string, timeoutMs?: number): Promise<void>
  close(): void
  ended(): boolean
}

async function openSse(): Promise<Sse> {
  let text = ''
  let ended = false
  let response: IncomingMessage | undefined
  const req = request({ host: '127.0.0.1', port: currentServer().port, path: '/api/events', method: 'GET' })
  req.end()

  await new Promise<void>((connected, reject) => {
    req.once('response', (res) => {
      response = res
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        text += chunk
      })
      res.on('end', () => {
        ended = true
      })
      res.on('close', () => {
        ended = true
      })
      res.on('error', reject)
      connected()
    })
    req.on('error', reject)
  })

  return {
    text: () => text,
    frames: () => (text.match(/event: change/g) ?? []).length,
    waitFor: (needle, timeoutMs = 3000) => waitUntil(() => text.includes(needle), timeoutMs),
    close: () => {
      response?.destroy()
      req.destroy()
    },
    ended: () => ended,
  }
}

async function startExtra(): Promise<Extra> {
  const extraDir = mkdtempSync(join(tmpdir(), 'qwerty-http-import-'))
  const extraDb = openDb(':memory:')
  ensureSchema(extraDb)
  const extra = await startServer({ db: extraDb, role: 'dev', dir: extraDir, port: 0, heartbeatMs: 20 })
  const extraEntry = { db: extraDb, dir: extraDir, running: extra, base: `http://127.0.0.1:${extra.port}` }
  extras.push(extraEntry)
  return extraEntry
}

async function startDefault(): Promise<void> {
  running = await startServer({ db: currentDb(), role: 'dev', dir, port: 0, heartbeatMs: 20 })
  base = `http://127.0.0.1:${running.port}`
}

async function restart(overrides: Partial<AppDeps> = {}): Promise<void> {
  if (running) await running.close()
  running = await startServer({ db: currentDb(), role: 'dev', dir, port: 0, heartbeatMs: 20, ...overrides })
  base = `http://127.0.0.1:${running.port}`
}

const WORD = { word: 'apple', dict: 'd', timeStamp: 1, chapter: null, wrongCount: 0, timing: [], mistakes: {} }

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'qwerty-http-'))
  db = openDb(':memory:')
  ensureSchema(db)
  await startDefault()
})

afterEach(async () => {
  for (const extra of extras.splice(0)) {
    await extra.running.close()
    extra.db.close()
    rmSync(extra.dir, { recursive: true, force: true })
  }
  if (running) await running.close()
  running = undefined
  if (db) db.close()
  db = undefined
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = ''
  base = ''
})

describe('RPC', () => {
  it('round trips meta.set and meta.getAll', async () => {
    const saved = await rpc('meta.set', ['greeting', 'hi'])
    expect(saved.status).toBe(200)
    expect(saved.json).toEqual({ result: null })

    const all = await rpc('meta.getAll')
    expect(all.status).toBe(200)
    expect(all.json).toEqual({ result: { greeting: 'hi' } })
  })

  it('answers 404 for an unknown procedure', async () => {
    const answer = await rpc('nope.nothing')
    expect(answer.status).toBe(404)
    expect(errorCode(answer)).toBe('NOT_FOUND')
  })

  it('answers 400 for malformed JSON', async () => {
    const answer = await post('/api/rpc/meta.getAll', '{not json', 'application/json')
    expect(answer.status).toBe(400)
    expect(errorCode(answer)).toBe('BAD_REQUEST')
  })

  it('answers 400 when args is not an array', async () => {
    const answer = await post('/api/rpc/meta.set', JSON.stringify({ args: 'nope' }), 'application/json')
    expect(answer.status).toBe(400)
    expect(errorCode(answer)).toBe('BAD_REQUEST')

    const empty = await post('/api/rpc/meta.set', JSON.stringify({}), 'application/json')
    expect(empty.status).toBe(400)
    expect(errorCode(empty)).toBe('BAD_REQUEST')
  })

  it('maps a ProcedureError to its own code', async () => {
    await restart({
      procedures: {
        'meta.getAll': () => {
          throw new ProcedureError('NOT_FOUND', 'The flag is missing')
        },
      },
    })

    const answer = await rpc('meta.getAll')
    expect(answer.status).toBe(404)
    expect(answer.json).toEqual({ error: { code: 'NOT_FOUND', message: 'The flag is missing' } })
  })

  it('maps any other error to 500 INTERNAL without a stack', async () => {
    await restart({
      procedures: {
        'meta.getAll': () => {
          throw new Error('something broke')
        },
      },
    })

    const answer = await rpc('meta.getAll')
    expect(answer.status).toBe(500)
    expect(errorCode(answer)).toBe('INTERNAL')
    expect((answer.json as { error: { message: string } }).error.message).toBe('something broke')
    expect(answer.text).not.toContain('stack')
    expect(answer.text).not.toContain('at ')
  })

  it('refuses a Host header that is not this machine', async () => {
    const denied = await rawRequest({ path: '/api/health', headers: { host: 'evil.example' } })
    expect(denied.status).toBe(403)
    expect(JSON.parse(denied.text)).toEqual({ error: { code: 'BAD_REQUEST', message: 'Host not allowed' } })

    const allowed = await rawRequest({ path: '/api/health', headers: { host: 'localhost:1234' } })
    expect(allowed.status).toBe(200)
  })

  it('also accepts names under .localhost, which only ever resolve to this machine, but not look-alikes', async () => {
    expect((await rawRequest({ path: '/api/health', headers: { host: 'qwerty.localhost' } })).status).toBe(200)
    expect((await rawRequest({ path: '/api/health', headers: { host: 'qwerty.localhost:8443' } })).status).toBe(200)
    expect((await rawRequest({ path: '/api/health', headers: { host: 'localhost.evil.example' } })).status).toBe(403)
    expect((await rawRequest({ path: '/api/health', headers: { host: 'evil-localhost' } })).status).toBe(403)
    expect((await rawRequest({ path: '/api/health', headers: { host: 'evillocalhost.com' } })).status).toBe(403)
  })
})

describe('health', () => {
  it('reports an empty folder, then data and the migration marker', async () => {
    const initial = (await get('/api/health')).json as Health
    expect(initial).toMatchObject({
      ok: true,
      schemaVersion: 1,
      role: 'dev',
      dataDir: dir,
      dbBytes: 0,
      empty: true,
      migrated: false,
    })

    const added = await rpc('words.add', [WORD])
    expect(added.status).toBe(200)

    const withData = (await get('/api/health')).json as Health
    expect(withData.empty).toBe(false)
    expect(withData.migrated).toBe(false)

    await rpc('meta.set', ['migratedAt', '2026-10-20T00:00:00.000Z'])
    const migrated = (await get('/api/health')).json as Health
    expect(migrated.migrated).toBe(true)
  })
})

describe('export', () => {
  it('downloads a consistent database copy that opens and holds the rows', async () => {
    await rpc('words.add', [WORD])

    const answer = await download('/api/export/db')
    expect(answer.status).toBe(200)
    expect(answer.headers.get('content-type')).toBe('application/octet-stream')
    expect(answer.headers.get('content-disposition')).toMatch(/^attachment; filename="qwerty-\d{4}-\d{2}-\d{2}\.db"$/)

    const file = join(dir, 'downloaded.db')
    writeFileSync(file, answer.bytes)
    const copy = openDb(file)
    try {
      const words = copy.all<{ word: string }>('SELECT word FROM word_records').map((row) => row.word)
      expect(words).toEqual(['apple'])
    } finally {
      copy.close()
    }
  })

  it('downloads the Dexie JSON, gzipped', async () => {
    await rpc('words.add', [WORD])

    const answer = await download('/api/export/json')
    expect(answer.status).toBe(200)
    expect(answer.headers.get('content-type')).toBe('application/gzip')
    expect(answer.headers.get('content-disposition')).toMatch(/^attachment; filename="qwerty-\d{4}-\d{2}-\d{2}\.json\.gz"$/)

    const parsed = JSON.parse(gunzipSync(answer.bytes).toString('utf8')) as {
      formatName: string
      formatVersion: number
      data: { databaseName: string; data: { tableName: string; rows: Record<string, unknown>[] }[] }
    }
    expect(parsed.formatName).toBe('dexie')
    expect(parsed.formatVersion).toBe(1)
    expect(parsed.data.databaseName).toBe('RecordDB')

    const table = parsed.data.data.find((entry) => entry.tableName === 'wordRecords')
    expect(table?.rows.map((row) => row.word)).toEqual(['apple'])
  })
})

describe('import', () => {
  it('round trips the JSON export into a second app and keeps a backup', async () => {
    await rpc('words.add', [WORD])
    const exported = await download('/api/export/json')

    const second = await startExtra()
    const seeded = await rpcAt(second.base, 'words.add', [{ ...WORD, word: 'pear' }])
    expect(seeded.status).toBe(200)

    const imported = await postAt(second.base, '/api/import', new Uint8Array(exported.bytes), 'application/gzip')
    expect(imported.status).toBe(200)
    const result = (imported.json as { result: ImportResult }).result
    expect(result.counts.wordRecords).toBe(1)
    const importedWords = second.db.all<{ word: string }>('SELECT word FROM word_records').map((row) => row.word)
    expect(importedWords).toEqual(['apple'])

    const health = (await getAt(second.base, '/api/health')).json as Health
    expect(health.empty).toBe(false)

    const backups = readdirSync(join(second.dir, 'backups'))
    const backupName = backups.find((name) => /^before-import-.+\.db$/.test(name))
    if (!backupName) throw new Error('No before-import backup was written')
    const backupPath = join(second.dir, 'backups', backupName)
    const backup = openDb(backupPath)
    try {
      const backupWords = backup.all<{ word: string }>('SELECT word FROM word_records').map((row) => row.word)
      expect(backupWords).toEqual(['pear'])
    } finally {
      backup.close()
    }
  })

  it('answers 400 for a file that is not an export', async () => {
    const answer = await post('/api/import', Buffer.from('definitely not gzip'), 'application/gzip')
    expect(answer.status).toBe(400)
    expect(errorCode(answer)).toBe('BAD_REQUEST')
    expect((answer.json as { error: { message: string } }).error.message).toMatch(/^IMPORT_INVALID:/)
  })
})

describe('events', () => {
  it('publishes a change after a write to every client and nothing after a read', async () => {
    const first = await openSse()
    const second = await openSse()
    await first.waitFor(': connected')
    await second.waitFor(': connected')

    const reviewed = await rpc('cards.review', ['d', 'apple', 'good'])
    expect(reviewed.status).toBe(200)

    const frame = '"topics":["cards:d","reviewLog"]'
    await first.waitFor(frame)
    await second.waitFor(frame)
    expect(first.frames()).toBe(1)

    const read = await rpc('cards.byDict', ['d'])
    expect(read.status).toBe(200)
    await wait(150)
    expect(first.frames()).toBe(1)
    expect(second.frames()).toBe(1)

    first.close()
    second.close()
  })

  it('keeps publishing when a client disconnects', async () => {
    const alive = await openSse()
    const gone = await openSse()
    await alive.waitFor(': connected')
    await gone.waitFor(': connected')

    gone.close()
    await wait(50)

    const answer = await rpc('meta.set', ['k', 'v'])
    expect(answer.status).toBe(200)
    await alive.waitFor('"topics":["meta"]')
    alive.close()
  })

  it('sends comment heartbeats', async () => {
    const client = await openSse()
    await client.waitFor(': ping', 3000)
    client.close()
  })

  it('close ends open streams and resolves', async () => {
    const client = await openSse()
    await client.waitFor(': connected')

    await currentServer().close()
    await waitUntil(() => client.ended(), 3000)
  })
})

describe('static files', () => {
  it('serves files, falls back to index.html, and refuses traversal', async () => {
    const site = join(dir, 'site')
    mkdirSync(join(site, 'assets'), { recursive: true })
    writeFileSync(join(site, 'index.html'), '<html>index</html>')
    writeFileSync(join(site, 'assets', 'x.js'), 'console.log(1)')
    writeFileSync(join(dir, 'secret.txt'), 'secret')
    await restart({ staticDir: site })

    const root = await get('/')
    expect(root.status).toBe(200)
    expect(root.text).toBe('<html>index</html>')
    expect(root.headers.get('content-type')).toContain('text/html')
    expect(root.headers.get('cache-control')).toBe('no-cache')

    const clientRoute = await get('/my-sets/abc')
    expect(clientRoute.status).toBe(200)
    expect(clientRoute.text).toBe('<html>index</html>')

    const asset = await get('/assets/x.js')
    expect(asset.status).toBe(200)
    expect(asset.text).toBe('console.log(1)')
    expect(asset.headers.get('content-type')).toMatch(/application\/javascript|text\/javascript/)
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')

    const traversal = await rawRequest({ path: '/..%2fsecret.txt' })
    expect([403, 404]).toContain(traversal.status)

    const missingApi = await get('/api/nothing')
    expect(missingApi.status).toBe(404)
    expect(errorCode(missingApi)).toBe('NOT_FOUND')
  })

  it('answers 404 for a non-api request without staticDir', async () => {
    const answer = await get('/')
    expect(answer.status).toBe(404)
    expect(errorCode(answer)).toBe('NOT_FOUND')
  })
})
