// @vitest-environment node
import { ToolError, runTool } from './tools'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const node = process.execPath

describe('runTool', () => {
  it('returns what the command printed and its exit code, passing the input on stdin', async () => {
    const result = await runTool(node, ['-e', 'process.stdin.pipe(process.stdout); process.exitCode = 3'], {
      timeoutMs: 5000,
      maxBytes: 1000,
      input: 'hello',
    })
    expect(result).toEqual({ stdout: 'hello', stderr: '', code: 3 })
  })

  it('passes arguments as they are, never through a shell', async () => {
    const result = await runTool(node, ['-e', 'console.log(process.argv[1])', '; echo pwned'], { timeoutMs: 5000, maxBytes: 1000 })
    expect(result.stdout.trim()).toBe('; echo pwned')
  })

  it('reports a missing command', async () => {
    await expect(runTool('/no/such/tool-qwerty', [], { timeoutMs: 1000, maxBytes: 1000 })).rejects.toMatchObject({ kind: 'missing' })
  })

  it('kills a command that runs past its time limit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qwerty-tool-'))
    const pidFile = join(dir, 'pid')
    const script = `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000)`
    const error = await runTool(node, ['-e', script], { timeoutMs: 400, maxBytes: 1000 }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ToolError)
    expect((error as ToolError).kind).toBe('timeout')
    const pid = Number(readFileSync(pidFile, 'utf8'))
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('stops a command whose output passes the size limit', async () => {
    const error = await runTool(node, ['-e', "process.stdout.write('x'.repeat(5000))"], { timeoutMs: 5000, maxBytes: 100 }).catch(
      (e: unknown) => e,
    )
    expect((error as ToolError).kind).toBe('toobig')
  })
})
