import type { WordExample } from '@/typings'

export const PAGE_SIZE = 50

type Searchable = { name: string; trans: string | string[]; detail?: string; examples?: WordExample[] }

/** Lowercase, without Vietnamese diacritics (đ becomes d) and with single spaces, so "nghiem ngat" finds "Nghiêm ngặt". */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Positions (in the original list) of the entries that contain every term of the query in their word, meanings, detail or example
 * sentences. An empty query keeps everything. Positions, not copies, so an edit made on a filtered list can be written back to the right entry.
 */
export function filterIndexes(items: Searchable[], query: string): number[] {
  const terms = normalizeForSearch(query)
    .split(' ')
    .filter((term) => term !== '')
  const all: number[] = []
  items.forEach((item, index) => {
    if (terms.length === 0) {
      all.push(index)
      return
    }
    const meanings = Array.isArray(item.trans) ? item.trans.join(' ') : item.trans
    const examples = (item.examples ?? []).map((example) => `${example.text} ${example.trans ?? ''}`).join(' ')
    const haystack = normalizeForSearch(`${item.name} ${meanings} ${item.detail ?? ''} ${examples}`)
    if (terms.every((term) => haystack.indexOf(term) !== -1)) all.push(index)
  })
  return all
}

/** How many entries to show after asking for one more page (starting from `current`, never beyond `total`). */
export function visibleCount(current: number, total: number): number {
  return Math.min(total, current + PAGE_SIZE)
}
