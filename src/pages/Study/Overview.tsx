import type { SessionSummary } from './StudySession'
import { ModeFrame, ModePage, Panel } from '@/components/ModePage'
import SetProgress from '@/components/SetProgress'
import { Button } from '@/components/ui/button'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { type ProgressSummary, progressSummary } from '@/utils/progress/status'
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
  /** Counts from before the session that just finished, to show what it gained */
  before?: ProgressSummary | null
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
  before,
  onStart,
  onBack,
}: Props) {
  const [limitText, setLimitText] = useState(String(newPerDay))
  // Follow the stored value if it changes after mount (e.g. another tab)
  useEffect(() => setLimitText(String(newPerDay)), [newPerDay])
  const queue = useMemo(() => buildQueue({ words, progress, now, newPerDay }), [words, progress, now, newPerDay])
  const counts = queueCounts(queue)
  const overall = useMemo(() => progressSummary(words, progress), [words, progress])
  const next = useMemo(() => nextDueTime(words, progress, now), [words, progress, now])

  const commitLimit = () => {
    const value = sanitizeNewPerDay(limitText)
    setLimitText(String(value))
    onNewPerDayChange(value)
  }

  return (
    <ModeFrame>
      <ModePage title={dictName} onBack={onBack}>
        {summary && (
          <p className="rounded-lg bg-primary/10 p-4 text-sm text-primary">
            Session finished: {summary.reviewed} {summary.reviewed === 1 ? 'answer' : 'answers'} given
            {summary.again > 0 ? `, ${summary.again} of them Again` : ''}.
          </p>
        )}

        <Panel>
          {words.length === 0 ? (
            <p className="text-muted-foreground">This set has no words yet.</p>
          ) : queue.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xl font-medium">Done for today</p>
              <p className="text-sm text-muted-foreground">
                {next === null ? 'Nothing is scheduled.' : `Next review: ${new Date(next).toLocaleString()}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p>
                <span className="num text-5xl font-semibold tracking-tight">{counts.due}</span>{' '}
                <span className="text-muted-foreground">due</span> ·{' '}
                <span className="num text-5xl font-semibold tracking-tight">{counts.new}</span>{' '}
                <span className="text-muted-foreground">new</span>
              </p>
              <Button className="h-12 px-6 text-base shadow-2" onClick={onStart}>
                Start
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <SetProgress summary={overall} before={summary ? before ?? undefined : undefined} />
        </Panel>

        <Panel className="space-y-3 text-sm">
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
              className="h-11 w-24 rounded-lg border border-border bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <label className="flex min-h-[44px] items-center justify-between gap-4">
            <span>Show the meaning first</span>
            <input
              type="checkbox"
              checked={reverse}
              onChange={(e) => onReverseChange(e.target.checked)}
              className="h-5 w-5 accent-[rgb(var(--primary))]"
            />
          </label>
        </Panel>
      </ModePage>
    </ModeFrame>
  )
}
