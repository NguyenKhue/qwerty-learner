// @vitest-environment node
import { buildPlist, parseBuildArgs, parseStableConfig, swapInto } from './lib/stable.mjs'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const HOME = '/Users/me'

describe('parseStableConfig', () => {
  it('reads the data folder, the port and the install folder, with defaults for the last two', () => {
    expect(parseStableConfig(JSON.stringify({ dataDir: '/Users/me/Documents/qwerty-data' }), HOME)).toEqual({
      dataDir: '/Users/me/Documents/qwerty-data',
      port: 4173,
      installDir: '/Users/me/stable/qwerty',
    })
    expect(parseStableConfig(JSON.stringify({ dataDir: '/d', port: 8000, installDir: '/i' }), HOME)).toEqual({
      dataDir: '/d',
      port: 8000,
      installDir: '/i',
    })
  })

  it('expands ~ to the home folder', () => {
    expect(parseStableConfig(JSON.stringify({ dataDir: '~/qwerty-data', installDir: '~/apps/qwerty' }), HOME)).toMatchObject({
      dataDir: '/Users/me/qwerty-data',
      installDir: '/Users/me/apps/qwerty',
    })
  })

  it('refuses a missing or relative data folder, a bad port, text that is not JSON, and a data folder inside the install folder', () => {
    expect(() => parseStableConfig('{}', HOME)).toThrow(/dataDir/)
    expect(() => parseStableConfig(JSON.stringify({ dataDir: 'relative/dir' }), HOME)).toThrow(/absolute/)
    expect(() => parseStableConfig(JSON.stringify({ dataDir: '/d', port: 'x' }), HOME)).toThrow(/port/)
    expect(() => parseStableConfig(JSON.stringify({ dataDir: '/d', port: 70000 }), HOME)).toThrow(/port/)
    expect(() => parseStableConfig('not json', HOME)).toThrow(/JSON/)
    expect(() => parseStableConfig(JSON.stringify({ dataDir: '/i/data', installDir: '/i' }), HOME)).toThrow(/inside/)
  })
})

describe('buildPlist', () => {
  const config = { dataDir: '/Users/me/Documents/qwerty-data', port: 4173, installDir: '/Users/me/stable/qwerty' }
  const plist = buildPlist({
    ...config,
    nodePath: '/usr/local/bin/node',
    label: 'vn.khue.qwerty-learner',
    logPath: '/Users/me/Library/Logs/qwerty-learner.log',
  })

  it('starts the bundled server with the stable role, the data folder, the port and the built files, at login, and restarts it after a crash', () => {
    expect(plist).toContain('<string>vn.khue.qwerty-learner</string>')
    for (const argument of [
      '/usr/local/bin/node',
      '/Users/me/stable/qwerty/server.mjs',
      '--role',
      'stable',
      '--data',
      config.dataDir,
      '--port',
      '4173',
      '--static',
      '/Users/me/stable/qwerty/site',
    ]) {
      expect(plist).toContain(`<string>${argument}</string>`)
    }
    expect(plist).toContain('<key>RunAtLoad</key>')
    expect(plist).toMatch(/<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key>\s*<false\/>/)
    expect(plist).toContain('<key>StandardOutPath</key>')
    expect(plist).toContain('/Users/me/Library/Logs/qwerty-learner.log')
  })

  it('runs from the install folder, never from the project, and silences the experimental warning', () => {
    expect(plist).toMatch(/<key>WorkingDirectory<\/key>\s*<string>\/Users\/me\/stable\/qwerty<\/string>/)
    expect(plist).toContain('--disable-warning=ExperimentalWarning')
  })

  it('escapes characters that mean something in XML', () => {
    const odd = buildPlist({ ...config, dataDir: '/Users/me/R&D <data>', nodePath: '/n', label: 'x', logPath: '/l' })
    expect(odd).toContain('/Users/me/R&amp;D &lt;data&gt;')
    expect(odd).not.toContain('R&D <data>')
  })
})

describe('parseBuildArgs', () => {
  it('has no ref by default and takes --ref, --out and --install', () => {
    expect(parseBuildArgs([])).toEqual({ ref: undefined, out: undefined, install: false })
    expect(parseBuildArgs(['--ref', 'v1', '--out', '/o', '--install'])).toEqual({ ref: 'v1', out: '/o', install: true })
  })

  it('refuses an unknown argument and a flag without a value', () => {
    expect(() => parseBuildArgs(['--nope'])).toThrow(/Unknown/)
    expect(() => parseBuildArgs(['--ref'])).toThrow(/needs a value/)
  })
})

describe('swapInto', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'qwerty-swap-'))
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const makeBuild = (name: string, text: string) => {
    const dir = join(root, name)
    mkdirSync(join(dir, 'site'), { recursive: true })
    writeFileSync(join(dir, 'site', 'index.html'), text)
    writeFileSync(join(dir, 'server.mjs'), text)
    return dir
  }

  it('puts a new build in place and removes the old one', () => {
    const install = join(root, 'install')
    swapInto(install, makeBuild('first', 'one'))
    expect(readFileSync(join(install, 'site', 'index.html'), 'utf8')).toBe('one')
    swapInto(install, makeBuild('second', 'two'))
    expect(readFileSync(join(install, 'site', 'index.html'), 'utf8')).toBe('two')
    expect(readFileSync(join(install, 'server.mjs'), 'utf8')).toBe('two')
    expect(existsSync(join(install, 'site.old'))).toBe(false)
  })

  it('refuses a build that is missing a part and leaves the installed one untouched', () => {
    const install = join(root, 'install')
    swapInto(install, makeBuild('first', 'one'))
    const broken = join(root, 'broken')
    mkdirSync(broken)
    writeFileSync(join(broken, 'server.mjs'), 'x')
    expect(() => swapInto(install, broken)).toThrow(/site/)
    expect(readFileSync(join(install, 'site', 'index.html'), 'utf8')).toBe('one')
  })
})

describe('the dictation tool paths in the stable settings', () => {
  it('expands ~/ and refuses a relative path', () => {
    expect(parseStableConfig(JSON.stringify({ dataDir: '/d', ytDlpPath: '~/bin/yt-dlp', claudePath: '/c/claude' }), HOME)).toMatchObject({
      ytDlpPath: `${HOME}/bin/yt-dlp`,
      claudePath: '/c/claude',
    })
    expect(() => parseStableConfig(JSON.stringify({ dataDir: '/d', ytDlpPath: 'bin/yt-dlp' }), HOME)).toThrow(/ytDlpPath/)
    expect(() => parseStableConfig(JSON.stringify({ dataDir: '/d', claudePath: 5 }), HOME)).toThrow(/claudePath/)
  })

  it('passes the tool paths to the server only when they are set', () => {
    const base = { nodePath: '/n', installDir: '/i', dataDir: '/d', port: 4173, logPath: '/l' }
    expect(buildPlist(base)).not.toContain('--yt-dlp')
    const plist = buildPlist({ ...base, ytDlpPath: '/opt/homebrew/bin/yt-dlp', claudePath: '/u/claude' })
    expect(plist).toContain('<string>--yt-dlp</string>\n    <string>/opt/homebrew/bin/yt-dlp</string>')
    expect(plist).toContain('<string>--claude</string>\n    <string>/u/claude</string>')
  })
})
