import type { Role } from './folder'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export type Config = { role: Role; dir: string; port: number; staticDir: string | undefined }

/** A problem with the start arguments, worded for the person who started the server. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const DEFAULT_PORT: Record<Role, number> = { dev: 5180, stable: 4173 }
const FLAGS = ['--role', '--data', '--port', '--static']

function isInside(child: string, parent: string): boolean {
  const path = relative(parent, child)
  return path === '' || (!path.startsWith('..') && !isAbsolute(path) && path.split(sep)[0] !== '..')
}

/**
 * Reads the start arguments (`--role dev|stable`, `--data <folder>`, `--port <n>`, `--static <folder>`) and `QWERTY_DATA_DIR`.
 * The stable role must be given its data folder explicitly and refuses a folder inside the project working folder; the dev role
 * defaults to `.dev-data` in the working folder. Relative folders are resolved against `opts.cwd`.
 */
export function parseConfig(argv: string[], env: Record<string, string | undefined>, opts: { cwd: string }): Config {
  const values: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (FLAGS.indexOf(flag) === -1) throw new ConfigError(`Unknown argument "${flag}". Known: ${FLAGS.join(', ')}`)
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new ConfigError(`${flag} needs a value`)
    values[flag] = value
    i++
  }

  const role = (values['--role'] ?? 'dev') as string
  if (role !== 'dev' && role !== 'stable') throw new ConfigError(`--role must be "dev" or "stable", not "${role}"`)

  const rawPort = values['--port']
  let port = DEFAULT_PORT[role]
  if (rawPort !== undefined) {
    const parsed = Number(rawPort)
    if (rawPort.trim() === '' || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
      throw new ConfigError(`--port must be a whole number from 0 to 65535, not "${rawPort}"`)
    }
    port = parsed
  }

  const rawDir = values['--data'] ?? env.QWERTY_DATA_DIR
  if (role === 'stable' && !rawDir) {
    throw new ConfigError('The stable server needs an explicit data folder: pass --data <folder> or set QWERTY_DATA_DIR')
  }
  const dir = resolve(opts.cwd, rawDir ?? '.dev-data')
  if (role === 'stable' && isInside(dir, resolve(opts.cwd))) {
    throw new ConfigError(`The stable data folder must be outside the project folder (${opts.cwd}); "${dir}" is inside it`)
  }

  const staticDir = values['--static'] === undefined ? undefined : resolve(opts.cwd, values['--static'])
  return { role, dir, port, staticDir }
}
