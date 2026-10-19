import type { Word } from '@/typings'
import type { QuizLength } from '@/utils/quiz/questions'

/** One sentence to type. `text` is already normalised to characters a standard English keyboard can produce. */
export type SentenceItem = {
  word: Word
  text: string
  trans?: string
  /** Where the headword (or its inflected form) stands in `text`; it is the part that is hidden while typing. End is exclusive. */
  target: { start: number; end: number }
}

/** How many sentences a run has; the same options as the quiz. */
export type SentenceLength = QuizLength

/** Which words a run draws from: the ones due or new today, as in the flashcard queue, or every word of the set. */
export type SentenceScope = 'due' | 'all'
