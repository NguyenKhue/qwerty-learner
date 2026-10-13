import type { Word } from '@/typings'

/**
 * Finds the entry of a word in a detail map, ignoring the case of both the word name and the map keys.
 * Only own, string and non-empty entries count, so names such as `constructor` never match Object.prototype.
 */
function findDetail(map: Record<string, string>, key: string): string | undefined {
  const keys = Object.keys(map)
  for (let i = 0; i < keys.length; i++) {
    const mapKey = keys[i]
    if (mapKey.toLowerCase() !== key) continue
    if (!Object.prototype.hasOwnProperty.call(map, mapKey)) continue
    const value = map[mapKey]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return undefined
}

/**
 * Copies the details of the map onto the words that have an entry for them. The input is never mutated:
 * a word with a new detail becomes a new object, every other word stays the very same object.
 */
export function attachDetails(words: Word[], map: Record<string, string> | undefined): Word[] {
  if (!map) return words
  if (Object.keys(map).length === 0) return words

  const result: Word[] = []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const name = typeof word.name === 'string' ? word.name.trim().toLowerCase() : ''
    const detail = word.detail !== undefined ? undefined : findDetail(map, name)
    result.push(detail === undefined ? word : { ...word, detail })
  }
  return result
}

/** Fetches a `{ word: detail }` sidecar file; returns an empty map when it is missing or malformed. */
export async function fetchDetailMap(url: string): Promise<Record<string, string>> {
  try {
    const URL_PREFIX: string = REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''

    const response = await fetch(URL_PREFIX + url)
    if (!response.ok) return {}

    const data = await response.json()
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {}

    const source = data as Record<string, unknown>
    const keys = Object.keys(source)
    const result: Record<string, string> = {}
    for (let i = 0; i < keys.length; i++) {
      const value = source[keys[i]]
      if (typeof value === 'string') result[keys[i]] = value
    }
    return result
  } catch {
    return {}
  }
}
