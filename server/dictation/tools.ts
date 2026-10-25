import { spawn } from 'node:child_process'

export type ToolResult = { stdout: string; stderr: string; code: number }

/** Runs an external command with an argument list (never through a shell), a time limit and an output size limit. */
export type RunTool = (
  command: string,
  args: string[],
  opts: { timeoutMs: number; maxBytes: number; input?: string; cwd?: string },
) => Promise<ToolResult>

/** A command that could not be found, ran past its time limit, or printed more than its size limit. */
export class ToolError extends Error {
  readonly kind: 'missing' | 'timeout' | 'toobig'

  constructor(kind: 'missing' | 'timeout' | 'toobig', message: string) {
    super(message)
    this.name = 'ToolError'
    this.kind = kind
  }
}

export const runTool: RunTool = (command, args, opts) =>
  new Promise<ToolResult>((resolve, reject) => {
    const child = spawn(command, args, { cwd: opts.cwd, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let bytes = 0
    let settled = false

    const settle = (done: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      done()
    }
    const stop = (error: ToolError) => {
      child.kill('SIGKILL')
      settle(() => reject(error))
    }
    const timer = setTimeout(() => stop(new ToolError('timeout', `${command} did not finish within ${opts.timeoutMs} ms`)), opts.timeoutMs)

    const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
      bytes += chunk.length
      if (bytes > opts.maxBytes) stop(new ToolError('toobig', `${command} printed more than ${opts.maxBytes} bytes`))
      else chunks.push(chunk)
    }
    child.stdout.on('data', collect(stdout))
    child.stderr.on('data', collect(stderr))
    child.on('error', (error: NodeJS.ErrnoException) =>
      settle(() => reject(error.code === 'ENOENT' ? new ToolError('missing', `${command} is not installed or not on the PATH`) : error)),
    )
    child.on('close', (code) =>
      settle(() =>
        resolve({ stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'), code: code ?? -1 }),
      ),
    )
    // A command that exits before reading its input must not crash the server with EPIPE
    child.stdin.on('error', () => undefined)
    child.stdin.end(opts.input ?? '')
  })
