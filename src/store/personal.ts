import { atomWithStorage } from 'jotai/utils'

/** Ids of built-in sets that were turned into the user's own editable sets (hidden from the Library once moved). */
export const seededPersonalSetsAtom = atomWithStorage<string[]>('seededPersonalSets', [])
