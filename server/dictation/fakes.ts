import type { RunTool, ToolResult } from './tools'
import { ToolError } from './tools'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Test helper: one recorded call of a fake tool. */
export type ToolCall = { command: string; args: string[]; input?: string }

/** What the fake `yt-dlp` does: the files it writes (by subtitle language), its info, or how it fails. */
export type FakeYtDlp = {
  info?: Record<string, unknown>
  subtitles?: Record<string, unknown>
  code?: number
  stderr?: string
  fail?: ToolError
}

/**
 * Test helper: a `RunTool` that plays `yt-dlp` (writing the info and json3 files into the `--paths` folder) and `claude`
 * (answering with `translate`). Every call is recorded in `calls`.
 */
export function fakeTools(opts: { ytDlp?: FakeYtDlp; translate?: (sentences: string[]) => string | ToolError }) {
  const calls: ToolCall[] = []
  const runTool: RunTool = async (command, args, o) => {
    calls.push({ command, args, input: o.input })
    if (command.endsWith('yt-dlp')) {
      const y = opts.ytDlp ?? {}
      if (y.fail) throw y.fail
      const dir = args[args.indexOf('--paths') + 1]
      const url = args[args.length - 1]
      const id = new URL(url).searchParams.get('v') as string
      if (y.info) writeFileSync(join(dir, `${id}.info.json`), JSON.stringify(y.info))
      for (const [lang, json] of Object.entries(y.subtitles ?? {})) writeFileSync(join(dir, `${id}.${lang}.json3`), JSON.stringify(json))
      return { stdout: '', stderr: y.stderr ?? '', code: y.code ?? 0 } as ToolResult
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
