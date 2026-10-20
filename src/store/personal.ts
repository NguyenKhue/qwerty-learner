import { listAtom } from '@/data/meta'

/** Ids of built-in sets that were turned into the user's own editable sets (hidden from the Library once moved). Kept in the data file. */
export const seededPersonalSetsAtom = listAtom('seededPersonalSets')

/**
 * Markers of the one-time steps already done on the user's own sets: example sentences topped up (`<id>@<version>`) and spelling fixed
 * (`<id>#names1`). Kept in the data file, next to the data they describe.
 */
export const backfilledPersonalExtrasAtom = listAtom('backfilledPersonalExtras')
