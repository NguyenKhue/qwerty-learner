import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

export const DEFAULT_PORT = 4173
export const PLIST_LABEL = 'vn.khue.qwerty-learner'

function expandHome(path, home) {
  if (path === '~') return home
  return path.startsWith('~/') ? join(home, path.slice(2)) : path
}

/**
 * Reads the stable settings the learner owns (usually ~/.config/qwerty-learner/stable.json): `dataDir` (required, absolute or ~/…),
 * `port` (default 4173) and `installDir` (default ~/stable/qwerty, where the built files and the bundled server are put).
 */
export function parseStableConfig(text, home) {
  let raw
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('The stable settings are not valid JSON')
  }
  if (!raw || typeof raw !== 'object' || typeof raw.dataDir !== 'string' || raw.dataDir.trim() === '') {
    throw new Error('The stable settings need a "dataDir": the folder where your data is kept')
  }
  const dataDir = expandHome(raw.dataDir, home)
  if (!isAbsolute(dataDir)) throw new Error(`"dataDir" must be an absolute folder (or start with ~/), not "${raw.dataDir}"`)

  let port = DEFAULT_PORT
  if (raw.port !== undefined) {
    if (!Number.isInteger(raw.port) || raw.port < 1 || raw.port > 65535) throw new Error('"port" must be a whole number from 1 to 65535')
    port = raw.port
  }

  const installDir = resolve(expandHome(typeof raw.installDir === 'string' ? raw.installDir : '~/stable/qwerty', home))
  const path = relative(installDir, resolve(dataDir))
  if (path === '' || (!path.startsWith('..') && !isAbsolute(path))) {
    throw new Error('"dataDir" must not be inside the install folder: an update would replace it')
  }
  const tool = (key) => {
    const value = raw[key]
    if (value === undefined) return undefined
    const path = typeof value === 'string' ? expandHome(value, home) : ''
    if (!isAbsolute(path)) throw new Error(`"${key}" must be an absolute path (or start with ~/)`)
    return path
  }
  const ytDlpPath = tool('ytDlpPath')
  const claudePath = tool('claudePath')
  return { dataDir: resolve(dataDir), port, installDir, ...(ytDlpPath ? { ytDlpPath } : {}), ...(claudePath ? { claudePath } : {}) }
}

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The server flags for the dictation tools that the stable settings name (launchd starts the server with a minimal PATH). */
export function toolArgs({ ytDlpPath, claudePath }) {
  return [...(ytDlpPath ? ['--yt-dlp', ytDlpPath] : []), ...(claudePath ? ['--claude', claudePath] : [])]
}

/** The launchd file that starts the stable server at login and starts it again if it stops with an error. */
export function buildPlist({ nodePath, installDir, dataDir, port, label = PLIST_LABEL, logPath, ytDlpPath, claudePath }) {
  const args = [
    nodePath,
    '--disable-warning=ExperimentalWarning',
    join(installDir, 'server.mjs'),
    '--role',
    'stable',
    '--data',
    dataDir,
    '--port',
    String(port),
    '--static',
    join(installDir, 'site'),
    ...toolArgs({ ytDlpPath, claudePath }),
  ]
  const items = args.map((argument) => `    <string>${escapeXml(argument)}</string>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(label)}</string>
  <key>ProgramArguments</key>
  <array>
${items}
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(installDir)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${escapeXml(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(logPath)}</string>
</dict>
</plist>
`
}

/** The arguments of `yarn stable:build`: `--ref <git ref>`, `--out <folder>` and `--install` (a fresh `yarn install` in the checkout). */
export function parseBuildArgs(argv) {
  const result = { ref: undefined, out: undefined, install: false }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    if (flag === '--install') {
      result.install = true
    } else if (flag === '--ref' || flag === '--out') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`)
      result[flag.slice(2)] = value
      i++
    } else {
      throw new Error(`Unknown argument "${flag}"`)
    }
  }
  return result
}

/**
 * Puts a finished build (`<built>/site` and `<built>/server.mjs`) in place under `installDir`. The old files are only removed after
 * the new ones are in place, and a build that is missing a part is refused before anything is touched.
 */
export function swapInto(installDir, built) {
  for (const part of ['site', 'server.mjs']) {
    if (!existsSync(join(built, part))) throw new Error(`The build has no "${part}"`)
  }
  mkdirSync(installDir, { recursive: true })
  for (const part of ['site', 'server.mjs']) {
    const target = join(installDir, part)
    const old = `${target}.old`
    rmSync(old, { recursive: true, force: true })
    if (existsSync(target)) renameSync(target, old)
    renameSync(join(built, part), target)
    rmSync(old, { recursive: true, force: true })
  }
}

/** Where the stable settings live: QWERTY_STABLE_CONFIG or ~/.config/qwerty-learner/stable.json. */
export function stableConfigPath(env, home) {
  return env.QWERTY_STABLE_CONFIG ?? join(home, '.config', 'qwerty-learner', 'stable.json')
}
