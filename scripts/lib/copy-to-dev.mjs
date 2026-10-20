import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite')

function readRole(dir) {
  const path = join(dir, '.role')
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : null
}

function serverIsRunning(dir) {
  const path = join(dir, 'server.lock')
  if (!existsSync(path)) return false
  const pid = Number.parseInt(readFileSync(path, 'utf8').trim(), 10)
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * Copies the real (stable) database into the dev folder so the dev build can be tried with real data. The copy is made with
 * VACUUM INTO (a consistent copy even while the stable server runs) and put in place only when it is complete; the stable folder is
 * only read. Without `yes` nothing is changed and the result says what would happen.
 */
export function copyToDev({ stableDir, devDir, yes }) {
  const source = resolve(stableDir)
  const target = resolve(devDir)
  if (source === target) throw new Error('The stable and the dev folder are the same folder')
  if (!existsSync(join(source, 'qwerty.db'))) throw new Error(`No qwerty.db in ${source}`)
  if (readRole(source) !== 'stable') throw new Error(`${source} is not a stable data folder (its role must be "stable")`)
  const targetRole = readRole(target)
  if (existsSync(target) && existsSync(join(target, 'qwerty.db')) && targetRole !== 'dev') {
    throw new Error(`${target} is not a dev data folder (its role is ${targetRole ?? 'missing'}): it will not be overwritten`)
  }
  if (serverIsRunning(target)) throw new Error(`A dev server is running on ${target}: stop it first`)

  const sourceBytes = statSync(join(source, 'qwerty.db')).size
  const targetBytes = existsSync(join(target, 'qwerty.db')) ? statSync(join(target, 'qwerty.db')).size : 0
  if (!yes) {
    return {
      done: false,
      message:
        `This would replace the dev database (${targetBytes} bytes) in ${target} with a copy of the stable database ` +
        `(${sourceBytes} bytes) from ${source}. The stable folder is not changed. Run again with --yes to do it.`,
    }
  }

  mkdirSync(target, { recursive: true })
  const temporary = join(target, 'qwerty.db.copying')
  rmSync(temporary, { force: true })
  const database = new DatabaseSync(join(source, 'qwerty.db'))
  try {
    database.exec(`VACUUM INTO '${temporary.replace(/'/g, "''")}'`)
  } finally {
    database.close()
  }
  rmSync(join(target, 'qwerty.db-wal'), { force: true })
  rmSync(join(target, 'qwerty.db-shm'), { force: true })
  renameSync(temporary, join(target, 'qwerty.db'))
  writeFileSync(join(target, '.role'), 'dev')
  return { done: true, message: `Copied ${sourceBytes} bytes of real data into ${target}` }
}
