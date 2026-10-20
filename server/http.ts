import type { Db } from './adapter'
import { createEventHub } from './events'
import { exportDexieJson, importDexieJson, snapshotDb } from './exchange'
import type { Role } from './folder'
import { ProcedureError, handlers } from './procedures/index'
import type { Handler } from './procedures/index'
import { getAll as getAllMeta } from './repo/meta'
import { SCHEMA_VERSION } from './schema'
import { PROCEDURE_NAMES, topicsOf } from '@/data/contract'
import type { ProcedureName } from '@/data/contract'
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, resolve, sep } from 'node:path'

export type AppDeps = {
  db: Db
  role: Role
  dir: string
  staticDir?: string
  now?: () => number
  heartbeatMs?: number
  procedures?: Partial<Record<ProcedureName, Handler>>
}

export type App = {
  handle(req: IncomingMessage, res: ServerResponse): void
  publish(topics: string[]): void
  close(): void
}

export type RunningServer = { port: number; close(): Promise<void> }

type ErrorCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL'

const RPC_LIMIT = 64 * 1024 * 1024
const IMPORT_LIMIT = 256 * 1024 * 1024
const NO_CACHE = 'no-cache'
const IMMUTABLE = 'public, max-age=31536000, immutable'

/** The tables that describe whether the folder holds any learning data. */
const EMPTY_TABLES = ['word_records', 'chapter_records', 'review_records', 'custom_dicts', 'card_progress', 'review_log']

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.mjs': 'application/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const STATUS: Record<ErrorCode, number> = { BAD_REQUEST: 400, NOT_FOUND: 404, CONFLICT: 409, INTERNAL: 500 }

/** The request body crossed the endpoint's size limit. */
class BodyTooLarge extends Error {}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function sendError(res: ServerResponse, status: number, code: ErrorCode, message: string): void {
  sendJson(res, status, { error: { code, message } })
}

/** The Host header may name only this machine (localhost, a loopback address or a `.localhost` name); any port is fine. */
function hostAllowed(host: string | undefined): boolean {
  if (!host) return false
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    return false
  }
  // `*.localhost` names (such as qwerty.localhost) are resolved to this machine by the browser itself
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')
}

/** Reads a request body up to `limit` bytes, rejecting a larger one without buffering it. */
function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise<Buffer>((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    let settled = false

    const settle = (error: Error | null, body?: Buffer) => {
      if (settled) return
      settled = true
      if (error) reject(error)
      else resolveBody(body ?? Buffer.alloc(0))
    }

    req.on('data', (chunk: Buffer | string) => {
      if (settled) return
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += part.length
      if (size > limit) {
        settle(new BodyTooLarge())
        return
      }
      chunks.push(part)
    })
    req.on('end', () => settle(null, Buffer.concat(chunks)))
    req.on('error', (error) => settle(error))
  })
}

