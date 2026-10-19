import type { Word, WordExample } from '@/typings'
import { mergeExamples, normalizeExamples } from '@/utils/examples/format'

export type WordExtras = {
  detail?: string
  examples?: WordExample[]
}

/** Cleans one sidecar entry: a string is a legacy detail, an object carries `detail` and `examples`; `undefined` when nothing usable. */
function toExtras(value: unknown): WordExtras | undefined {
  if (typeof value === 'string') return { detail: value }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const entry = value as { detail?: unknown; examples?: unknown }
  const detail = typeof entry.detail === 'string' && entry.detail.trim() !== '' ? entry.detail : undefined
  const examples = normalizeExamples(entry.examples)
  if (detail === undefined && examples.length === 0) return undefined
  const extras: WordExtras = {}
  if (detail !== undefined) extras.detail = detail
  if (examples.length > 0) extras.examples = examples
  return extras
}

/**
 * Finds the extras of a word in the sidecar map, ignoring the case of both the word name and the map keys.
 * Only own, usable entries count, so names such as `constructor` never match Object.prototype.
 */
function findExtras(map: Record<string, WordExtras>, key: string): WordExtras | undefined {
  const keys = Object.keys(map)
  for (let i = 0; i < keys.length; i++) {
    const mapKey = keys[i]
    if (mapKey.toLowerCase() !== key) continue
    if (!Object.prototype.hasOwnProperty.call(map, mapKey)) continue
    return toExtras(map[mapKey])
  }
  return undefined
}

/**
 * Copies the extras of the map onto the words that have an entry for them. The input is never mutated:
 * a word that gains something becomes a new object, every other word stays the very same object.
 */
export function attachExtras(words: Word[], map: Record<string, WordExtras> | undefined): Word[] {
  if (!map) return words
  if (Object.keys(map).length === 0) return words

  const result: Word[] = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const name = typeof word.name === 'string' ? word.name.trim().toLowerCase() : ''
    const hasDetail = word.detail !== undefined
    const hasExamples = Array.isArray(word.examples) && word.examples.length > 0
    if (hasDetail && hasExamples) {
      result.push(word)
      continue
    }
    const extras = findExtras(map, name)
    if (!extras) {
      result.push(word)
      continue
    }
    const detail = hasDetail ? undefined : extras.detail
    const examples = hasExamples ? undefined : extras.examples
    if (detail === undefined && examples === undefined) {
      result.push(word)
      continue
    }
    result.push({ ...word, ...(detail === undefined ? {} : { detail }), ...(examples === undefined ? {} : { examples }) })
  }
  return result
}

/**
 * Like `attachExtras`, but a word that already has example sentences also receives the sidecar sentences it does not have yet:
 * its own come first and duplicates (by text) are dropped; a sentence whose translation is glued to its text is replaced by the repaired one. A detail the word has is never replaced. Words that gain nothing stay
 * the very same object; the input is never mutated.
 */
export function mergeExtras(words: Word[], map: Record<string, WordExtras> | undefined): Word[] {
  if (!map) return words
  if (Object.keys(map).length === 0) return words

  return words.map((word) => {
    const name = typeof word.name === 'string' ? word.name.trim().toLowerCase() : ''
    const extras = findExtras(map, name)
    if (!extras) return word
    const detail = word.detail !== undefined ? undefined : extras.detail
    const own = word.examples ?? []
    // A sentence stored with its translation glued to the text (an old extraction bug) gives way to its repaired version
    const kept = own.filter(
      (example) =>
        example.trans !== undefined ||
        !(extras.examples ?? []).some((e) => e.text !== example.text && example.text.startsWith(`${e.text} (`)),
    )
    const merged = mergeExamples(kept, extras.examples)
    const examples = merged !== undefined && (kept.length !== own.length || merged.length > kept.length) ? merged : undefined
    if (detail === undefined && examples === undefined) return word
    return { ...word, ...(detail === undefined ? {} : { detail }), ...(examples === undefined ? {} : { examples }) }
  })
}

/**
 * Fetches an extras sidecar file. A string value is a legacy detail, an object value carries
 * `detail` and `examples`; returns an empty map when the file is missing or malformed.
 */
export async function fetchWordExtras(url: string): Promise<Record<string, WordExtras>> {
  try {
    const URL_PREFIX: string = REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''

    const response = await fetch(URL_PREFIX + url)
    if (!response.ok) return {}

    const data = await response.json()
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {}

    const source = data as Record<string, unknown>
    const keys = Object.keys(source)
    const result: Record<string, WordExtras> = {}
    for (let i = 0; i < keys.length; i++) {
      const extras = toExtras(source[keys[i]])
      if (extras) result[keys[i]] = extras
    }
    return result
  } catch {
    return {}
  }
}

/** Returns the extras URL of a dictionary, falling back to the legacy `detailUrl` name. */
export function sidecarUrlOf(dict: { extrasUrl?: string; detailUrl?: string }): string | undefined {
  return dict.extrasUrl ?? dict.detailUrl
}
