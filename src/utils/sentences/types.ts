import type { Word } from '@/typings'
import type { QuizLength } from '@/utils/quiz/questions'

/** One sentence to type. `text` is already normalised to characters a standard English keyboard can produce. */
export type SentenceItem = {
  word: Word
  text: string
  trans?: string
  /** Where the headword (or its inflected form) stands in `text`; missing when it was not found. End is exclusive. */
  target?: { start: number; end: number }
}

/**
 * How a sentence is shown: `word` shows the sentence with only the target word masked, `copy` shows it whole,
 * `sentence` shows only its translation.
 */
export type SentenceMode = 'word' | 'copy' | 'sentence'

/** How many sentences a run has; the same options as the quiz. */
export type SentenceLength = QuizLength
