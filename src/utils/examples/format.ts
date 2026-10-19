import type { WordExample } from '@/typings'

const SEPARATOR = /\s\|\s/

/**
 * Parses `sentence | translation` lines into examples. Blank lines are dropped, a line without a
 * separator is a sentence with no translation and a line without a sentence is dropped.
 */
export function parseExamples(text: string): WordExample[] {
  const lines = text.split(/\r?\n/)
  const result: WordExample[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const match = SEPARATOR.exec(line)
    if (!match) {
      result.push({ text: line.trim() })
      continue
    }
    const sentence = line.slice(0, match.index).trim()
    if (sentence === '') continue
    const trans = line.slice(match.index + match[0].length).trim()
    result.push(trans === '' ? { text: sentence } : { text: sentence, trans })
  }
  return result
}

/** Formats examples as one `sentence | translation` line each; a missing translation keeps the bare sentence. */
export function formatExamples(examples: WordExample[] | undefined): string {
  if (!examples || examples.length === 0) return ''
  return examples.map((example) => (example.trans ? `${example.text} | ${example.trans}` : example.text)).join('\n')
}

/** Repairs stored or imported garbage into valid examples, trimming and deduplicating by text; never throws. */
export function normalizeExamples(value: unknown): WordExample[] {
  if (!Array.isArray(value)) return []

  const result: WordExample[] = []
  const seen = new Set<string>()
  for (let i = 0; i < value.length; i++) {
    try {
      const item = value[i]
      let text = ''
      let trans = ''
      if (typeof item === 'string') {
        text = item.trim()
      } else if (typeof item === 'object' && item !== null) {
        const source = item as { text?: unknown; trans?: unknown }
        if (typeof source.text === 'string') text = source.text.trim()
        if (typeof source.trans === 'string') trans = source.trans.trim()
      }
      if (text === '' || seen.has(text)) continue
      seen.add(text)
      result.push(trans === '' ? { text } : { text, trans })
    } catch {
      // A broken value is skipped, the rest of the list still loads
    }
  }
  return result
}

/** Joins two example lists, keeping the order a then b and deduplicating by text; `undefined` when nothing is left. */
export function mergeExamples(a: WordExample[] | undefined, b: WordExample[] | undefined): WordExample[] | undefined {
  const merged = normalizeExamples([...(a ?? []), ...(b ?? [])])
  return merged.length === 0 ? undefined : merged
}
