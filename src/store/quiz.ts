import type { QuizDirection, QuizLength } from '@/utils/quiz/questions'
import { atomWithStorage } from 'jotai/utils'

/** Number of questions. Always pass the value through `sanitizeQuizLength` before using it. */
export const quizLengthAtom = atomWithStorage<QuizLength>('quizLength', 10)

export const quizDirectionAtom = atomWithStorage<QuizDirection>('quizDirection', 'word-to-meaning')
