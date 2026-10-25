import type { DictationItem } from './items'
import { typeKey } from '@/utils/sentences/session'
import type { SentenceSession } from '@/utils/sentences/session'

/**
 * Feeds one key to a dictation run. Matching ignores case and punctuation, as the sentence was heard, not read: a capital letter
 * counts as its lowercase letter and a punctuation key is ignored (neither right nor wrong).
 */
export function typeDictationKey(s: SentenceSession<DictationItem>, key: string, now: number): SentenceSession<DictationItem> {
  if (key.length !== 1) return s
  const ch = key === '’' || key === '‘' ? "'" : key.toLowerCase()
  if (!/^[a-z0-9' ]$/.test(ch)) return s
  return typeKey(s, ch, now)
}
