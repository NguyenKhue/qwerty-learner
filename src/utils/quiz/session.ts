import type { QuizQuestion } from './questions'
import type { Word } from '@/typings'

export type QuizResult = { word: Word; correct: boolean }
export type QuizSession = { questions: QuizQuestion[]; index: number; selected: number | null; results: QuizResult[] }

export function createQuizSession(questions: QuizQuestion[]): QuizSession {
  return { questions, index: 0, selected: null, results: [] }
}

export function currentQuestion(session: QuizSession): QuizQuestion | undefined {
  return session.questions[session.index]
}

export function isComplete(session: QuizSession): boolean {
  return session.index >= session.questions.length
}

/** Answers the current question. Ignored when finished, already answered, or the index is not one of the options. */
export function choose(session: QuizSession, optionIndex: number): QuizSession {
  const question = currentQuestion(session)
  if (!question || session.selected !== null) return session
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return session
  return {
    ...session,
    selected: optionIndex,
    results: session.results.concat({ word: question.word, correct: optionIndex === question.answerIndex }),
  }
}

/** Moves to the next question. Ignored until the current question has been answered. */
export function next(session: QuizSession): QuizSession {
  if (isComplete(session) || session.selected === null) return session
  return { ...session, index: session.index + 1, selected: null }
}

export function quizSummary(session: QuizSession): { total: number; correct: number; missed: Word[] } {
  return {
    total: session.results.length,
    correct: session.results.filter((r) => r.correct).length,
    missed: session.results.filter((r) => !r.correct).map((r) => r.word),
  }
}
