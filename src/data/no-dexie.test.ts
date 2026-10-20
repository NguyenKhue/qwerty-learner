import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..', '..')
const FORBIDDEN =
  /from ['"](dexie|dexie-react-hooks|dexie-export-import)['"]|from ['"][^'"]*utils\/db\/database['"]|from ['"]\.\/database['"]|import ['"]dexie/

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

describe('the application no longer keeps data in the browser', () => {
  it('does not import Dexie or the old database anywhere in the application code', () => {
    const offenders = sources(join(root, 'src'))
      .filter((path) => !path.startsWith(join(root, 'src', 'test')) && !/\.test\.tsx?$/.test(path))
      .filter((path) => FORBIDDEN.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path))
    expect(offenders).toEqual([])
  })

  it('does not ship Dexie, its React hooks, its export addon or pako with the application', () => {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    for (const name of ['dexie', 'dexie-react-hooks', 'dexie-export-import', 'pako', '@types/pako']) {
      expect(Object.keys(manifest.dependencies)).not.toContain(name)
    }
    // The tests of the move still need to build an old database, and of the export format to read one
    expect(Object.keys(manifest.devDependencies)).toEqual(expect.arrayContaining(['dexie', 'dexie-export-import', 'fake-indexeddb']))
    expect(Object.keys(manifest.devDependencies)).not.toContain('dexie-react-hooks')
  })

  it('keeps the lock file free of the packages that were removed', () => {
    const lock = readFileSync(join(root, 'yarn.lock'), 'utf8')
    for (const pattern of [/^dexie-react-hooks@/m, /^pako@/m, /^"@types\/pako@/m]) expect(lock).not.toMatch(pattern)
  })
})
