import type { RunTool, ToolResult } from './tools'
import { ToolError } from './tools'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Test helper: one recorded call of a fake tool. */
export type ToolCall = { command: string; args: string[]; input?: string }

/**
 * What the fake `yt-dlp` does: the video details it prints for `--dump-single-json`, the subtitle files it can write (by
 * `<lang>.<ext>`, written only for the languages asked for), or how it fails.
 */
export type FakeYtDlp = {
  info?: Record<string, unknown>
  files?: Record<string, string>
  code?: number
  stderr?: string
  /** Exit code of the subtitle download only (the listing still succeeds). */
  downloadCode?: number
  /** How many times YouTube answers 429 Too Many Requests for a language before sending it (Infinity: always). */
  rateLimited?: Record<string, number>
  /** How many times the listing itself answers 429 before it works. */
  listRateLimited?: number
  fail?: ToolError
}

/**
 * Test helper: a `RunTool` that plays `yt-dlp` (listing the video, then writing the asked subtitle files into the `--paths`
 * folder) and `claude` (answering with `translate`). Every call is recorded in `calls`.
 */
export function fakeTools(opts: { ytDlp?: FakeYtDlp; translate?: (sentences: string[]) => string | ToolError }) {
  const calls: ToolCall[] = []
  const runTool: RunTool = async (command, args, o) => {
    calls.push({ command, args, input: o.input })
    if (command.endsWith('yt-dlp')) {
      const y = opts.ytDlp ?? {}
      if (y.fail) throw y.fail
      if (y.code) return { stdout: '', stderr: y.stderr ?? '', code: y.code } as ToolResult
      if (args.indexOf('--dump-single-json') !== -1) {
        if (y.listRateLimited && y.listRateLimited > 0) {
          y.listRateLimited--
          return { stdout: '', stderr: 'ERROR: [youtube] x: HTTP Error 429: Too Many Requests\n', code: 1 }
        }
        return { stdout: JSON.stringify(y.info ?? {}), stderr: '', code: 0 }
      }
      const dir = args[args.indexOf('--paths') + 1]
      const langs = args[args.indexOf('--sub-langs') + 1].split(',')
      const id = new URL(args[args.length - 1]).searchParams.get('v') as string
      let limited = false
      for (const [name, content] of Object.entries(y.files ?? {})) {
        const lang = name.slice(0, name.lastIndexOf('.'))
        if (langs.indexOf(lang) === -1) continue
        const left = y.rateLimited?.[lang] ?? 0
        if (left > 0) {
          if (y.rateLimited) y.rateLimited[lang] = left - 1
          limited = true
          continue
        }
        writeFileSync(join(dir, `${id}.${name}`), content)
      }
      if (limited) {
        return {
          stdout: '',
          stderr: `ERROR: Unable to download video subtitles for '${langs.join(',')}': HTTP Error 429: Too Many Requests\n`,
          code: 1,
        }
      }
      return { stdout: '', stderr: y.downloadCode ? y.stderr ?? '' : '', code: y.downloadCode ?? 0 } as ToolResult
    }
    if (command.endsWith('claude')) {
      const prompt = o.input ?? ''
      const sentences = JSON.parse(prompt.slice(prompt.indexOf('['), prompt.lastIndexOf(']') + 1)) as string[]
      const reply = opts.translate ? opts.translate(sentences) : JSON.stringify(sentences.map((s) => `VI: ${s}`))
      if (reply instanceof ToolError) throw reply
      return { stdout: JSON.stringify({ type: 'result', result: reply }), stderr: '', code: 0 }
    }
    throw new ToolError('missing', `${command} not found`)
  }
  return { runTool, calls }
}
