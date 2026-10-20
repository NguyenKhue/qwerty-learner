import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { DatabaseSync as DatabaseSyncClass, SQLInputValue } from 'node:sqlite'

// Loaded through require: the Vite that runs the tests strips the `node:` prefix from imports, and `sqlite` only exists with it
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: typeof DatabaseSyncClass }

/** The only surface the rest of the server uses to talk to SQLite. */
export type Db = {
  exec(sql: string): void
  run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number }
  get<T>(sql: string, params?: unknown[]): T | undefined
  all<T>(sql: string, params?: unknown[]): T[]
  /** Runs fn inside BEGIN/COMMIT; any throw rolls back and rethrows. Not re-entrant: a nested call joins the outer transaction. */
  transaction<T>(fn: () => T): T
  /** VACUUM INTO; refuses an existing path. */
  backupTo(path: string): void
  close(): void
}

function values(params?: unknown[]): SQLInputValue[] {
  return (params ?? []) as SQLInputValue[]
}

/** Opens the database; files get WAL, full durability and foreign keys, ':memory:' stays plain. */
export function openDb(file: string | ':memory:'): Db {
  const sqlite = new DatabaseSync(file)
  if (file !== ':memory:') {
    sqlite.exec('PRAGMA journal_mode = WAL')
    sqlite.exec('PRAGMA synchronous = FULL')
    sqlite.exec('PRAGMA foreign_keys = ON')
  }

  let depth = 0

  return {
    exec(sql: string): void {
      sqlite.exec(sql)
    },

    run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number } {
      const result = sqlite.prepare(sql).run(...values(params))
      return { changes: Number(result.changes), lastInsertRowid: Number(result.lastInsertRowid) }
    },

    get<T>(sql: string, params?: unknown[]): T | undefined {
      return sqlite.prepare(sql).get(...values(params)) as T | undefined
    },

    all<T>(sql: string, params?: unknown[]): T[] {
      return sqlite.prepare(sql).all(...values(params)) as T[]
    },

    transaction<T>(fn: () => T): T {
      if (depth > 0) return fn()
      sqlite.exec('BEGIN')
      depth++
      try {
        const result = fn()
        sqlite.exec('COMMIT')
        return result
      } catch (error) {
        try {
          sqlite.exec('ROLLBACK')
        } catch {
          // Keep the original error when the transaction was already gone.
        }
        throw error
      } finally {
        depth--
      }
    },

    backupTo(path: string): void {
      if (existsSync(path)) throw new Error(`Backup target already exists: ${path}`)
      sqlite.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`)
    },

    close(): void {
      sqlite.close()
    },
  }
}
