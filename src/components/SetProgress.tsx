import type { ProgressSummary } from '@/utils/progress/status'
import { cn } from '@/utils/ui'

type Props = {
  summary: ProgressSummary
  /** The summary from before a session: when more words are mastered now, the gain is shown */
  before?: ProgressSummary
  className?: string
}

const PARTS = [
  { key: 'mastered', label: 'Mastered', bar: 'bg-accent', dot: 'bg-accent' },
  { key: 'young', label: 'Young', bar: 'bg-primary', dot: 'bg-primary' },
  { key: 'learning', label: 'Learning', bar: 'bg-primary/40', dot: 'bg-primary/40' },
  { key: 'new', label: 'New', bar: 'bg-muted', dot: 'bg-border' },
] as const

/** How much of the set is learned: a stacked bar plus a legend, the same on every page that shows it. */
export default function SetProgress({ summary, before, className }: Props) {
  const gained = before ? summary.mastered - before.mastered : 0
  const description = `${summary.mastered} mastered, ${summary.young} young, ${summary.learning} learning, ${summary.new} new of ${summary.total} words`
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="num text-2xl font-semibold tracking-tight">{summary.mastered}</span>
        <span className="text-sm text-muted-foreground">of {summary.total} words mastered</span>
        {gained > 0 && (
          <span className="num rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">+{gained} this session</span>
        )}
      </div>
      <div role="img" aria-label={description} className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {summary.total > 0 &&
          PARTS.map((part) =>
            summary[part.key] > 0 ? (
              <div key={part.key} className={part.bar} style={{ width: `${(summary[part.key] / summary.total) * 100}%` }} />
            ) : null,
          )}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {PARTS.map((part) => (
          <li key={part.key} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', part.dot)} aria-hidden />
            <span className="num">{summary[part.key]}</span> {part.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
