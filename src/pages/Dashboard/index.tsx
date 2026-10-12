import { buildNavItems } from '@/components/AppShell/navItems'
import type { NavItem } from '@/components/AppShell/navItems'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { useNow } from '@/hooks/useNow'
import { currentDictInfoAtom } from '@/store'
import { newCardsPerDayAtom } from '@/store/study'
import { dashboardStats } from '@/utils/dashboard/stats'
import type { ModeState } from '@/utils/dashboard/stats'
import { getDictProgress } from '@/utils/db/card-progress'
import { formatDuration, readBest } from '@/utils/match/best'
import { nextDueTime, sanitizeNewPerDay } from '@/utils/srs/queue'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAtomValue } from 'jotai'
import type { ComponentType, ReactNode } from 'react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import IconCards from '~icons/tabler/cards'
import IconKeyboard from '~icons/tabler/keyboard'
import IconListCheck from '~icons/tabler/list-check'
import IconPuzzle from '~icons/tabler/puzzle'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const card = 'rounded-xl border border-border bg-card p-6 text-card-foreground'
const primaryButton = `inline-flex min-h-[44px] items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors duration-200 hover:bg-primary/90 ${focusRing}`
const secondaryButton = `inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted ${focusRing}`

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} aria-hidden />
}

type ModeCardProps = {
  title: string
  description: string
  icon: ComponentType<{ className?: string }>
  to: string
  state?: ModeState
  detail?: ReactNode
}

function ModeCard({ title, description, icon: Icon, to, state, detail }: ModeCardProps) {
  const disabled = !!state && !state.enabled
  const body = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-medium ${disabled ? 'text-muted-foreground' : ''}`}>{title}</span>
        <span className="block text-sm text-muted-foreground">{disabled ? state?.reason : description}</span>
        {detail}
      </span>
    </>
  )
  const base = 'flex items-start gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground'
  if (disabled) {
    return (
      <div aria-disabled="true" className={`${base} bg-muted/40`}>
        {body}
      </div>
    )
  }
  return (
    <Link to={to} className={`${base} transition-colors duration-200 hover:bg-muted ${focusRing}`}>
      {body}
    </Link>
  )
}

export default function Dashboard() {
  const dict = useAtomValue(currentDictInfoAtom)
  const { words, error } = useDictionaryWords(dict.id)
  const progress = useLiveQuery(() => getDictProgress(dict.id), [dict.id])
  const newPerDay = sanitizeNewPerDay(useAtomValue(newCardsPerDayAtom))
  const nextDue = useMemo(() => (words && progress ? nextDueTime(words, progress, Date.now()) : null), [words, progress])
  const now = useNow(nextDue)
  const stats = useMemo(
    () => (words && progress ? dashboardStats({ words, progress, now, newPerDay }) : null),
    [words, progress, now, newPerDay],
  )
  const items = useMemo(() => buildNavItems(), [])
  const link = (id: NavItem['id']) => items.find((item) => item.id === id)?.to ?? '/'
  const best = readBest(dict.id)

  const queued = stats ? stats.due + stats.newToday : 0
  const percent = stats && stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8">
      <h1 className="text-2xl font-semibold">Today</h1>

      {error && !words ? (
        <div className={card}>
          <p className="text-destructive">Could not load this set.</p>
          <Link to="/gallery" className={`${secondaryButton} mt-4`}>
            Change set
          </Link>
        </div>
      ) : !stats ? (
        <>
          <Skeleton className="h-40" />
          <Skeleton className="h-28" />
        </>
      ) : (
        <>
          <section aria-labelledby="due-heading" className={card}>
            <h2 id="due-heading" className="text-sm font-medium text-muted-foreground">
              Due today
            </h2>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span>
                <span className="text-4xl font-semibold">{stats.due}</span> <span className="text-muted-foreground">due</span>
              </span>
              <span>
                <span className="text-4xl font-semibold">{stats.newToday}</span> <span className="text-muted-foreground">new</span>
              </span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {queued > 0 ? (
                <Link to={link('study')} className={primaryButton}>
                  Start review
                </Link>
              ) : stats.total === 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">This set has no words yet.</p>
                  <Link to="/my-sets" className={secondaryButton}>
                    Manage my sets
                  </Link>
                </>
              ) : (
                <p className="font-medium text-accent">All caught up. Come back tomorrow for more.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="continue-heading" className={card}>
            <h2 id="continue-heading" className="text-sm font-medium text-muted-foreground">
              Current set
            </h2>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold">{dict.name}</p>
              <Link to="/gallery" className={secondaryButton}>
                Change set
              </Link>
            </div>
            <div
              role="progressbar"
              aria-label="Words studied"
              aria-valuemin={0}
              aria-valuemax={stats.total}
              aria-valuenow={stats.seen}
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats.seen} / {stats.total} words studied
            </p>
          </section>
        </>
      )}

      <section aria-labelledby="modes-heading">
        <h2 id="modes-heading" className="mb-3 text-sm font-medium text-muted-foreground">
          Practice
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard title="Typing" description="Type each word from memory to build muscle memory." icon={IconKeyboard} to="/typing" />
          <ModeCard title="Flashcards" description="Review cards on a spaced repetition schedule." icon={IconCards} to={link('study')} />
          <ModeCard
            title="Quiz"
            description="Pick the right meaning from four options."
            icon={IconListCheck}
            to={link('quiz')}
            state={stats?.quiz}
          />
          <ModeCard
            title="Match"
            description="Pair words with their meanings against the clock."
            icon={IconPuzzle}
            to={link('match')}
            state={stats?.match}
            detail={
              best !== null ? <span className="mt-1 block text-xs font-medium text-accent">Best time {formatDuration(best)}</span> : null
            }
          />
        </div>
      </section>
    </div>
  )
}
