// @vitest-environment node
import { openDb } from '../server/adapter'
import { openFolder } from '../server/folder'
import { ensureSchema } from '../server/schema'
import { copyToDev } from './lib/copy-to-dev.mjs'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'qwerty-copy-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function makeFolder(name: string, role: 'dev' | 'stable', metaValue: string): string {
  const dir = join(root, name)
  const folder = openFolder({ dir, role, ensureSchema })
  folder.db.run("INSERT INTO meta (key, value) VALUES ('who', ?)", [metaValue])
  folder.close()
  return dir
}

const readMeta = (dir: string) => {
  const db = openDb(join(dir, 'qwerty.db'))
  try {
    return db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'who'")?.value
  } finally {
    db.close()
  }
}

describe('copyToDev', () => {
  it('only describes what it would do when the learner has not confirmed, and changes nothing', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    const dev = makeFolder('dev', 'dev', 'dev-data')
    const plan = copyToDev({ stableDir: stable, devDir: dev, yes: false })
    expect(plan.done).toBe(false)
    expect(plan.message).toMatch(/--yes/)
    expect(readMeta(dev)).toBe('dev-data')
  })

  it('replaces the dev database with a consistent copy of the stable one when confirmed, and leaves the stable folder untouched', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    const dev = makeFolder('dev', 'dev', 'dev-data')
    const before = readFileSync(join(stable, 'qwerty.db'))
    const result = copyToDev({ stableDir: stable, devDir: dev, yes: true })
    expect(result.done).toBe(true)
    expect(readMeta(dev)).toBe('real')
    expect(readMeta(stable)).toBe('real')
    expect(readFileSync(join(dev, '.role'), 'utf8').trim()).toBe('dev')
    expect(readFileSync(join(stable, 'qwerty.db')).equals(before)).toBe(true)
  })

  it('creates the dev folder when it does not exist yet', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    const dev = join(root, 'new-dev')
    expect(copyToDev({ stableDir: stable, devDir: dev, yes: true }).done).toBe(true)
    expect(readMeta(dev)).toBe('real')
    expect(readFileSync(join(dev, '.role'), 'utf8').trim()).toBe('dev')
  })

  it('refuses a source that is not a stable data folder', () => {
    const notStable = makeFolder('other-dev', 'dev', 'x')
    const dev = makeFolder('dev', 'dev', 'dev-data')
    expect(() => copyToDev({ stableDir: notStable, devDir: dev, yes: true })).toThrow(/stable/)
    expect(() => copyToDev({ stableDir: join(root, 'missing'), devDir: dev, yes: true })).toThrow()
    expect(readMeta(dev)).toBe('dev-data')
  })

  it('refuses a target that is not a dev folder, so real data is never overwritten', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    const other = makeFolder('also-stable', 'stable', 'precious')
    expect(() => copyToDev({ stableDir: stable, devDir: other, yes: true })).toThrow(/dev/)
    expect(readMeta(other)).toBe('precious')
  })

  it('refuses to copy onto the same folder', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    expect(() => copyToDev({ stableDir: stable, devDir: stable, yes: true })).toThrow()
  })

  it('refuses while a dev server holds the dev folder', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    const dev = makeFolder('dev', 'dev', 'dev-data')
    const running = openFolder({ dir: dev, role: 'dev', ensureSchema })
    try {
      expect(() => copyToDev({ stableDir: stable, devDir: dev, yes: true })).toThrow(/running|server/i)
    } finally {
      running.close()
    }
    expect(readMeta(dev)).toBe('dev-data')
  })

  it('ignores a leftover lock file whose process is gone', () => {
    const stable = makeFolder('stable', 'stable', 'real')
    const dev = makeFolder('dev', 'dev', 'dev-data')
    writeFileSync(join(dev, 'server.lock'), '999999999')
    expect(copyToDev({ stableDir: stable, devDir: dev, yes: true }).done).toBe(true)
    expect(existsSync(join(dev, 'qwerty.db-wal'))).toBe(false)
  })
})
