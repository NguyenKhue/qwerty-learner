import type { SessionSummary } from './StudySession'
import { ModeFrame, ModePage, Panel } from '@/components/ModePage'
import SetProgress from '@/components/SetProgress'
import { Button } from '@/components/ui/button'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { type ProgressSummary, progressSummary } from '@/utils/progress/status'
import { PRACTICE_SCOPES, practiceWords } from '@/utils/srs/practice'
import type { PracticeScope } from '@/utils/srs/practice'
import { buildQueue, nextDueTime, queueCounts, sanitizeNewPerDay, unseenCount } from '@/utils/srs/queue'
import { useEffect, useMemo, useState } from 'react'

const PRACTICE_LABEL: Record<PracticeScope, string> = {
  today: 'Studied today',
  hard: 'Hard today',
  all: 'Whole set',
}

type Props = {
  dictName: string
  words: Word[]
  progress: ICardProgress[]
  now: number
  newPerDay: number
  /** Extra new cards already asked for today with "Learn more" */
  extraNew: number
  /** Words graded Again or Hard today */
  hardToday: Set<string>
  onNewPerDayChange: (value: number) => void
  reverse: boolean
  onReverseChange: (value: boolean) => void
  summary: SessionSummary | null
  /** Counts from before the session that just finished, to show what it gained */
  before?: ProgressSummary | null
  onStart: () => void
  onLearnMore: (count: number) => void
  onPractice: (scope: PracticeScope) => void
  onBack: () => void
}

export default function StudyOverview({
  dictName,
  words,
  progress,
  now,
  newPerDay,
  extraNew,
  hardToday,
  onNewPerDayChange,
  reverse,
  onReverseChange,
  summary,
  before,
  onStart,
  onLearnMore,
  onPractice,
  onBack,
}: Props) {
  const [limitText, setLimitText] = useState(String(newPerDay))
  // Follow the stored value if it changes after mount (e.g. another tab)
  useEffect(() => setLimitText(String(newPerDay)), [newPerDay])
  const queue = useMemo(() => buildQueue({ words, progress, now, newPerDay, extraNew }), [words, progress, now, newPerDay, extraNew])
  const unseen = useMemo(() => unseenCount(words, progress), [words, progress])
  const practiceSizes = useMemo(
    () =>
      Object.fromEntries(
        PRACTICE_SCOPES.map((scope) => [scope, practiceWords({ words, progress, hardToday, now, scope }).length]),
      ) as Record<PracticeScope, number>,
    [words, progress, hardToday, now],
  )
  // +10 and +20, or a single button for what is left when fewer words are unseen
  const moreSteps = unseen > 10 ? [10, Math.min(20, unseen)] : unseen > 0 ? [unseen] : []
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
            {summary.practice ? 'Practice finished' : 'Session finished'}: {summary.reviewed}{' '}
            {summary.reviewed === 1 ? 'answer' : 'answers'} given
            {summary.again > 0 ? `, ${summary.again} of them Again` : ''}
            {summary.practice ? '. Your schedule did not change.' : '.'}
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
              {moreSteps.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="text-sm">Have more time? Learn more new cards today:</span>
                  {moreSteps.map((step) => (
                    <Button key={step} variant="outline" onClick={() => onLearnMore(step)}>
                      +{step} new
                    </Button>
                  ))}
                </div>
              )}
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

        {words.length > 0 && (
          <Panel className="space-y-3">
            <div>
              <p className="font-medium">Practice</p>
              <p className="text-sm text-muted-foreground">Go through cards again. Grades here do not change your schedule.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRACTICE_SCOPES.map((scope) => (
                <Button key={scope} variant="outline" disabled={practiceSizes[scope] === 0} onClick={() => onPractice(scope)}>
                  {PRACTICE_LABEL[scope]} <span className="num ml-1 text-muted-foreground">{practiceSizes[scope]}</span>
                </Button>
              ))}
            </div>
          </Panel>
        )}

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
