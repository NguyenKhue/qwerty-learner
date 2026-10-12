import type { SessionSummary } from './StudySession'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { buildQueue, nextDueTime, queueCounts, sanitizeNewPerDay } from '@/utils/srs/queue'
import { useEffect, useMemo, useState } from 'react'

type Props = {
  dictName: string
  words: Word[]
  progress: ICardProgress[]
  now: number
  newPerDay: number
  onNewPerDayChange: (value: number) => void
  reverse: boolean
  onReverseChange: (value: boolean) => void
  summary: SessionSummary | null
  onStart: () => void
  onBack: () => void
}

export default function StudyOverview({
  dictName,
  words,
  progress,
  now,
  newPerDay,
  onNewPerDayChange,
  reverse,
  onReverseChange,
  summary,
  onStart,
  onBack,
}: Props) {
  const [limitText, setLimitText] = useState(String(newPerDay))
  // Follow the stored value if it changes after mount (e.g. another tab)
  useEffect(() => setLimitText(String(newPerDay)), [newPerDay])
  const queue = useMemo(() => buildQueue({ words, progress, now, newPerDay }), [words, progress, now, newPerDay])
  const counts = queueCounts(queue)
  const next = useMemo(() => nextDueTime(words, progress, now), [words, progress, now])

  const commitLimit = () => {
    const value = sanitizeNewPerDay(limitText)
    setLimitText(String(value))
    onNewPerDayChange(value)
  }

  return (
    <Layout>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{dictName}</h1>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>

        {summary && (
          <p className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-700 dark:bg-gray-800 dark:text-indigo-300">
            Session finished: {summary.reviewed} {summary.reviewed === 1 ? 'answer' : 'answers'} given
            {summary.again > 0 ? `, ${summary.again} of them Again` : ''}.
          </p>
        )}

        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          {words.length === 0 ? (
            <p className="text-gray-500">This set has no words yet.</p>
          ) : queue.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xl text-gray-800 dark:text-gray-100">Done for today</p>
              <p className="text-sm text-gray-500">
                {next === null ? 'Nothing is scheduled.' : `Next review: ${new Date(next).toLocaleString()}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-800 dark:text-gray-100">
                <span className="text-3xl font-medium">{counts.due}</span> due · <span className="text-3xl font-medium">{counts.new}</span>{' '}
                new
              </p>
              <Button onClick={onStart}>Start</Button>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg bg-white p-6 text-sm text-gray-700 shadow dark:bg-gray-800 dark:text-gray-300">
          <label className="flex items-center justify-between gap-4">
            <span>New cards per day</span>
            <input
              type="number"
              min={0}
              max={500}
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              onBlur={commitLimit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLimit()
              }}
              className="w-24 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Show the meaning first</span>
            <input type="checkbox" checked={reverse} onChange={(e) => onReverseChange(e.target.checked)} />
          </label>
        </div>
      </div>
    </Layout>
  )
}
