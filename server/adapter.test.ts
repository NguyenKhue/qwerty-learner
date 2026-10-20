// @vitest-environment node
import { type Db, openDb } from './adapter'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const opened: Db[] = []
const dirs: string[] = []

function memory(): Db {
  const db = openDb(':memory:')
  opened.push(db)
  return db
}

afterEach(() => {
  for (const db of opened.splice(0)) {
    try {
      db.close()
    } catch {
      // Already closed by the test.
    }
  }
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('openDb', () => {
  it('round trips rows with parameters and returns numeric insert ids', () => {
    const db = memory()
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, n INTEGER)')

    const first = db.run('INSERT INTO t (name, n) VALUES (?, ?)', ['one', 1])
    expect(first.changes).toBe(1)
    expect(typeof first.changes).toBe('number')
    expect(typeof first.lastInsertRowid).toBe('number')
    expect(first.lastInsertRowid).toBe(1)

    const second = db.run('INSERT INTO t (name, n) VALUES (?, ?)', ['two', 2])
    expect(second.lastInsertRowid).toBe(2)

    expect(db.get<{ name: string; n: number }>('SELECT name, n FROM t WHERE id = ?', [2])).toEqual({ name: 'two', n: 2 })
    expect(db.get('SELECT name FROM t WHERE id = ?', [99])).toBeUndefined()
    expect(db.all<{ name: string }>('SELECT name FROM t ORDER BY id')).toEqual([{ name: 'one' }, { name: 'two' }])
  })

  it('keeps two in-memory databases isolated', () => {
    const first = memory()
    first.exec('CREATE TABLE t (x INTEGER)')
    first.run('INSERT INTO t (x) VALUES (?)', [1])

    const second = memory()
    expect(second.all("SELECT name FROM sqlite_master WHERE type = 'table'")).toEqual([])
  })

  it('commits a transaction and rolls back and rethrows on a throw', () => {
    const db = memory()
    db.exec('CREATE TABLE t (x INTEGER)')

    expect(db.transaction(() => db.run('INSERT INTO t (x) VALUES (?)', [1]).lastInsertRowid)).toBe(1)
    expect(db.all('SELECT x FROM t')).toEqual([{ x: 1 }])

    expect(() =>
      db.transaction(() => {
        db.run('INSERT INTO t (x) VALUES (?)', [2])
        throw new Error('boom')
      }),
    ).toThrow('boom')
    expect(db.all('SELECT x FROM t')).toEqual([{ x: 1 }])
  })

  it('joins a nested transaction to the outer one so an outer throw rolls back both', () => {
    const db = memory()
    db.exec('CREATE TABLE t (x INTEGER)')

    const result = db.transaction(() => {
      db.run('INSERT INTO t (x) VALUES (?)', [1])
      const inner = db.transaction(() => {
        db.run('INSERT INTO t (x) VALUES (?)', [2])
        return 'inner'
      })
      return { inner, count: db.all<{ x: number }>('SELECT x FROM t').length }
    })
    expect(result).toEqual({ inner: 'inner', count: 2 })
    expect(db.all('SELECT x FROM t')).toEqual([{ x: 1 }, { x: 2 }])

    expect(() =>
      db.transaction(() => {
        db.run('INSERT INTO t (x) VALUES (?)', [3])
        db.transaction(() => db.run('INSERT INTO t (x) VALUES (?)', [4]))
        throw new Error('outer')
      }),
    ).toThrow('outer')
    expect(db.all<{ x: number }>('SELECT x FROM t')).toEqual([{ x: 1 }, { x: 2 }])
  })

  it('backs up to a file that opens with the rows and refuses an existing path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qwerty-'))
    dirs.push(dir)
    const db = memory()
    db.exec('CREATE TABLE t (name TEXT)')
    db.run('INSERT INTO t (name) VALUES (?)', ['kept'])

    const target = join(dir, 'backup.db')
    db.backupTo(target)
    expect(existsSync(target)).toBe(true)

    const copy = openDb(target)
    try {
      expect(copy.all<{ name: string }>('SELECT name FROM t')).toEqual([{ name: 'kept' }])
    } finally {
      copy.close()
    }

    expect(() => db.backupTo(target)).toThrow()
  })
})
