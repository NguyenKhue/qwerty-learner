import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { reviewQuizAnswer } from '@/utils/db/card-progress'
import { isActivatableButton } from '@/utils/keyboard'
import { describeSaveFailures } from '@/utils/quiz/failures'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { choose, createQuizSession, currentQuestion, isComplete, next, quizSummary } from '@/utils/quiz/session'
import type { QuizSession } from '@/utils/quiz/session'
import { useCallback, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import IconCheck from '~icons/tabler/check'
import IconX from '~icons/tabler/x'

// Enter/Space on a focused button must activate that button, not be swallowed by the hotkey
const ignoreFocusedButton = (e: KeyboardEvent) => isActivatableButton(e.target)

// Each child of a `.stagger` container enters one step after the previous one
const staggerStep = (i: number) => ({ '--i': i } as CSSProperties)

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
        <ScrollCenter className="max-w-2xl">
          <div className="stagger flex w-full flex-col items-center gap-6">
            <Card className="w-full" style={staggerStep(0)}>
              <p className="text-sm text-muted-foreground">Quiz finished</p>
              <p className="num text-5xl font-semibold tracking-tight">
                {summary.correct} / {summary.total}
              </p>
            </Card>

            {summary.missed.length > 0 ? (
              <Card className="w-full space-y-2" style={staggerStep(1)}>
                <p className="text-sm font-medium text-muted-foreground">Missed words</p>
                <ul className="space-y-2">
                  {summary.missed.map((word) => (
                    <li key={word.name}>
                      <span className="font-medium">{word.name}</span>
                      <span className="text-muted-foreground"> — {word.trans.join('; ')}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <p className="font-medium text-accent" style={staggerStep(1)}>
                No mistakes. Well done!
              </p>
            )}

            {failure && (
              <p role="alert" className="text-sm text-destructive" style={staggerStep(2)}>
                {failure}
              </p>
            )}

            <div className="flex gap-3" style={staggerStep(3)}>
              <Button className="h-12 px-6 text-base shadow-2" onClick={onRestart}>
                Try again
              </Button>
              <Button variant="outline" className="h-12 px-6 text-base" onClick={onBack}>
                Back
              </Button>
            </div>
          </div>
        </ScrollCenter>
      </ModeFrame>
    )
  }

  const answered = session.selected !== null
  const correctSoFar = session.results.filter((r) => r.correct).length
  const progress = session.questions.length > 0 ? (session.index + 1) / session.questions.length : 0

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-3xl gap-8">
        <div className="flex w-full flex-col gap-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="num">
              {session.index + 1} / {session.questions.length} · {correctSoFar} correct
            </span>
            <Button size="sm" variant="outline" className="h-11" onClick={onExit}>
              Exit
            </Button>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-enter ease-out"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        </div>

        <Card className="flex min-h-[10rem] w-full items-center justify-center rounded-2xl p-6 text-center shadow-2 sm:p-8">
          <span className="text-3xl font-semibold tracking-tight">{question.prompt}</span>
        </Card>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {question.options.map((option, index) => {
            const isAnswer = index === question.answerIndex
            const isChosen = index === session.selected
            const state = !answered
              ? 'border-border bg-card text-card-foreground shadow-1 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2 active:scale-[0.99]'
              : isAnswer
              ? 'border-accent bg-accent/10 text-foreground shadow-1 animate-pop'
              : isChosen
              ? 'border-destructive bg-destructive/10 text-foreground shadow-1 animate-shake'
              : 'border-border bg-card text-muted-foreground shadow-1'
            return (
              <button
                key={index}
                disabled={answered}
                onClick={() => onChoose(index)}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 text-left transition-[transform,box-shadow,border-color,background-color] duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${state}`}
              >
                <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 break-words">{option}</span>
                {answered && isAnswer && <IconCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />}
                {answered && isChosen && !isAnswer && <IconX aria-hidden="true" className="h-5 w-5 shrink-0 text-destructive" />}
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

        <Button className="h-12 px-6 text-base shadow-2" disabled={!answered} onClick={onNext}>
          {session.index + 1 === session.questions.length ? 'Finish' : 'Next'} (Enter)
        </Button>
      </ScrollCenter>
    </ModeFrame>
  )
}
