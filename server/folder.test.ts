// @vitest-environment node
import { openDb } from './adapter'
import { FolderError, type OpenedFolder, openFolder, runBackups } from './folder'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const opened: OpenedFolder[] = []
const dirs: string[] = []

type OpenOptions = Parameters<typeof openFolder>[0]

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qwerty-'))
  dirs.push(dir)
  return dir
}

function open(opts: OpenOptions): OpenedFolder {
  const folder = openFolder(opts)
  opened.push(folder)
  return folder
}

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return error instanceof FolderError ? error.code : undefined
  }
  return undefined
}

/** Local calendar date at noon, so day arithmetic is stable across daylight saving changes. */
function at(year: number, month: number, day: number, hour = 12): number {
  return new Date(year, month - 1, day, hour).getTime()
}

function backupName(ms: number): string {
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `qwerty-${date.getFullYear()}-${month}-${day}.db`
}

function backupNames(dir: string): string[] {
  return readdirSync(join(dir, 'backups'))
    .filter((name) => /^qwerty-\d{4}-\d{2}-\d{2}\.db$/.test(name))
    .sort()
}

afterEach(() => {
  for (const folder of opened.splice(0)) {
    try {
      folder.close()
    } catch {
      // Already closed by the test.
    }
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('openFolder', () => {
  it('creates the folder, README and role file, and takes the lock', () => {
    const dir = join(tempDir(), 'nested', 'data')
    const folder = open({ dir, role: 'dev' })

    expect(folder.dir).toBe(dir)
    expect(folder.role).toBe('dev')
    expect(existsSync(join(dir, 'qwerty.db'))).toBe(true)
    expect(readFileSync(join(dir, '.role'), 'utf8')).toBe('dev')
    expect(readFileSync(join(dir, 'server.lock'), 'utf8')).toBe(String(process.pid))

    const readme = readFileSync(join(dir, 'README.txt'), 'utf8')
    expect(readme).toContain('qwerty.db')
    expect(readme).toContain('backups/')
    expect(readme).toContain('Stop the server')

    folder.close()
    expect(existsSync(join(dir, 'server.lock'))).toBe(false)
  })

  it('refuses a second server on the same folder until close', () => {
    const dir = tempDir()
    const folder = open({ dir, role: 'dev' })
    expect(errorCode(() => openFolder({ dir, role: 'dev' }))).toBe('LOCKED')

    folder.close()
    const again = open({ dir, role: 'dev' })
    expect(again.db.get<{ ok: number }>('SELECT 1 AS ok')).toEqual({ ok: 1 })
  })

  it('takes over a lock whose process is dead', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'server.lock'), '999999')

    const folder = open({ dir, role: 'dev' })
    expect(readFileSync(join(dir, 'server.lock'), 'utf8')).toBe(String(process.pid))
    expect(folder.db.get<{ ok: number }>('SELECT 1 AS ok')).toEqual({ ok: 1 })
  })

  it('refuses a folder created for another role, before taking the lock', () => {
    const dir = tempDir()
    open({ dir, role: 'dev' }).close()

    expect(errorCode(() => openFolder({ dir, role: 'stable' }))).toBe('ROLE_MISMATCH')
    expect(existsSync(join(dir, 'server.lock'))).toBe(false)
    expect(readFileSync(join(dir, '.role'), 'utf8')).toBe('dev')
  })

  it('refuses a garbage database with CORRUPT and releases the lock', () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'qwerty.db'), 'this is definitely not a sqlite database')

    expect(errorCode(() => openFolder({ dir, role: 'dev' }))).toBe('CORRUPT')
    expect(existsSync(join(dir, 'server.lock'))).toBe(false)
  })

  it('maps a NEWER_SCHEMA error from ensureSchema and releases the lock', () => {
    const dir = tempDir()
    const ensureSchema = (): void => {
      throw new Error('NEWER_SCHEMA')
    }

    expect(errorCode(() => openFolder({ dir, role: 'dev', ensureSchema }))).toBe('NEWER_SCHEMA')
    expect(existsSync(join(dir, 'server.lock'))).toBe(false)
  })

  it('refuses a folder it cannot write to', () => {
    const dir = tempDir()
    chmodSync(dir, 0o500)
    try {
      expect(errorCode(() => openFolder({ dir, role: 'dev' }))).toBe('NOT_WRITABLE')
    } finally {
      chmodSync(dir, 0o700)
    }
  })

  it('runs ensureSchema and keeps the data when the folder is reopened', () => {
    const dir = tempDir()
    open({
      dir,
      role: 'dev',
      ensureSchema: (db) => {
        db.exec('CREATE TABLE t (x INTEGER)')
        db.run('INSERT INTO t (x) VALUES (?)', [7])
      },
    }).close()

    const again = open({ dir, role: 'dev' })
    expect(again.db.all<{ x: number }>('SELECT x FROM t')).toEqual([{ x: 7 }])
  })
})

