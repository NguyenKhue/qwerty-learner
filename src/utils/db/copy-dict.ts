import { createCustomDict } from './custom-dict'
import type { CustomDictRecord } from './record'
import type { Dictionary } from '@/typings'
import { attachDetails, fetchDetailMap } from '@/utils/detail/sidecar'
import { wordListFetcher } from '@/utils/wordListFetcher'

export async function duplicateDictionaryAsCustom(dict: Dictionary, name?: string): Promise<CustomDictRecord> {
  const words = await wordListFetcher(dict.url)
  // Built-in sets keep their long texts in a sidecar file, so the copy has to merge it before being stored
  const detailMap = dict.detailUrl ? await fetchDetailMap(dict.detailUrl) : undefined
  const wordsWithDetails = attachDetails(words, detailMap)
  return createCustomDict({
    name: name?.trim() || `${dict.name} (copy)`,
    description: dict.description,
    words: wordsWithDetails
      .filter((w) => typeof w.name === 'string' && w.name.trim() !== '')
      .map((w) => ({ ...w, trans: Array.isArray(w.trans) ? w.trans.filter((t) => typeof t === 'string') : [] })),
  })
}
