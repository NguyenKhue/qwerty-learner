import type { SentenceLength, SentenceMode } from '@/utils/sentences/types'
import { atomWithStorage } from 'jotai/utils'

/** Number of sentences in a run. Always pass the value through `sanitizeSentenceLength` before using it. */
export const sentencesLengthAtom = atomWithStorage<SentenceLength>('sentencesLength', 10)

/** How the sentence is shown. Always pass the value through `sanitizeMode` before using it. */
export const sentencesModeAtom = atomWithStorage<SentenceMode>('sentencesMode', 'word')
