import type { Word, WordExample } from '@/typings'
import { normalizeExamples } from '@/utils/examples/format'

/** `null` when `trans` is already a list of strings; otherwise the repaired list. */
function repairedTrans(trans: unknown): string[] | null {
  if (Array.isArray(trans) && trans.every((item) => typeof item === 'string')) return null
  const list: unknown[] = Array.isArray(trans) ? trans : typeof trans === 'string' ? [trans] : []
  return list.filter((item): item is string => typeof item === 'string')
}

const isExample = (item: unknown): item is WordExample => {
  if (!item || typeof item !== 'object') return false
  const example = item as WordExample
  return typeof example.text === 'string' && (example.trans === undefined || typeof example.trans === 'string')
}

/** `null` when `examples` is already a list of examples; otherwise the repaired list. */
function repairedExamples(examples: unknown): WordExample[] | null {
  if (examples === undefined) return null
  if (Array.isArray(examples) && examples.every(isExample)) return null
  return normalizeExamples(examples)
}

/**
 * Makes a word list read from a dictionary file safe to use: some built-in files have `trans` as null, as a plain string, missing,
 * or with null entries. Clean words are returned as the very same objects; entries that are not words are dropped.
 */
export function normalizeWordList(raw: unknown): Word[] {
  if (!Array.isArray(raw)) return []
  const result: Word[] = []
  raw.forEach((item: unknown) => {
    if (!item || typeof item !== 'object' || typeof (item as Word).name !== 'string') return
    const word = item as Word
    const trans = repairedTrans(word.trans)
    const detailOk = word.detail === undefined || typeof word.detail === 'string'
    const examples = repairedExamples(word.examples)
    if (trans === null && typeof word.usphone === 'string' && typeof word.ukphone === 'string' && detailOk && examples === null) {
      result.push(word)
      return
    }
    const repaired: Word = {
      ...word,
      trans: trans ?? word.trans,
      usphone: typeof word.usphone === 'string' ? word.usphone : '',
      ukphone: typeof word.ukphone === 'string' ? word.ukphone : '',
    }
    if (!detailOk) delete repaired.detail
    if (examples !== null) {
      if (examples.length > 0) repaired.examples = examples
      else delete repaired.examples
    }
    result.push(repaired)
  })
  return result
}
