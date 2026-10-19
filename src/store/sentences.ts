import type { SentenceLength, SentenceScope } from '@/utils/sentences/types'
import { atomWithStorage } from 'jotai/utils'

/** Number of sentences in a run. Always pass the value through `sanitizeSentenceLength` before using it. */
export const sentencesLengthAtom = atomWithStorage<SentenceLength>('sentencesLength', 10)

/** Which words a run draws from. Always pass the value through `sanitizeScope` before using it. */
export const sentencesScopeAtom = atomWithStorage<SentenceScope>('sentencesScope', 'due')
