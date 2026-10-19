import type { Word } from '@/typings'
import type { QuizLength } from '@/utils/quiz/questions'

/** One sentence to type. `text` is already normalised to characters a standard English keyboard can produce. */
export type SentenceItem = { word: Word; text: string; trans?: string }

/** How many sentences a run has; the same options as the quiz. */
export type SentenceLength = QuizLength
