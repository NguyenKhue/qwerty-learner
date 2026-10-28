import { createLibrary, createLibraryTools } from './library'
import { createMcpServer, serveStdio } from './protocol'
import { createStudyTools } from './study'
import { INSTRUCTIONS, createTools, httpRpc } from './tools'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * The MCP server's command line entry: serves the tools over stdio against the data server at `QWERTY_URL` (default the
 * stable server, http://127.0.0.1:4173) and the repo at `QWERTY_REPO` (default the current folder) for the built-in files.
 * Stdout carries protocol messages only; everything else goes to stderr.
 */
const baseUrl = process.env.QWERTY_URL ?? 'http://127.0.0.1:4173'
const root = resolve(process.env.QWERTY_REPO ?? process.cwd())
const rpc = httpRpc(baseUrl)
const library = createLibrary(rpc, root)
const tools = [
  ...createTools(rpc, (path) => readFile(resolve(process.cwd(), path))),
  ...createLibraryTools(rpc, library, root),
  ...createStudyTools(rpc, library, { baseUrl }),
]
const handle = createMcpServer({ name: 'qwerty-learner', version: '0.2.0', instructions: INSTRUCTIONS, tools })

console.error(`qwerty-learner MCP server: data server ${baseUrl}, repo ${root}, ${tools.length} tools`)
serveStdio(handle, process.stdin, process.stdout).then(() => process.exit(0))
