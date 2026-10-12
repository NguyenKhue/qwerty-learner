import Layout from '@/components/Layout'
import ScrollCenter from '@/components/ScrollCenter'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { Button } from '@/components/ui/button'
import { reviewCard } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { isActivatableButton } from '@/utils/keyboard'
import { createGrader } from '@/utils/srs/grader'
import type { QueueItem } from '@/utils/srs/queue'
import { queueCounts } from '@/utils/srs/queue'
import { GRADES, previewLabels } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'
import { createSession, currentItem, flip } from '@/utils/srs/session'
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
  onFinish: (summary: SessionSummary) => void
}

const GRADE_STYLE: Record<Grade, string> = {
  again: 'bg-red-500 text-white hover:bg-red-500/90',
  hard: 'bg-amber-500 text-white hover:bg-amber-500/90',
  good: 'bg-indigo-500 text-white hover:bg-indigo-500/90',
  easy: 'bg-emerald-500 text-white hover:bg-emerald-500/90',
}
const GRADE_NAME: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

export default function StudySession({ dictId, queue, progress, reverse, onFinish }: Props) {
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

  const onFlip = useCallback(() => updateSession(flip(sessionRef.current)), [updateSession])
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
  const labelsNow = useMemo(() => Date.now(), [currentName, session.flipped]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null

  const { word } = item
  const phonetic = word.usphone || word.ukphone
  const labels = previewLabels(cards.get(word.name), { dict: dictId, word: word.name }, labelsNow)

  const wordBlock = (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <span className="text-5xl font-medium text-gray-800 dark:text-gray-100">{word.name}</span>
        <WordPronunciationIcon key={word.name} word={word} lang="en" iconClassName="h-8 w-8" />
      </div>
      {phonetic && <span className="text-gray-500">[{phonetic}]</span>}
    </div>
  )
  const meaningBlock = (
    <ul className="space-y-1 text-center text-xl text-gray-800 dark:text-gray-100">
      {word.trans.map((meaning, i) => (
        <li key={i}>{meaning}</li>
      ))}
    </ul>
  )

  return (
    <Layout>
      <ScrollCenter className="max-w-3xl gap-8">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            New {counts.new} · Due {counts.due}
          </span>
          <Button size="sm" variant="outline" disabled={saving} onClick={finish}>
            Exit
          </Button>
        </div>

        <div className="flex min-h-[18rem] w-full flex-col items-center justify-center gap-6 rounded-xl bg-white p-8 shadow dark:bg-gray-800">
          <span className="text-xs uppercase tracking-wide text-gray-400">{item.kind === 'new' ? 'New' : 'Due'}</span>
          {reverse ? meaningBlock : wordBlock}
          {session.flipped ? (
            <>
              <hr className="w-1/2 border-gray-200 dark:border-gray-700" />
              {reverse ? wordBlock : meaningBlock}
            </>
          ) : (
            <Button variant="outline" onClick={onFlip}>
              Show answer (Space)
            </Button>
          )}
        </div>

        <p className="sr-only" aria-live="polite">
          {session.flipped
            ? `${word.name}: ${word.trans.join('; ')}`
            : `${item.kind === 'new' ? 'New' : 'Due'} card: ${reverse ? word.trans.join('; ') : word.name}`}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="grid w-full grid-cols-4 gap-3">
          {GRADES.map((grade, index) => (
            <button
              key={grade}
              disabled={!session.flipped}
              onClick={() => onGrade(grade)}
              className={`flex flex-col items-center rounded-lg px-3 py-3 text-sm font-medium transition-opacity disabled:opacity-30 ${GRADE_STYLE[grade]}`}
            >
              <span>
                {GRADE_NAME[grade]} ({index + 1})
              </span>
              <span className="text-xs opacity-80">{labels[grade]}</span>
            </button>
          ))}
        </div>
      </ScrollCenter>
    </Layout>
  )
}
