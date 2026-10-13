import FlipCard from './FlipCard'
import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { Button } from '@/components/ui/button'
import { reviewCard } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { parseDetail } from '@/utils/detail/format'
import { attachDetails } from '@/utils/detail/sidecar'
import { isActivatableButton } from '@/utils/keyboard'
import { createGrader } from '@/utils/srs/grader'
import type { QueueItem } from '@/utils/srs/queue'
import { queueCounts } from '@/utils/srs/queue'
import { GRADES, previewLabels } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'
import { createSession, currentItem, toggleFlip } from '@/utils/srs/session'
import type { StudySession as SessionState } from '@/utils/srs/session'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

// Space on a focused button must activate that button, not be swallowed by the hotkey
const ignoreFocusedButton = (e: KeyboardEvent) => isActivatableButton(e.target)

export type SessionSummary = { reviewed: number; again: number }

type Props = {
  dictId: string
  queue: QueueItem[]
  progress: ICardProgress[]
  reverse: boolean
  details?: Record<string, string>
  onFinish: (summary: SessionSummary) => void
}

// Grade colours are tokens only: the label carries the meaning, the surface stays quiet
const GRADE_STYLE: Record<Grade, string> = {
  again: 'text-destructive hover:bg-destructive/10',
  hard: 'text-foreground hover:bg-muted',
  good: 'text-primary hover:bg-primary/10',
  easy: 'text-accent hover:bg-accent/10',
}
const GRADE_NAME: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

export default function StudySession({ dictId, queue, progress, reverse, details, onFinish }: Props) {
  const [session, setSession] = useState(() => createSession(queue))
  // The session guards read this ref, which is updated synchronously, instead of the value captured by the last render
  const sessionRef = useRef(session)
  const updateSession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])
  const [cards, setCards] = useState(() => new Map(progress.map((card): [string, ICardProgress] => [card.word, card])))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const finished = useRef(false)

  const graderRef = useRef<(grade: Grade) => Promise<void>>()
  if (!graderRef.current) {
    graderRef.current = createGrader({
      getSession: () => sessionRef.current,
      setSession: updateSession,
      save: async (word, grade) => {
        const saved = await reviewCard(dictId, word, grade)
        setCards((prev) => {
          const next = new Map(prev)
          next.set(saved.word, saved)
          return next
        })
      },
      onBusy: (busy) => {
        setSaving(busy)
        if (busy) setError('')
      },
      onError: (e) => setError(e instanceof Error ? e.message : 'Could not save your answer'),
    })
  }

  const item = currentItem(session)
  const counts = queueCounts(session.queue)

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinish({ reviewed: sessionRef.current.reviewed, again: sessionRef.current.again })
  }, [onFinish])

  useEffect(() => {
    if (!item) finish()
  }, [item, finish])

  const onFlip = useCallback(() => updateSession(toggleFlip(sessionRef.current)), [updateSession])
  const onGrade = useCallback((grade: Grade) => {
    graderRef.current?.(grade)
  }, [])

  useHotkeys('space', onFlip, { preventDefault: true, ignoreEventWhen: ignoreFocusedButton }, [onFlip])
  useHotkeys('1', () => onGrade('again'), [onGrade])
  useHotkeys('2', () => onGrade('hard'), [onGrade])
  useHotkeys('3', () => onGrade('good'), [onGrade])
  useHotkeys('4', () => onGrade('easy'), [onGrade])

  // One timestamp per shown/revealed card, so the labels do not depend on when React happens to re-render
  const currentName = item?.word.name
  const labelsNow = useMemo(() => Date.now(), [currentName, session.revealed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null

  const { word } = item
  const phonetic = word.usphone || word.ukphone
  const labels = previewLabels(cards.get(word.name), { dict: dictId, word: word.name }, labelsNow)

  const wordBlock = (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <span className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">{word.name}</span>
        <WordPronunciationIcon key={word.name} word={word} lang="en" iconClassName="h-8 w-8" />
      </div>
      {phonetic && <span className="text-lg text-muted-foreground">[{phonetic}]</span>}
    </div>
  )
  const meaningBlock = (
    <ul className="space-y-1 text-center text-xl text-foreground">
      {word.trans.map((meaning, i) => (
        <li key={i}>{meaning}</li>
      ))}
    </ul>
  )

  // The sidecar of this set, when it has one, carries the long meanings that only the back of the card shows
  const shown = attachDetails([word], details)[0]
  const detailLines = shown.detail ? parseDetail(shown.detail) : []
  const detailBlock =
    detailLines.length === 0 ? null : (
      <div className="space-y-2">
        {detailLines.map((line, i) =>
          i === 0 ? (
            <p key={i} className="text-lg font-semibold">
              {line.label ? `${line.label}: ${line.text}` : line.text}
            </p>
          ) : (
            <p key={i} className="text-sm leading-relaxed">
              {line.label ? (
                <>
                  <span className="font-semibold text-foreground">{line.label}</span>:{' '}
                  <span className="text-muted-foreground">{line.text}</span>
                </>
              ) : (
                line.text
              )}
            </p>
          ),
        )}
      </div>
    )

  const front = (
    <div className="flex flex-col items-center gap-6">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{item.kind === 'new' ? 'New' : 'Due'}</span>
      {reverse ? meaningBlock : wordBlock}
    </div>
  )
  const back = reverse ? (
    <div className="flex flex-col items-center gap-6">
      {wordBlock}
      {detailBlock && <div className="w-full border-t border-border pt-6">{detailBlock}</div>}
    </div>
  ) : detailBlock ? (
    detailBlock
  ) : (
    <div className="flex flex-col items-center gap-4">
      <span className="text-sm text-muted-foreground">{word.name}</span>
      {meaningBlock}
    </div>
  )

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-3xl gap-8">
        <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
          <span>
            New {counts.new} · Due {counts.due}
          </span>
          <Button size="sm" variant="outline" disabled={saving} onClick={finish}>
            Exit
          </Button>
        </div>

        {/* Keyed by the word so the scroll position of the back never leaks into the next card, and so the next card fades up */}
        <div key={word.name} className="w-full animate-enter-up">
          <FlipCard flipped={session.flipped} onFlip={onFlip} front={front} back={back} />
        </div>

        <p className="text-xs text-muted-foreground">Tap the card or press Space to flip it</p>

        <p className="sr-only" aria-live="polite">
          {session.flipped
            ? `${word.name}: ${word.trans.join('; ')}`
            : `${item.kind === 'new' ? 'New' : 'Due'} card: ${reverse ? word.trans.join('; ') : word.name}`}
        </p>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((grade, index) => (
            <button
              key={grade}
              disabled={!session.revealed}
              onClick={() => onGrade(grade)}
              className={`flex min-h-[56px] flex-col items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold shadow-1 transition-[transform,box-shadow,background-color] duration-fast ease-out hover:-translate-y-0.5 hover:shadow-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-30 ${GRADE_STYLE[grade]}`}
            >
              <span>
                {GRADE_NAME[grade]} ({index + 1})
              </span>
              <span className="block text-xs font-normal text-muted-foreground">{labels[grade]}</span>
            </button>
          ))}
        </div>
      </ScrollCenter>
    </ModeFrame>
  )
}
