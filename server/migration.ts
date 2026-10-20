import type { Db } from './adapter'
import { openDb } from './adapter'
import { TABLE_NAMES, checkRows, countTables, insertRows, isTableName } from './exchange'
import { getAll as getAllMeta } from './repo/meta'
import { ensureSchema } from './schema'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/** A refused migration step; `code` maps to the HTTP status of the answer. */
export class MigrationError extends Error {
  readonly code: 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT'

  constructor(code: 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT', message: string) {
    super(message)
    this.name = 'MigrationError'
    this.code = code
  }
}

export type MigrationManager = {
  /** Opens a staging file for a browser's data. Refused when the folder holds data or a migration was done. */
  begin(): { session: string }
  /** Adds rows (ids kept) to the staging file of a session. */
  batch(session: string, table: string, rows: unknown): { inserted: number }
  /** Checks the staged counts against what the browser says it read, then moves everything into the database in one transaction. */
  commit(session: string, counts: Record<string, number>, meta: Record<string, string>): { counts: Record<string, number> }
  abort(session: string): void
  /** Closes and removes every open staging file. */
  closeAll(): void
}

type Session = { db: Db; path: string }

function removeStagingFiles(path: string) {
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
}

function quote(path: string): string {
  return `'${path.replace(/'/g, "''")}'`
}

/**
 * Moves the data an older version kept in a browser into the data folder without ever writing half of it: the rows are first staged in
 * a separate file, the counts are compared with what the browser read, and only then are they copied into the database in a single
 * transaction (together with the flags and a note of what was moved). A failure leaves the database as it was.
 */
export function createMigrationManager(deps: { db: Db; dir: string; now?: () => number }): MigrationManager {
  const { db, dir } = deps
  const now = deps.now ?? Date.now
  const sessions = new Map<string, Session>()

  // Sessions cannot outlive the server: whatever an earlier server left behind is stale
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('staging-') && /\.db(-wal|-shm)?$/.test(entry)) rmSync(join(dir, entry), { force: true })
  }

  const hasLearningData = () => Object.values(countTables(db)).some((count) => count > 0)
  const wasMigrated = () => getAllMeta(db).migratedAt !== undefined

  function find(session: string): Session {
    const found = sessions.get(session)
    if (!found) throw new MigrationError('NOT_FOUND', 'This migration session does not exist (any more)')
    return found
  }

  function drop(session: string) {
    const found = sessions.get(session)
    if (!found) return
    sessions.delete(session)
    try {
      found.db.close()
    } finally {
      removeStagingFiles(found.path)
    }
  }

  return {
    begin() {
      if (wasMigrated()) throw new MigrationError('CONFLICT', 'A migration into this folder was already done')
      if (hasLearningData()) throw new MigrationError('CONFLICT', 'This folder already holds learning data')
      const session = randomBytes(8).toString('hex')
      const path = join(dir, `staging-${session}.db`)
      const staged = openDb(path)
      ensureSchema(staged)
      sessions.set(session, { db: staged, path })
      return { session }
    },

    batch(session, table, rows) {
      const found = find(session)
      if (!isTableName(table)) throw new MigrationError('BAD_REQUEST', `"${table}" is not a table of the learner's data`)
      const problem = checkRows(table, rows)
      if (problem) throw new MigrationError('BAD_REQUEST', `${table}: ${problem}`)
      const list = rows as Record<string, unknown>[]
      try {
        found.db.transaction(() => insertRows(found.db, table, list))
      } catch (error) {
        throw new MigrationError('CONFLICT', `${table}: ${error instanceof Error ? error.message : 'a row could not be stored'}`)
      }
      return { inserted: list.length }
    },

    commit(session, counts, meta) {
      const found = find(session)
      if (
        typeof counts !== 'object' ||
        counts === null ||
        !TABLE_NAMES.every((name) => Number.isInteger(counts[name]) && counts[name] >= 0)
      ) {
        throw new MigrationError('BAD_REQUEST', 'counts must give a number of rows for every table')
      }
      if (typeof meta !== 'object' || meta === null || Object.values(meta).some((value) => typeof value !== 'string')) {
        throw new MigrationError('BAD_REQUEST', 'meta must map names to text')
      }
      const staged = countTables(found.db)
      const differing = TABLE_NAMES.filter((name) => staged[name] !== counts[name])
      if (differing.length > 0) {
        throw new MigrationError('CONFLICT', `The rows that arrived do not match what the browser read (${differing.join(', ')})`)
      }
      if (wasMigrated() || hasLearningData()) throw new MigrationError('CONFLICT', 'This folder changed while the data was being staged')

      const tables = ['word_records', 'chapter_records', 'review_records', 'custom_dicts', 'card_progress', 'review_log']
      // ATTACH cannot happen inside a transaction, so it brackets it
      db.exec(`ATTACH DATABASE ${quote(found.path)} AS staging`)
      try {
        db.transaction(() => {
          for (const table of tables) db.exec(`INSERT INTO main.${table} SELECT * FROM staging.${table}`)
          const after = countTables(db)
          const wrong = TABLE_NAMES.filter((name) => after[name] !== counts[name])
          if (wrong.length > 0)
            throw new MigrationError('CONFLICT', `The database holds different counts after the copy (${wrong.join(', ')})`)
          for (const [key, value] of Object.entries(meta)) {
            db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [key, value])
          }
          db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
            'migratedAt',
            String(now()),
          ])
          db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value', [
            'migratedFrom',
            JSON.stringify(counts),
          ])
        })
      } finally {
        db.exec('DETACH DATABASE staging')
      }

      drop(session)
      try {
        mkdirSync(join(dir, 'backups'), { recursive: true })
        db.backupTo(join(dir, 'backups', `after-migration-${new Date(now()).toISOString().replace(/[:.]/g, '-')}.db`))
      } catch {
        // The data is already safe in the database; a failed extra copy must not turn a good migration into an error
      }
      return { counts: countTables(db) }
    },

    abort(session) {
      drop(session)
    },

    closeAll() {
      for (const session of Array.from(sessions.keys())) drop(session)
    },
  }
}
