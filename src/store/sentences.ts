import type { SentenceLength } from '@/utils/sentences/types'
import { atomWithStorage } from 'jotai/utils'

/** Number of sentences in a run. Always pass the value through `sanitizeSentenceLength` before using it. */
export const sentencesLengthAtom = atomWithStorage<SentenceLength>('sentencesLength', 10)

/** Whether the sentence is hidden and typed from its translation. Always pass the value through `sanitizeHide` before using it. */
export const sentencesHideAtom = atomWithStorage<boolean>('sentencesHide', false)
