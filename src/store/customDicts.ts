import { seededPersonalSetsAtom } from './personal'
import { dictionaries, idDictionaryMap } from '@/resources/dictionary'
import type { Dictionary } from '@/typings'
import { isCustomDictId } from '@/utils/db/custom-dict'
import { atom } from 'jotai'

export const customDictionariesAtom = atom<Dictionary[]>([])
export const customDictionariesLoadedAtom = atom(false)

// A built-in set that became the user's own set is listed once, as that custom set; it still resolves by id (see dictionaryByIdAtom)
export const allDictionariesAtom = atom<Dictionary[]>((get) => {
  const moved = get(seededPersonalSetsAtom)
  return get(customDictionariesAtom).concat(dictionaries.filter((dict) => moved.indexOf(dict.id) === -1))
})

export const dictionaryByIdAtom = atom<Record<string, Dictionary>>((get) => {
  const byId: Record<string, Dictionary> = { ...idDictionaryMap }
  get(customDictionariesAtom).forEach((dict) => {
    byId[dict.id] = dict
  })
  return byId
})

/** Own-property lookup: an id such as 'constructor' must not resolve to a member of Object.prototype. */
export function lookupDictionary(byId: Record<string, Dictionary>, id: string): Dictionary | undefined {
  return Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : undefined
}

/** A custom dictionary id whose sets have not been read from IndexedDB yet: its info and words are not available. */
export function isCustomDictPending(id: string, customLoaded: boolean): boolean {
  return isCustomDictId(id) && !customLoaded
}

export type DictIdStatus = 'valid' | 'pending' | 'unknown'

/** A custom id is `pending` until the custom sets have been read from IndexedDB; ids that name no set (including Object.prototype members) are `unknown`. */
export function classifyDictId(id: string, customLoaded: boolean, byId: Record<string, Dictionary>): DictIdStatus {
  if (lookupDictionary(byId, id)) return 'valid'
  if (isCustomDictPending(id, customLoaded)) return 'pending'
  return 'unknown'
}

/**
 * Whether the persisted current-dictionary id should be reset to the default.
 * A custom id is kept until the custom sets have been loaded from IndexedDB, so a page reload does not lose the selection.
 */
export function shouldResetDictId(id: string, customLoaded: boolean, byId: Record<string, Dictionary>): boolean {
  return classifyDictId(id, customLoaded, byId) === 'unknown'
}