/** The local date of a millisecond value as YYYY-MM-DD (never computed on behalf of the browser). */
function localDate(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function contentLength(length: number): { 'content-length': string } {
  return { 'content-length': String(length) }
}

/** Builds the whole HTTP surface over one open database. */
export function createApp(deps: AppDeps): App {
  const db = deps.db
  const dir = deps.dir
  const role = deps.role
  const now = deps.now ?? Date.now
  const procedures = deps.procedures ?? handlers
  const hub = createEventHub({ heartbeatMs: deps.heartbeatMs })

  /** Calls a procedure and maps its outcome to the contract's HTTP answer. */
  async function handleRpc(req: IncomingMessage, res: ServerResponse, name: string): Promise<void> {
    const procedure = name as ProcedureName
    const handler = procedures[procedure]
    if (!PROCEDURE_NAMES.includes(procedure) || !handler) {
      sendError(res, STATUS.NOT_FOUND, 'NOT_FOUND', `Unknown procedure "${name}"`)
      return
    }

    let body: Buffer
    try {
      body = await readBody(req, RPC_LIMIT)
    } catch (error) {
      if (error instanceof BodyTooLarge) sendError(res, 413, 'BAD_REQUEST', 'Request body too large')
      else sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', 'The request body could not be read')
      return
    }

    let payload: unknown
    try {
      payload = JSON.parse(body.toString('utf8'))
    } catch {
      sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', 'The request body must be JSON')
      return
    }
    if (!isObject(payload) || !Array.isArray(payload.args)) {
      sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', 'The request body must be an object with an args array')
      return
    }
    const args = payload.args as unknown[]

    let result: unknown
    try {
      result = await handler({ db, now }, args)
    } catch (error) {
      if (error instanceof ProcedureError) sendError(res, STATUS[error.code], error.code, error.message)
      else sendError(res, STATUS.INTERNAL, 'INTERNAL', messageOf(error))
      return
    }

    const topics = topicsOf(procedure, args)
    if (topics.length > 0) hub.publish(topics)
    sendJson(res, 200, { result: result === undefined ? null : result })
  }

  /** `GET /api/health`: what the gate and the learner need to know about the folder. */
  function health(): Record<string, unknown> {
    let dbBytes = 0
    try {
      const stats = statSync(join(dir, 'qwerty.db'))
      if (stats.isFile()) dbBytes = stats.size
    } catch {
      dbBytes = 0
    }

    const empty = EMPTY_TABLES.every((table) => {
      const row = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)
      return Number(row?.n ?? 0) === 0
    })
    const migrated = Object.prototype.hasOwnProperty.call(getAllMeta(db), 'migratedAt')

    return { ok: true, schemaVersion: SCHEMA_VERSION, role, dataDir: dir, dbBytes, empty, migrated }
  }

  /** `GET /api/export/db`: a consistent copy streamed as a download, removed once sent. */
  function handleExportDb(res: ServerResponse): void {
    const tempDir = mkdtempSync(join(tmpdir(), 'qwerty-export-'))
    const cleanup = () => rmSync(tempDir, { recursive: true, force: true })

    let file: string
    try {
      file = snapshotDb(db, tempDir)
    } catch (error) {
      cleanup()
      sendError(res, STATUS.INTERNAL, 'INTERNAL', messageOf(error))
      return
    }

    let size: number | undefined
    try {
      size = statSync(file).size
    } catch {
      size = undefined
    }

    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename="qwerty-${localDate(now())}.db"`,
      ...(size === undefined ? {} : contentLength(size)),
    })
    res.on('close', cleanup)
    const stream = createReadStream(file)
    stream.on('error', () => {
      cleanup()
      if (!res.writableEnded) res.end()
    })
    stream.pipe(res)
  }

  /** `GET /api/export/json`: the Dexie-format JSON, already gzipped by the exporter. */
  function handleExportJson(res: ServerResponse): void {
    const bytes = exportDexieJson(db)
    res.writeHead(200, {
      'content-type': 'application/gzip',
      'content-disposition': `attachment; filename="qwerty-${localDate(now())}.json.gz"`,
      ...contentLength(bytes.length),
    })
    res.end(Buffer.from(bytes))
  }

  /** `POST /api/import`: validates and replaces everything, after a backup of the current file. */
  async function handleImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let body: Buffer
    try {
      body = await readBody(req, IMPORT_LIMIT)
    } catch (error) {
      if (error instanceof BodyTooLarge) sendError(res, 413, 'BAD_REQUEST', 'Request body too large')
      else sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', 'The request body could not be read')
      return
    }

    let counts: unknown
    try {
      mkdirSync(join(dir, 'backups'), { recursive: true })
      const stamp = new Date(now()).toISOString().replace(/[:.]/g, '-')
      const backupPath = join(dir, 'backups', `before-import-${stamp}.db`)
      counts = importDexieJson(db, body, () => db.backupTo(backupPath))
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('IMPORT_INVALID')) {
        sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', error.message)
      } else {
        sendError(res, STATUS.INTERNAL, 'INTERNAL', messageOf(error))
      }
      return
    }

    hub.publish(['*'])
    sendJson(res, 200, { result: counts })
  }

  /** Every `/api` path that is not one of the endpoints above. */
  async function handleApi(req: IncomingMessage, res: ServerResponse, method: string, pathname: string): Promise<void> {
    if (method === 'POST' && pathname.startsWith('/api/rpc/')) {
      await handleRpc(req, res, pathname.slice('/api/rpc/'.length))
      return
    }
    if (method === 'GET' && pathname === '/api/events') {
      hub.connect(res)
      return
    }
    if (method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, health())
      return
    }
    if (method === 'GET' && pathname === '/api/export/db') {
      handleExportDb(res)
      return
    }
    if (method === 'GET' && pathname === '/api/export/json') {
      handleExportJson(res)
      return
    }
    if (method === 'POST' && pathname === '/api/import') {
      await handleImport(req, res)
      return
    }
    sendError(res, STATUS.NOT_FOUND, 'NOT_FOUND', 'Not found')
  }

  function isFile(path: string): boolean {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  }

  function sendFile(res: ServerResponse, file: string, cacheControl: string, headOnly: boolean): void {
    let body: Buffer
    try {
      body = readFileSync(file)
    } catch {
      sendError(res, STATUS.NOT_FOUND, 'NOT_FOUND', 'Not found')
      return
    }
    res.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': cacheControl,
      ...contentLength(body.length),
    })
    if (headOnly) res.end()
    else res.end(body)
  }

  /** Static files and the single-page fallback for every non-`/api` request. */
  function handleStatic(res: ServerResponse, method: string, pathname: string): void {
    if (method !== 'GET' && method !== 'HEAD') {
      sendError(res, STATUS.NOT_FOUND, 'NOT_FOUND', 'Not found')
      return
    }
    if (!deps.staticDir) {
      sendError(res, STATUS.NOT_FOUND, 'NOT_FOUND', 'Not found')
      return
    }

    const root = resolve(deps.staticDir)
    let path: string
    try {
      path = decodeURIComponent(pathname)
    } catch {
      sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', 'Invalid path')
      return
    }

    const target = resolve(root, `.${path}`)
    if (target !== root && !target.startsWith(root + sep)) {
      sendError(res, 403, 'BAD_REQUEST', 'Forbidden')
      return
    }

    const headOnly = method === 'HEAD'
    if (isFile(target)) {
      sendFile(res, target, path.startsWith('/assets/') ? IMMUTABLE : NO_CACHE, headOnly)
      return
    }

    const index = join(root, 'index.html')
    if (isFile(index)) sendFile(res, index, NO_CACHE, headOnly)
    else sendError(res, STATUS.NOT_FOUND, 'NOT_FOUND', 'Not found')
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // The Host check comes first: it is the guard against a DNS name pointing at this loopback server.
    if (!hostAllowed(req.headers.host)) {
      sendError(res, 403, 'BAD_REQUEST', 'Host not allowed')
      return
    }

    let pathname: string
    try {
      pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    } catch {
      sendError(res, STATUS.BAD_REQUEST, 'BAD_REQUEST', 'Invalid URL')
      return
    }

    const method = (req.method ?? 'GET').toUpperCase()
    if (pathname === '/api' || pathname.startsWith('/api/')) await handleApi(req, res, method, pathname)
    else handleStatic(res, method, pathname)
  }

  return {
    handle(req: IncomingMessage, res: ServerResponse): void {
      void route(req, res).catch((error: unknown) => {
        if (res.headersSent) {
          res.end()
          return
        }
        sendError(res, STATUS.INTERNAL, 'INTERNAL', messageOf(error))
      })
    },

    publish(topics: string[]): void {
      hub.publish(topics)
    },

    close(): void {
      hub.closeAll()
    },
  }
}

/** Starts the app on loopback only; `port: 0` asks the system for a free one. */
export function startServer(deps: AppDeps & { port: number }): Promise<RunningServer> {
  const app = createApp(deps)
  const server = createServer((req, res) => app.handle(req, res))

  return new Promise<RunningServer>((resolveServer, reject) => {
    const onError = (error: Error) => reject(error)
    server.once('error', onError)
    server.listen(deps.port, '127.0.0.1', () => {
      server.off('error', onError)
      const address = server.address()
      const port = address && typeof address === 'object' ? address.port : deps.port
      let closing: Promise<void> | undefined

      resolveServer({
        port,
        close(): Promise<void> {
          if (closing) return closing
          closing = new Promise<void>((done) => {
            app.close()
            server.close(() => done())
            const sockets = server as unknown as { closeAllConnections?: () => void }
            sockets.closeAllConnections?.()
          })
          return closing
        },
      })
    })
  })
}
