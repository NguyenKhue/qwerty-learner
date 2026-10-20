#!/usr/bin/env node
// Usage: yarn data:copy-to-dev <stable data folder> [--yes]
import { copyToDev } from './lib/copy-to-dev.mjs'

const args = process.argv.slice(2)
const yes = args.indexOf('--yes') !== -1
const stableDir = args.find((arg) => !arg.startsWith('--'))
if (!stableDir) {
  console.error('Usage: yarn data:copy-to-dev <stable data folder> [--yes]')
  process.exit(2)
}

try {
  const result = copyToDev({ stableDir, devDir: process.env.QWERTY_DEV_DATA_DIR ?? './.dev-data', yes })
  console.log(result.message)
  process.exit(result.done || !yes ? 0 : 1)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
