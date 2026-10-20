import { type Db, openDb } from './adapter'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type Role = 'dev' | 'stable'

export type OpenedFolder = { db: Db; dir: string; role: Role; close(): void }

/** A reason the data folder cannot be used, with a stable code for callers. */
export class FolderError extends Error {
  code: 'LOCKED' | 'ROLE_MISMATCH' | 'NEWER_SCHEMA' | 'CORRUPT' | 'NOT_WRITABLE'

  constructor(code: 'LOCKED' | 'ROLE_MISMATCH' | 'NEWER_SCHEMA' | 'CORRUPT' | 'NOT_WRITABLE', message?: string) {
    super(message ?? code)
    this.name = 'FolderError'
    this.code = code
  }
}

const README = `qwerty-learner data folder

qwerty.db            the database with all of your learning data
qwerty.db-wal        SQLite journal files, present while the server runs
qwerty.db-shm
backups/             automatic copies, named qwerty-YYYY-MM-DD.db
server.lock          written by the running server; do not delete it while the server runs
.role                "dev" or "stable"; a server with the other role refuses this folder

To restore a backup:
1. Stop the server.
2. Copy the file you want from backups/ over qwerty.db.
3. Start the server.
`

/** Lock paths held by this process, so a second open of the same folder is refused even though the pid is ours. */
const activeLocks = new Set<string>()

const BACKUP_NAME = /^qwerty-(\d{4})-(\d{2})-(\d{2})\.db$/
const DAILY_DAYS = 14
const WEEKLY_DAYS = 56
/** Whatever the clock says, this many of the newest backups are never removed (a wrong date must not wipe the history). */
const ALWAYS_KEEP = 7

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function tryCreateLock(lockPath: string): boolean {
  let fd: number
  try {
    fd = openSync(lockPath, 'wx')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false
    throw error
  }
  try {
    writeSync(fd, String(process.pid))
  } finally {
    closeSync(fd)
  }
  return true
}

function acquireLock(lockPath: string): void {
  try {
    if (tryCreateLock(lockPath)) {
      activeLocks.add(lockPath)
      return
    }
    const pid = Number.parseInt(readFileSync(lockPath, 'utf8').trim(), 10)
    const ours = pid === process.pid && activeLocks.has(lockPath)
    if (Number.isInteger(pid) && pid > 0 && isProcessAlive(pid) && (pid !== process.pid || ours)) {
      throw new FolderError('LOCKED', 'Another server is already using this folder')
    }
    rmSync(lockPath, { force: true })
    if (!tryCreateLock(lockPath)) throw new FolderError('LOCKED', 'Another server is already using this folder')
    activeLocks.add(lockPath)
  } catch (error) {
    if (error instanceof FolderError) throw error
    throw new FolderError('NOT_WRITABLE', `Could not write the lock file in ${lockPath}`)
  }
}

function releaseLock(lockPath: string): void {
  activeLocks.delete(lockPath)
  try {
    rmSync(lockPath, { force: true })
  } catch {
    // Nothing else can be done while shutting down; the pid check takes over a stale lock next time.
  }
}

function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Creates the folder layout, takes the lock, opens the database and checks it before returning it. */
export function openFolder(opts: { dir: string; role: Role; ensureSchema?: (db: Db) => void; now?: () => number }): OpenedFolder {
  const dir = resolve(opts.dir)

  try {
    mkdirSync(dir, { recursive: true })
    const rolePath = join(dir, '.role')
    if (existsSync(rolePath)) {
      const recorded = readFileSync(rolePath, 'utf8').trim()
      if (recorded !== opts.role) {
        throw new FolderError('ROLE_MISMATCH', `This folder belongs to the "${recorded}" role, not "${opts.role}"`)
      }
    } else {
      writeFileSync(rolePath, opts.role)
    }
    const readmePath = join(dir, 'README.txt')
    if (!existsSync(readmePath)) writeFileSync(readmePath, README)
  } catch (error) {
    if (error instanceof FolderError) throw error
    throw new FolderError('NOT_WRITABLE', `Could not write to ${dir}`)
  }

  const lockPath = join(dir, 'server.lock')
  acquireLock(lockPath)

  let db: Db
  try {
    db = openDb(join(dir, 'qwerty.db'))
  } catch {
    releaseLock(lockPath)
    throw new FolderError('CORRUPT', 'The database in this folder cannot be opened or is damaged')
  }

  let check = ''
  try {
    const row = db.get<{ quick_check: unknown }>('PRAGMA quick_check')
    check = String(row?.quick_check ?? '')
  } catch {
    check = ''
  }
  if (check !== 'ok') {
    try {
      db.close()
    } catch {
      // The database is unusable either way.
    }
    releaseLock(lockPath)
    throw new FolderError('CORRUPT', 'The database in this folder cannot be opened or is damaged')
  }

  try {
    opts.ensureSchema?.(db)
  } catch (error) {
    try {
      db.close()
    } catch {
      // The database is unusable either way.
    }
    releaseLock(lockPath)
    if (error instanceof Error && error.message === 'NEWER_SCHEMA') {
      throw new FolderError('NEWER_SCHEMA', 'This folder was written by a newer version of the app')
    }
    throw error
  }

  let closed = false
  return {
    db,
    dir,
    role: opts.role,
    close(): void {
      if (closed) return
      closed = true
      try {
        db.close()
      } finally {
        releaseLock(lockPath)
      }
    },
  }
}

/** Backs up today's database once per local day and prunes old copies (14 daily, 8 weekly Sundays, never the newest 7). */
export function runBackups(folder: OpenedFolder, now: number): { created: string | null; removed: string[] } {
  const backupsDir = join(folder.dir, 'backups')
  mkdirSync(backupsDir, { recursive: true })

  const today = new Date(now)
  const todayNumber = dayNumber(today)
  const name = `qwerty-${formatDate(today)}.db`
  let created: string | null = null

  if (!existsSync(join(backupsDir, name))) {
    folder.db.backupTo(join(backupsDir, name))
    created = name
  }

  const removed: string[] = []
  const newest = new Set(
    readdirSync(backupsDir)
      .filter((entry) => BACKUP_NAME.test(entry))
      .sort()
      .reverse()
      .slice(0, ALWAYS_KEEP),
  )
  for (const entry of readdirSync(backupsDir)) {
    const match = BACKUP_NAME.exec(entry)
    if (!match || entry === name || newest.has(entry)) continue
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    const age = todayNumber - dayNumber(date)
    const daily = age >= 0 && age < DAILY_DAYS
    const weekly = date.getDay() === 0 && age >= 0 && age < WEEKLY_DAYS
    if (daily || weekly) continue
    const file = join(backupsDir, entry)
    if (!statSync(file).isFile()) continue
    rmSync(file, { force: true })
    removed.push(entry)
  }

  return { created, removed: removed.sort() }
}
