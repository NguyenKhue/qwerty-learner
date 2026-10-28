import type { Word, WordExample } from '@/typings'
import { readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** One built-in dictionary as `src/resources/dictionary.ts` declares it. */
export type RegistryEntry = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  url: string
  extrasUrl?: string
  length: number
  language: string
}

/** The long text of a word kept beside a built-in dictionary (`*.extras.json`), by word name. */
export type ExtrasFile = Record<string, { detail?: string; examples?: WordExample[] }>

/** A suggested dictation video of `public/dictation-videos.json`. */
export type SuggestedVideo = { id: string; title: string; channel: string; category: string }

const REGISTRY = 'src/resources/dictionary.ts'
const SUGGESTED_VIDEOS = 'public/dictation-videos.json'

/** The value of one `key: value,` line of the registry: a quoted string, a number or a list of quoted strings. */
function literal(raw: string): string | number | string[] | undefined {
  const value = raw.trim().replace(/,$/, '')
  const quoted = /^'([^']*)'$|^"([^"]*)"$/.exec(value)
  if (quoted) return quoted[1] ?? quoted[2]
  if (/^\d+$/.test(value)) return Number(value)
  if (value.startsWith('[')) return Array.from(value.matchAll(/'([^']*)'|"([^"]*)"/g), (m) => m[1] ?? m[2])
  return undefined
}

/**
 * The built-in dictionaries of the registry. It is read as text because the module itself pulls in browser code: each entry is
 * an object literal at two spaces of indent with one `key: value,` per line; commented-out entries are skipped.
 */
export function readRegistry(root: string): RegistryEntry[] {
  const lines = readFileSync(join(root, REGISTRY), 'utf8').split('\n')
  const entries: RegistryEntry[] = []
  let fields: Record<string, unknown> | null = null
  for (const line of lines) {
    if (line === '  {') fields = {}
    else if (fields && /^ {2}},?$/.test(line)) {
      if (typeof fields.id === 'string' && typeof fields.url === 'string') {
        entries.push({
          id: fields.id,
          name: String(fields.name ?? fields.id),
          description: String(fields.description ?? ''),
          category: String(fields.category ?? ''),
          tags: Array.isArray(fields.tags) ? (fields.tags as string[]) : [],
          url: fields.url,
          ...(typeof fields.extrasUrl === 'string' ? { extrasUrl: fields.extrasUrl } : {}),
          length: typeof fields.length === 'number' ? fields.length : 0,
          language: String(fields.language ?? ''),
        })
      }
      fields = null
    } else if (fields) {
      const field = /^ {4}(\w+): (.*)$/.exec(line)
      if (field) fields[field[1]] = literal(field[2])
    }
  }
  return entries
}

/** Writes a file through a temporary file in the same folder, so a reader never sees half of it. */
export function writeAtomic(path: string, text: string): void {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`)
  writeFileSync(temporary, text)
  renameSync(temporary, path)
}

/** Writes JSON with the indent and final newline the file already has (2 spaces and a newline for a new file). */
function writeJsonLike(path: string, value: unknown): void {
  let indent = 2
  let newline = '\n'
  try {
    const old = readFileSync(path, 'utf8')
    const found = /\n( +)\S/.exec(old)
    if (found) indent = found[1].length
    newline = old.endsWith('\n') ? '\n' : ''
  } catch {
    // A new file takes the defaults
  }
  writeAtomic(path, JSON.stringify(value, null, indent) + newline)
}

const publicPath = (root: string, url: string) => join(root, 'public', url.replace(/^\/+/, ''))

/** The modification time of a dictionary's file, to know when a cached copy is stale. */
export function dictMtime(root: string, entry: RegistryEntry): number {
  return statSync(publicPath(root, entry.url)).mtimeMs
}

export function readDict(root: string, entry: RegistryEntry): Word[] {
  return JSON.parse(readFileSync(publicPath(root, entry.url), 'utf8')) as Word[]
}

/** Writes a built-in dictionary and, when its word count changed, the `length` of its registry entry. */
export function writeDict(root: string, entry: RegistryEntry, words: Word[]): void {
  writeJsonLike(publicPath(root, entry.url), words)
  if (words.length === entry.length) return
  const registry = join(root, REGISTRY)
  const text = readFileSync(registry, 'utf8')
  const escaped = entry.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const updated = text.replace(new RegExp(`(url: '${escaped}',\\n(?: {4}extrasUrl: '[^']*',\\n)?\\s+length: )\\d+`), `$1${words.length}`)
  if (updated !== text) writeAtomic(registry, updated)
  entry.length = words.length
}

export function readExtras(root: string, entry: RegistryEntry): ExtrasFile {
  if (!entry.extrasUrl) return {}
  try {
    return JSON.parse(readFileSync(publicPath(root, entry.extrasUrl), 'utf8')) as ExtrasFile
  } catch {
    return {}
  }
}

export function writeExtras(root: string, entry: RegistryEntry, extras: ExtrasFile): void {
  if (!entry.extrasUrl) throw new Error(`${entry.id} has no extras file`)
  writeJsonLike(publicPath(root, entry.extrasUrl), extras)
}

export function readSuggestedVideos(root: string): SuggestedVideo[] {
  return JSON.parse(readFileSync(join(root, SUGGESTED_VIDEOS), 'utf8')) as SuggestedVideo[]
}

/** Writes the suggested videos one object per line, as the file is laid out by hand. */
export function writeSuggestedVideos(root: string, videos: SuggestedVideo[]): void {
  const line = (video: SuggestedVideo) =>
    `  { ${Object.entries(video)
      .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
      .join(', ')} }`
  writeAtomic(join(root, SUGGESTED_VIDEOS), `[\n${videos.map(line).join(',\n')}\n]\n`)
}
