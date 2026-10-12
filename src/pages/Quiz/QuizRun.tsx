import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { reviewCard } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { isActivatableButton } from '@/utils/keyboard'
import { srsEffect } from '@/utils/quiz/effect'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { choose, createQuizSession, currentQuestion, isComplete, next, quizSummary } from '@/utils/quiz/session'
import type { QuizSession } from '@/utils/quiz/session'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

// Enter/Space on a focused button must activate that button, not be swallowed by the hotkey
const ignoreFocusedButton = (e: KeyboardEvent) => isActivatableButton(e.target)

type Props = {
  dictId: string
  questions: QuizQuestion[]
  progress: ICardProgress[]
  onRestart: () => void
  onBack: () => void
}

export default function QuizRun({ dictId, questions, progress, onRestart, onBack }: Props) {
  const [session, setSession] = useState(() => createQuizSession(questions))
  // The guards read this ref (updated synchronously) so a double click or a repeating key cannot answer twice
  const sessionRef = useRef(session)
  const update = useCallback((nextSession: QuizSession) => {
    sessionRef.current = nextSession
    setSession(nextSession)
  }, [])
  const cards = useMemo(() => new Map(progress.map((card): [string, ICardProgress] => [card.word, card])), [progress])
  const [error, setError] = useState('')

  const onChoose = useCallback(
    (optionIndex: number) => {
      const before = sessionRef.current
      const question = currentQuestion(before)
      const after = choose(before, optionIndex)
      if (!question || after === before) return
      update(after)

      const correct = optionIndex === question.answerIndex
      const grade = srsEffect(correct, cards.get(question.word.name), Date.now())
      if (grade) {
        reviewCard(dictId, question.word.name, grade).catch((e) => setError(e instanceof Error ? e.message : 'Could not save your answer'))
      }
    },
    [cards, dictId, update],
  )

  const onNext = useCallback(() => update(next(sessionRef.current)), [update])

  useHotkeys('1', () => onChoose(0), [onChoose])
  useHotkeys('2', () => onChoose(1), [onChoose])
  useHotkeys('3', () => onChoose(2), [onChoose])
  useHotkeys('4', () => onChoose(3), [onChoose])
  useHotkeys('enter,space', onNext, { preventDefault: true, ignoreEventWhen: ignoreFocusedButton }, [onNext])

  const onExit = () => {
    const { results } = sessionRef.current
    if (
      results.length > 0 &&
      !window.confirm('Leave the quiz? Your answers so far are already saved to your study schedule, but this score will be lost.')
    )
      return
    onBack()
  }

  const question = currentQuestion(session)

  if (isComplete(session) || !question) {
    const summary = quizSummary(session)
    return (
      <Layout>
        <div className="flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm text-gray-500">Quiz finished</p>
            <p className="text-4xl font-medium text-gray-800 dark:text-gray-100">
              {summary.correct} / {summary.total}
            </p>
          </div>

          {summary.missed.length > 0 ? (
            <div className="space-y-2 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Missed words</p>
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {summary.missed.map((word) => (
                  <li key={word.name} className="text-gray-800 dark:text-gray-100">
                    <span className="font-medium">{word.name}</span>
                    <span className="text-gray-500"> — {word.trans.join('; ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-emerald-600">No mistakes. Well done!</p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button onClick={onRestart}>Try again</Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  const answered = session.selected !== null
  const correctSoFar = session.results.filter((r) => r.correct).length

  return (
    <Layout>
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            {session.index + 1} / {session.questions.length} · {correctSoFar} correct
          </span>
          <Button size="sm" variant="outline" onClick={onExit}>
            Exit
          </Button>
        </div>

        <div className="flex min-h-[10rem] w-full items-center justify-center rounded-xl bg-white p-8 text-center shadow dark:bg-gray-800">
          <span
            className={`${question.direction === 'word-to-meaning' ? 'text-5xl' : 'text-2xl'} font-medium text-gray-800 dark:text-gray-100`}
          >
            {question.prompt}
          </span>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {question.options.map((option, index) => {
            const isAnswer = index === question.answerIndex
            const isChosen = index === session.selected
            const style = !answered
              ? 'bg-white text-gray-800 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              : isAnswer
              ? 'bg-emerald-500 text-white'
              : isChosen
              ? 'bg-red-500 text-white'
              : 'bg-white text-gray-400 dark:bg-gray-800'
            return (
              <button
                key={index}
                disabled={answered}
                onClick={() => onChoose(index)}
                className={`rounded-lg px-4 py-3 text-left shadow transition-colors ${style}`}
              >
                <span className="mr-2 text-xs opacity-70">{index + 1}</span>
                {option}
              </button>
            )
          })}
        </div>

        <p className="sr-only" aria-live="polite">
          {answered
            ? session.selected === question.answerIndex
              ? 'Correct'
              : `Wrong. The answer is ${question.options[question.answerIndex]}`
            : question.prompt}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button disabled={!answered} onClick={onNext}>
          {session.index + 1 === session.questions.length ? 'Finish' : 'Next'} (Enter)
        </Button>
      </div>
    </Layout>
  )
}