describe('runBackups', () => {
  it("creates today's backup once and never twice on the same day", () => {
    const dir = tempDir()
    const folder = open({ dir, role: 'dev' })

    expect(runBackups(folder, at(2026, 10, 20))).toEqual({ created: 'qwerty-2026-10-20.db', removed: [] })
    expect(runBackups(folder, at(2026, 10, 20, 18))).toEqual({ created: null, removed: [] })
    expect(backupNames(dir)).toEqual(['qwerty-2026-10-20.db'])
  })

  it('writes a backup that opens and holds the rows', () => {
    const dir = tempDir()
    const folder = open({
      dir,
      role: 'dev',
      ensureSchema: (db) => {
        db.exec('CREATE TABLE t (x INTEGER)')
        db.run('INSERT INTO t (x) VALUES (?)', [42])
      },
    })

    const result = runBackups(folder, at(2026, 10, 20))
    expect(result.created).toBe('qwerty-2026-10-20.db')

    const copy = openDb(join(dir, 'backups', 'qwerty-2026-10-20.db'))
    try {
      expect(copy.all<{ x: number }>('SELECT x FROM t')).toEqual([{ x: 42 }])
    } finally {
      copy.close()
    }
  })

  it('keeps the last 14 daily backups over 20 consecutive days, plus the weekly Sunday', () => {
    const dir = tempDir()
    const folder = open({ dir, role: 'dev' })
    for (let i = 0; i < 20; i++) runBackups(folder, at(2026, 10, 20 + i))

    const names = backupNames(dir)
    const lastFourteen = Array.from({ length: 14 }, (_, i) => backupName(at(2026, 10, 20 + 6 + i)))
    for (const name of lastFourteen) expect(names).toContain(name)
    expect(names).toHaveLength(15)
    expect(names).toContain('qwerty-2026-10-25.db')
    expect(names).not.toContain('qwerty-2026-10-20.db')
    expect(names).not.toContain('qwerty-2026-10-24.db')
  })

  it('never removes the newest 7 backups, even when the clock jumps far ahead and everything looks old', () => {
    const dir = tempDir()
    const folder = open({ dir, role: 'dev' })
    for (let i = 0; i < 10; i++) runBackups(folder, at(2026, 10, 20 + i))

    const result = runBackups(folder, at(2030, 1, 1))

    expect(result.created).toBe('qwerty-2030-01-01.db')
    expect(backupNames(dir)).toEqual([
      'qwerty-2026-10-24.db',
      'qwerty-2026-10-25.db',
      'qwerty-2026-10-26.db',
      'qwerty-2026-10-27.db',
      'qwerty-2026-10-28.db',
      'qwerty-2026-10-29.db',
      'qwerty-2030-01-01.db',
    ])
    expect(result.removed).toHaveLength(4)
  })

  it('keeps the last 8 Sunday backups and removes older Sundays', () => {
    const dir = tempDir()
    const folder = open({ dir, role: 'dev' })
    for (let week = 0; week < 10; week++) runBackups(folder, at(2026, 1, 4 + week * 7))

    const names = backupNames(dir)
    expect(names).toHaveLength(8)
    expect(names).toContain(backupName(at(2026, 1, 4 + 9 * 7)))
    expect(names).toContain(backupName(at(2026, 1, 4 + 2 * 7)))
    expect(names).not.toContain(backupName(at(2026, 1, 4)))
    expect(names).not.toContain(backupName(at(2026, 1, 4 + 7)))
  })

  it('removes only old files whose name is a backup name', () => {
    const dir = tempDir()
    const folder = open({ dir, role: 'dev' })
    const backups = join(dir, 'backups')
    mkdirSync(backups, { recursive: true })

    writeFileSync(join(backups, 'qwerty-2020-01-01.db'), 'old')
    // Seven recent files, so the old one is outside the newest 7 that are never removed
    for (let day = 10; day < 17; day++) writeFileSync(join(backups, `qwerty-2026-10-${day}.db`), 'recent')
    const keep = ['notes.txt', 'qwerty-2020-01-01.db.bak', 'other.db', 'qwerty-1-1-1.db']
    for (const name of keep) writeFileSync(join(backups, name), 'keep me')

    const result = runBackups(folder, at(2026, 10, 20))
    expect(result.removed).toEqual(['qwerty-2020-01-01.db'])
    for (const name of keep) expect(existsSync(join(backups, name))).toBe(true)
    expect(existsSync(join(backups, 'qwerty-2020-01-01.db'))).toBe(false)
  })
})
