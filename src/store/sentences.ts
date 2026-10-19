import type { SentenceLength } from '@/utils/sentences/types'
import { atomWithStorage } from 'jotai/utils'

/** Number of sentences in a run. Always pass the value through `sanitizeSentenceLength` before using it. */
export const sentencesLengthAtom = atomWithStorage<SentenceLength>('sentencesLength', 10)
