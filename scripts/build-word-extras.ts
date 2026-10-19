import type { WordExample } from '@/typings'
import { extractExamplesFromDetail } from '@/utils/examples/fromDetail'
import { readFileSync, writeFileSync } from 'node:fs'

/** An extras sidecar entry: the untouched detail plus the extracted examples. */
type WordExtras = { detail: string; examples?: WordExample[] }

/** Prints an error and exits with a non-zero code. */
function fail(message: string): never {
  console.error(`build-word-extras: ${message}`)
  process.exit(1)
}

/** Checks that a parsed JSON value is a plain object. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const args = process.argv.slice(2)
if (args.length < 2) fail('usage: vite-node -c vitest.config.ts scripts/build-word-extras.ts <in.detail.json> <out.extras.json>')
const [inputPath, outputPath] = args

let input: unknown
try {
  input = JSON.parse(readFileSync(inputPath, 'utf8'))
} catch (error) {
  fail(`cannot read ${inputPath}: ${(error as Error).message}`)
}
if (!isPlainObject(input)) fail(`${inputPath} must contain a plain object of { word: detail }`)

const output: Record<string, WordExtras> = {}
let withExamples = 0
let totalExamples = 0

for (const word of Object.keys(input)) {
  const detail = input[word]
  if (typeof detail !== 'string') fail(`${inputPath} has a non-string detail for "${word}"`)

  const examples = extractExamplesFromDetail(detail)
  output[word] = examples.length > 0 ? { detail, examples } : { detail }
  if (examples.length > 0) {
    withExamples++
    totalExamples += examples.length
  }
}

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`words: ${Object.keys(output).length}, words with examples: ${withExamples}, total examples: ${totalExamples}`)
