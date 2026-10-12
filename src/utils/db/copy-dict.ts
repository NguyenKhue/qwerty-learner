import { createCustomDict } from './custom-dict'
import type { CustomDictRecord } from './record'
import type { Dictionary } from '@/typings'
import { wordListFetcher } from '@/utils/wordListFetcher'

export async function duplicateDictionaryAsCustom(dict: Dictionary, name?: string): Promise<CustomDictRecord> {
  const words = await wordListFetcher(dict.url)
  return createCustomDict({
    name: name?.trim() || `${dict.name} (copy)`,
    description: dict.description,
    words: words
      .filter((w) => typeof w.name === 'string' && w.name.trim() !== '')
      .map((w) => ({ ...w, trans: Array.isArray(w.trans) ? w.trans.filter((t) => typeof t === 'string') : [] })),
  })
}
