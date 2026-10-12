import { dictionaries, idDictionaryMap } from '@/resources/dictionary'
import type { Dictionary } from '@/typings'
import { isCustomDictId } from '@/utils/db/custom-dict'
import { atom } from 'jotai'

export const customDictionariesAtom = atom<Dictionary[]>([])
export const customDictionariesLoadedAtom = atom(false)

export const allDictionariesAtom = atom<Dictionary[]>((get) => get(customDictionariesAtom).concat(dictionaries))

export const dictionaryByIdAtom = atom<Record<string, Dictionary>>((get) => {
  const byId: Record<string, Dictionary> = { ...idDictionaryMap }
  get(customDictionariesAtom).forEach((dict) => {
    byId[dict.id] = dict
  })
  return byId
})

/** A custom dictionary id whose sets have not been read from IndexedDB yet: its info and words are not available. */
export function isCustomDictPending(id: string, customLoaded: boolean): boolean {
  return isCustomDictId(id) && !customLoaded
}

/**
 * Whether the persisted current-dictionary id should be reset to the default.
 * A custom id is kept until the custom sets have been loaded from IndexedDB, so a page reload does not lose the selection.
 */
export function shouldResetDictId(id: string, customLoaded: boolean, byId: Record<string, Dictionary>): boolean {
  if (id in byId) return false
  if (isCustomDictPending(id, customLoaded)) return false
  return true
}
