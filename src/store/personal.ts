import { atomWithStorage } from 'jotai/utils'

/** Ids of built-in sets that were turned into the user's own editable sets (hidden from the Library once moved). */
export const seededPersonalSetsAtom = atomWithStorage<string[]>('seededPersonalSets', [])

/** Ids of built-in sets whose already-seeded copy was topped up with the extras (details, examples) of the built-in file. */
export const backfilledPersonalExtrasAtom = atomWithStorage<string[]>('backfilledPersonalExtras', [])
