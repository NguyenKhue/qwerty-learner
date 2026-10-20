#!/usr/bin/env node
// Runs the data server (dev role, folder ./.dev-data) and Vite together; when one ends or Ctrl+C is pressed, both are stopped.
import { spawn } from 'node:child_process'

const commands = [
  ['server', ['run', '-s', 'server:dev']],
  ['vite', ['run', '-s', 'dev']],
]

const children = commands.map(([name, args]) => {
  const child = spawn('yarn', args, { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--disable-warning=ExperimentalWarning' } })
  child.on('exit', (code) => {
    console.log(`[dev:full] ${name} ended (${code ?? 'signal'}); stopping the rest`)
    shutdown(code ?? 1)
  })
  return child
})

let stopping = false
function shutdown(code) {
  if (stopping) return
  stopping = true
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM')
  setTimeout(() => process.exit(code), 500).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
