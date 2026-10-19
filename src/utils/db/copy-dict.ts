import { createCustomDict } from './custom-dict'
import type { CustomDictRecord } from './record'
import type { Dictionary } from '@/typings'
import { attachExtras, fetchWordExtras, sidecarUrlOf } from '@/utils/detail/sidecar'
import { wordListFetcher } from '@/utils/wordListFetcher'

export async function duplicateDictionaryAsCustom(dict: Dictionary, name?: string): Promise<CustomDictRecord> {
  const words = await wordListFetcher(dict.url)
  // Built-in sets keep their long texts and example sentences in a sidecar file, so the copy has to merge it before being stored
  const sidecarUrl = sidecarUrlOf(dict)
  const extras = sidecarUrl ? await fetchWordExtras(sidecarUrl) : undefined
  const wordsWithDetails = attachExtras(words, extras)
  return createCustomDict({
    name: name?.trim() || `${dict.name} (copy)`,
    description: dict.description,
    words: wordsWithDetails
      .filter((w) => typeof w.name === 'string' && w.name.trim() !== '')
      .map((w) => ({ ...w, trans: Array.isArray(w.trans) ? w.trans.filter((t) => typeof t === 'string') : [] })),
  })
}
