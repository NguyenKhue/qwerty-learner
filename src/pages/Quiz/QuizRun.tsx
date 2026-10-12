import { ModeFrame, Panel } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { reviewQuizAnswer } from '@/utils/db/card-progress'
import { isActivatableButton } from '@/utils/keyboard'
import { describeSaveFailures } from '@/utils/quiz/failures'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { choose, createQuizSession, currentQuestion, isComplete, next, quizSummary } from '@/utils/quiz/session'
import type { QuizSession } from '@/utils/quiz/session'
import { useCallback, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

// Enter/Space on a focused button must activate that button, not be swallowed by the hotkey
const ignoreFocusedButton = (e: KeyboardEvent) => isActivatableButton(e.target)

type Props = {
  dictId: string
  questions: QuizQuestion[]
  onRestart: () => void
  onBack: () => void
}

export default function QuizRun({ dictId, questions, onRestart, onBack }: Props) {
  const [session, setSession] = useState(() => createQuizSession(questions))
  // The guards read this ref (updated synchronously) so a double click or a repeating key cannot answer twice
  const sessionRef = useRef(session)
  const update = useCallback((nextSession: QuizSession) => {
    sessionRef.current = nextSession
    setSession(nextSession)
  }, [])
  const [failedWords, setFailedWords] = useState<string[]>([])

  const onChoose = useCallback(
    (optionIndex: number) => {
      const before = sessionRef.current
      const question = currentQuestion(before)
      const after = choose(before, optionIndex)
      if (!question || after === before) return
      update(after)

      // Decided inside the database transaction from the card's current state (it may have changed in another tab)
      const word = question.word.name
      reviewQuizAnswer(dictId, word, optionIndex === question.answerIndex).catch(() => setFailedWords((previous) => previous.concat(word)))
    },
    [dictId, update],
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

  const failure = describeSaveFailures(failedWords)
  const question = currentQuestion(session)

  if (isComplete(session) || !question) {
    const summary = quizSummary(session)
    return (
      <ModeFrame>
        <ScrollCenter className="max-w-2xl gap-6">
          <Panel className="w-full">
            <p className="text-sm text-muted-foreground">Quiz finished</p>
            <p className="text-4xl font-semibold">
              {summary.correct} / {summary.total}
            </p>
          </Panel>

          {summary.missed.length > 0 ? (
            <Panel className="w-full space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Missed words</p>
              <ul className="space-y-2">
                {summary.missed.map((word) => (
                  <li key={word.name}>
                    <span className="font-medium">{word.name}</span>
                    <span className="text-muted-foreground"> — {word.trans.join('; ')}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <p className="font-medium text-accent">No mistakes. Well done!</p>
          )}

          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}

          <div className="flex gap-3">
            <Button onClick={onRestart}>Try again</Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </ScrollCenter>
      </ModeFrame>
    )
  }

  const answered = session.selected !== null
  const correctSoFar = session.results.filter((r) => r.correct).length

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-3xl gap-8">
        <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
          <span>
            {session.index + 1} / {session.questions.length} · {correctSoFar} correct
          </span>
          <Button size="sm" variant="outline" onClick={onExit}>
            Exit
          </Button>
        </div>

        <Panel className="flex min-h-[10rem] w-full items-center justify-center p-8 text-center">
          <span className={`${question.direction === 'word-to-meaning' ? 'text-4xl md:text-5xl' : 'text-2xl'} font-semibold`}>
            {question.prompt}
          </span>
        </Panel>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {question.options.map((option, index) => {
            const isAnswer = index === question.answerIndex
            const isChosen = index === session.selected
            const style = !answered
              ? 'border-border bg-card text-card-foreground hover:bg-muted'
              : isAnswer
              ? 'border-accent bg-accent text-accent-foreground'
              : isChosen
              ? 'border-destructive bg-destructive text-destructive-foreground'
              : 'border-border bg-card text-muted-foreground'
            return (
              <button
                key={index}
                disabled={answered}
                onClick={() => onChoose(index)}
                className={`min-h-[48px] rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${style}`}
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

        {failure && (
          <p role="alert" className="text-sm text-destructive">
            {failure}
          </p>
        )}

        <Button disabled={!answered} onClick={onNext}>
          {session.index + 1 === session.questions.length ? 'Finish' : 'Next'} (Enter)
        </Button>
      </ScrollCenter>
    </ModeFrame>
  )
}
