// @vitest-environment node
import { ConfigError, parseConfig } from './config'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const cwd = '/work/qwerty-learner'
const parse = (argv: string[], env: Record<string, string | undefined> = {}) => parseConfig(argv, env, { cwd })

describe('parseConfig for the dev role', () => {
  it('defaults to the dev folder inside the working folder, port 5180 and no static files', () => {
    expect(parse([])).toEqual({ role: 'dev', dir: join(cwd, '.dev-data'), port: 5180, staticDir: undefined })
    expect(parse(['--role', 'dev'])).toMatchObject({ role: 'dev' })
  })

  it('takes the folder, port and static folder from the flags and resolves relative folders against the working folder', () => {
    expect(parse(['--data', 'some/dir', '--port', '6000', '--static', 'build'])).toEqual({
      role: 'dev',
      dir: join(cwd, 'some/dir'),
      port: 6000,
      staticDir: join(cwd, 'build'),
    })
    expect(parse(['--data', '/abs/dir']).dir).toBe('/abs/dir')
  })

  it('lets the flag win over the environment, and uses the environment when there is no flag', () => {
    expect(parse(['--data', '/flag'], { QWERTY_DATA_DIR: '/env' }).dir).toBe('/flag')
    expect(parse([], { QWERTY_DATA_DIR: '/env' }).dir).toBe('/env')
  })

  it('accepts port 0 (any free port) and refuses ports that are not a number between 0 and 65535', () => {
    expect(parse(['--port', '0']).port).toBe(0)
    for (const bad of ['abc', '70000', '-1', '1.5', '']) expect(() => parse(['--port', bad])).toThrow(ConfigError)
  })
})

describe('parseConfig for the stable role', () => {
  it('refuses to start without an explicit data folder, so it can never fall back to a default', () => {
    expect(() => parse(['--role', 'stable'])).toThrow(ConfigError)
    expect(() => parse(['--role', 'stable'])).toThrow(/data folder/i)
  })

  it('takes the data folder from the flag or from QWERTY_DATA_DIR and defaults to port 4173', () => {
    expect(parse(['--role', 'stable', '--data', '/home/me/qwerty-data'])).toEqual({
      role: 'stable',
      dir: '/home/me/qwerty-data',
      port: 4173,
      staticDir: undefined,
    })
    expect(parse(['--role', 'stable'], { QWERTY_DATA_DIR: '/home/me/qwerty-data' }).dir).toBe('/home/me/qwerty-data')
  })

  it('refuses a data folder inside the project working folder, where it could be committed or wiped with it', () => {
    expect(() => parse(['--role', 'stable', '--data', join(cwd, '.dev-data')])).toThrow(ConfigError)
    expect(() => parse(['--role', 'stable', '--data', 'data'])).toThrow(ConfigError)
    expect(() => parse(['--role', 'stable', '--data', cwd])).toThrow(ConfigError)
    expect(() => parse(['--role', 'stable', '--data', resolve(cwd, '..', 'qwerty-data')])).not.toThrow()
  })
})

describe('parseConfig errors', () => {
  it('refuses an unknown flag, a flag without a value and a role that does not exist', () => {
    expect(() => parse(['--nope'])).toThrow(ConfigError)
    expect(() => parse(['--port'])).toThrow(ConfigError)
    expect(() => parse(['--data'])).toThrow(ConfigError)
    expect(() => parse(['--role', 'prod'])).toThrow(ConfigError)
    expect(() => parse(['stray'])).toThrow(ConfigError)
  })
})

describe('parseConfig for the dictation tools', () => {
  it('leaves the tool paths unset by default, so the server looks them up on the PATH', () => {
    expect(parse([]).ytDlp).toBeUndefined()
    expect(parse([]).claude).toBeUndefined()
  })

  it('takes the tool paths from the flags or the environment, the flag winning', () => {
    expect(parse(['--yt-dlp', '/opt/homebrew/bin/yt-dlp', '--claude', '/Users/me/.local/bin/claude'])).toMatchObject({
      ytDlp: '/opt/homebrew/bin/yt-dlp',
      claude: '/Users/me/.local/bin/claude',
    })
    expect(parse([], { QWERTY_YT_DLP: '/env/yt-dlp', QWERTY_CLAUDE: '/env/claude' })).toMatchObject({
      ytDlp: '/env/yt-dlp',
      claude: '/env/claude',
    })
    expect(parse(['--yt-dlp', '/flag/yt-dlp'], { QWERTY_YT_DLP: '/env/yt-dlp' }).ytDlp).toBe('/flag/yt-dlp')
  })
})
