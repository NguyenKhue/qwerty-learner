import Layout from '@/components/Layout'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { Button } from '@/components/ui/button'
import { reviewCard } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import type { QueueItem } from '@/utils/srs/queue'
import { queueCounts } from '@/utils/srs/queue'
import { GRADES, previewLabels } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'
import { answer, createSession, currentItem, flip } from '@/utils/srs/session'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

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
  const [cards, setCards] = useState(() => new Map(progress.map((card): [string, ICardProgress] => [card.word, card])))
  const [error, setError] = useState('')
  // A ref, not state: two key presses in the same tick must not both pass the guard
  const busy = useRef(false)
  const finished = useRef(false)

  const item = currentItem(session)
  const counts = queueCounts(session.queue)

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinish({ reviewed: session.reviewed, again: session.again })
  }, [onFinish, session.again, session.reviewed])

  useEffect(() => {
    if (!item) finish()
  }, [item, finish])

  const onFlip = useCallback(() => setSession((s) => flip(s)), [])

  const onGrade = useCallback(
    async (grade: Grade) => {
      if (busy.current || !item || !session.flipped) return
      busy.current = true
      setError('')
      try {
        const saved = await reviewCard(dictId, item.word.name, grade)
        setCards((prev) => {
          const next = new Map(prev)
          next.set(saved.word, saved)
          return next
        })
        setSession((s) => answer(s, grade))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your answer')
      } finally {
        busy.current = false
      }
    },
    [dictId, item, session.flipped],
  )

  useHotkeys('space', onFlip, { preventDefault: true }, [onFlip])
  useHotkeys('1', () => onGrade('again'), [onGrade])
  useHotkeys('2', () => onGrade('hard'), [onGrade])
  useHotkeys('3', () => onGrade('good'), [onGrade])
  useHotkeys('4', () => onGrade('easy'), [onGrade])

  if (!item) return null

  const { word } = item
  const phonetic = word.usphone || word.ukphone
  const labels = previewLabels(cards.get(word.name), { dict: dictId, word: word.name }, Date.now())

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
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            New {counts.new} · Due {counts.due}
          </span>
          <Button size="sm" variant="outline" onClick={finish}>
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

        {error && <p className="text-sm text-red-600">{error}</p>}

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
      </div>
    </Layout>
  )
}
