import type { LegacyCounts } from '../gate'
import { LEGACY_DB, LEGACY_TABLES, countLegacy, openLegacy } from './detect'
import { readBatch } from './read'

/** The two lists the old version kept in localStorage that describe the data (they move with it). */
const FLAG_KEYS = ['seededPersonalSets', 'backfilledPersonalExtras']

export const DEFAULT_BATCH_SIZE = 2000

/** The server holds something different from what the browser read: the move is not trusted. */
export class MigrationMismatch extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationMismatch'
  }
}

export type MigrationProgress = { done: number; total: number }

async function post(step: string, body: unknown): Promise<{ counts?: Record<string, number>; session?: string }> {
  const response = await fetch(`/api/migrate/${step}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const answer = (await response.json().catch(() => null)) as { result?: unknown; error?: { message?: string } } | null
  if (!response.ok) throw new Error(answer?.error?.message ?? `The data server answered ${response.status}`)
  return (answer?.result ?? {}) as { counts?: Record<string, number>; session?: string }
}

/** The flag lists from localStorage, as the text they are stored in; anything that is not a list of strings is left behind. */
function readFlags(): Record<string, string> {
  const meta: Record<string, string> = {}
  for (const key of FLAG_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) meta[key] = raw
    } catch {
      // Not valid JSON: not a flag list
    }
  }
  return meta
}

/**
 * Copies everything the old database holds into the data folder, in batches, and trusts the result only when the server's counts equal
 * what was read. Nothing in this browser is changed or deleted. If anything fails the staged copy is dropped and the server is as it was.
 */
export async function runMigration(
  opts: { batchSize?: number; onProgress?: (progress: MigrationProgress) => void } = {},
): Promise<{ counts: LegacyCounts }> {
  const nothing = 'There is nothing in this browser to move'
  const db = await openLegacy()
  if (!db) throw new Error(nothing)
  try {
    const found = await countLegacy(db)
    if (!LEGACY_TABLES.some((table) => found[table] > 0)) throw new Error(nothing)

    const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE
    const total = LEGACY_TABLES.reduce((sum, table) => sum + Math.ceil(found[table] / batchSize), 0)
    const { session } = await post('begin', {})
    const sent: LegacyCounts = {}
    try {
      let done = 0
      for (const table of LEGACY_TABLES) {
        sent[table] = 0
        let after: IDBValidKey | undefined
        for (;;) {
          const batch = await readBatch(db, table, after, batchSize)
          if (batch.rows.length === 0) break
          await post('batch', { session, table, rows: batch.rows })
          sent[table] += batch.rows.length
          after = batch.lastKey
          done++
          opts.onProgress?.({ done, total })
          if (batch.rows.length < batchSize) break
        }
      }

      const result = await post('commit', { session, counts: sent, meta: readFlags() })
      const differing = LEGACY_TABLES.filter((table) => result.counts?.[table] !== sent[table])
      if (differing.length > 0)
        throw new MigrationMismatch(`The data folder holds different numbers than this browser sent (${differing.join(', ')})`)
      return { counts: sent }
    } catch (error) {
      await post('abort', { session }).catch(() => undefined)
      throw error
    }
  } finally {
    db.close()
  }
}

/** Deletes the old database and the two old flag lists of this browser. Only ever called from an explicit button. */
export async function deleteLegacyCopy(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LEGACY_DB)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Close the other tabs of this app first, then try again'))
  })
  for (const key of FLAG_KEYS) localStorage.removeItem(key)
}
