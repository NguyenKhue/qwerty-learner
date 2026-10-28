import { createInterface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'

/** One MCP tool: its name, what it is for, the JSON Schema of its input, and what it does. */
export type McpTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  run(args: Record<string, unknown>): Promise<unknown>
}

/** A tool input the agent got wrong, reported back to it as a tool error with this message. */
export class ToolInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolInputError'
  }
}

type Message = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }

const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const reply = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result })
const failure = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

/** A tool's result as MCP text content: strings as they are, anything else as indented JSON. */
function textContent(value: unknown, isError: boolean) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) }
}

/**
 * The MCP server logic without its transport: answers `initialize`, `ping`, `tools/list` and `tools/call`, ignores
 * notifications, and returns undefined when a message needs no answer. A failing tool comes back as a tool result with
 * `isError`, so the agent reads the message; only a malformed request is a JSON-RPC error.
 */
export function createMcpServer(info: { name: string; version: string; instructions: string; tools: McpTool[] }) {
  const tools = new Map(info.tools.map((tool) => [tool.name, tool]))

  return async function handle(message: Message): Promise<object | undefined> {
    if (!isObject(message) || typeof message.method !== 'string') return failure(message?.id, -32600, 'Invalid request')
    const { id, method } = message
    const params = isObject(message.params) ? message.params : {}
    if (id === undefined || id === null) return undefined

    switch (method) {
      case 'initialize': {
        const asked = params.protocolVersion
        const protocolVersion = typeof asked === 'string' && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0]
        return reply(id, {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: info.name, version: info.version },
          instructions: info.instructions,
        })
      }
      case 'ping':
        return reply(id, {})
      case 'tools/list':
        return reply(id, {
          tools: info.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        })
      case 'tools/call': {
        const tool = typeof params.name === 'string' ? tools.get(params.name) : undefined
        if (!tool) return failure(id, -32602, `Unknown tool "${String(params.name)}"`)
        const args = isObject(params.arguments) ? params.arguments : {}
        try {
          return reply(id, textContent(await tool.run(args), false))
        } catch (error) {
          return reply(id, textContent(error instanceof Error ? error.message : String(error), true))
        }
      }
      default:
        return failure(id, -32601, `Method not found: ${method}`)
    }
  }
}

/** Serves MCP over stdio: one JSON-RPC message per line in, one per line out. Nothing else may be written to `output`. */
export function serveStdio(handle: ReturnType<typeof createMcpServer>, input: Readable, output: Writable): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Infinity })
  const send = (message: object) => output.write(`${JSON.stringify(message)}\n`)
  const pending = new Set<Promise<void>>()

  lines.on('line', (line) => {
    if (line.trim() === '') return
    let message: Message
    try {
      message = JSON.parse(line) as Message
    } catch {
      send(failure(null, -32700, 'Parse error'))
      return
    }
    const job = handle(message)
      .then((answer) => {
        if (answer) send(answer)
      })
      .finally(() => pending.delete(job))
    pending.add(job)
  })

  return new Promise((resolve) => {
    lines.on('close', () => {
      Promise.all(Array.from(pending)).then(() => resolve())
    })
  })
}
