import WeekCard from './WeekCard'
import { buildNavItems } from '@/components/AppShell/navItems'
import type { NavItem } from '@/components/AppShell/navItems'
import { Card, CardEyebrow, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { useNow } from '@/hooks/useNow'
import { currentDictInfoAtom } from '@/store'
import { newCardsPerDayAtom } from '@/store/study'
import { dashboardRefreshDelay, dashboardStats } from '@/utils/dashboard/stats'
import type { ModeState } from '@/utils/dashboard/stats'
import { loadActivity } from '@/utils/db/activity'
import { getDictProgress } from '@/utils/db/card-progress'
import { customEditPath } from '@/utils/db/custom-dict'
import { formatDuration, readBest } from '@/utils/match/best'
import { sanitizeNewPerDay } from '@/utils/srs/queue'
import { cn } from '@/utils/ui'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAtomValue } from 'jotai'
import type { CSSProperties, ComponentType, ReactNode } from 'react'
import { useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import IconArrowRight from '~icons/tabler/arrow-right'
import IconCards from '~icons/tabler/cards'
import IconCheck from '~icons/tabler/check'
import IconKeyboard from '~icons/tabler/keyboard'
import IconListCheck from '~icons/tabler/list-check'
import IconPuzzle from '~icons/tabler/puzzle'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const card = 'rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2 md:p-8'
const heroCard = `${card} bg-gradient-to-br from-primary/10 via-card to-card`
const primaryButton = `group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground shadow-2 transition-[transform,box-shadow] duration-base ease-out hover:shadow-3 active:scale-[0.98] ${focusRing}`
const secondaryButton = `inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-1 transition-colors duration-fast hover:bg-muted ${focusRing}`
const interactiveCard =
  'transition-[transform,box-shadow,border-color] duration-base ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2'

function Skeleton({ className, style }: { className: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} style={style} aria-hidden />
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
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-base ${
          disabled ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${disabled ? 'text-muted-foreground' : ''}`}>{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{disabled ? state?.reason : description}</span>
        {detail}
      </span>
      <IconArrowRight
        className="mt-3 h-4 w-4 shrink-0 text-muted-foreground transition-[color,transform] duration-base group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden
      />
    </>
  )
  const base = 'group flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-1'
  if (disabled) {
    return <div className={cn(base, 'bg-muted/40 opacity-60')}>{body}</div>
  }
  return (
    <Link to={to} className={cn(base, interactiveCard, focusRing)}>
      {body}
    </Link>
  )
}

export default function Dashboard() {
  const dict = useAtomValue(currentDictInfoAtom)
  const { words, error } = useDictionaryWords(dict.id)
  const progress = useLiveQuery(() => getDictProgress(dict.id), [dict.id])
  const newPerDay = sanitizeNewPerDay(useAtomValue(newCardsPerDayAtom))
  const getDelay = useCallback(
    (at: number) => (words && progress ? dashboardRefreshDelay(words, progress, at) : 60 * 1000),
    [words, progress],
  )
  const now = useNow(getDelay)
  const activity = useLiveQuery(() => loadActivity(now), [now])
  const stats = useMemo(
    () => (words && progress ? dashboardStats({ words, progress, now, newPerDay }) : null),
    [words, progress, now, newPerDay],
  )
  const items = useMemo(() => buildNavItems(), [])
  const link = (id: NavItem['id']) => items.find((item) => item.id === id)?.to ?? '/'
  const best = readBest(dict.id)
  const editPath = customEditPath(dict.id)

  const queued = stats ? stats.due + stats.newToday : 0
  const percent = stats && stats.total > 0 ? Math.min(100, Math.round((stats.seen / stats.total) * 100)) : 0
  const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), [])
  const step = (i: number) => ({ '--i': i } as CSSProperties)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Today" subtitle={todayLabel} />

      <div className="stagger flex flex-col gap-8">
        {error && !words ? (
          <div className={card} style={step(0)}>
            <p className="text-destructive">Could not load this set.</p>
            <Link to="/gallery" className={`${secondaryButton} mt-4`}>
              Change set
            </Link>
          </div>
        ) : !stats ? (
          <>
            <Skeleton className="h-48 md:h-56" style={step(0)} />
            <Skeleton className="h-32" style={step(1)} />
          </>
        ) : (
          <>
            <section aria-labelledby="due-heading" className={heroCard} style={step(0)}>
              <CardEyebrow id="due-heading">Due today</CardEyebrow>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <span className="flex items-baseline gap-2">
                  <span className="num text-5xl font-semibold tracking-tight">{stats.due}</span>
                  <span className="text-sm text-muted-foreground">due</span>
                </span>
                <span aria-hidden className="hidden h-10 w-px self-stretch bg-border md:block" />
                <span className="flex items-baseline gap-2">
                  <span className="num text-5xl font-semibold tracking-tight">{stats.newToday}</span>
                  <span className="text-sm text-muted-foreground">new</span>
                </span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {queued > 0 ? (
                  <Link to={link('study')} className={primaryButton}>
                    Start review
                    <IconArrowRight className="h-5 w-5 transition-transform duration-base group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                ) : stats.total === 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">This set has no words yet.</p>
                    <Link to="/my-sets" className={secondaryButton}>
                      Manage my sets
                    </Link>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-medium text-accent">
                    <IconCheck className="h-5 w-5 shrink-0 text-accent" aria-hidden />
                    All caught up. Come back tomorrow for more.
                  </p>
                )}
              </div>
            </section>

            <Card as="section" aria-labelledby="continue-heading" className="p-4 sm:p-5" style={step(1)}>
              <CardEyebrow id="continue-heading">Current set</CardEyebrow>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="min-w-0 break-words">{dict.name}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {editPath && (
                    <Link to={editPath} className={secondaryButton}>
                      Edit set
                    </Link>
                  )}
                  <Link to="/gallery" className={secondaryButton}>
                    Change set
                  </Link>
                </div>
              </div>
              <div
                role="progressbar"
                aria-label="Words studied"
                aria-valuemin={0}
                aria-valuemax={Math.max(stats.total, 1)}
                aria-valuenow={stats.seen}
                className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-enter ease-out"
                  style={{ transform: `scaleX(${percent / 100})` }}
                />
              </div>
              <p className="num mt-2 text-sm text-muted-foreground">
                {stats.seen} / {stats.total} words studied
              </p>
            </Card>
          </>
        )}

        {activity ? (
          <div style={step(2)}>
            <WeekCard week={activity.week} streak={activity.streak} now={now} />
          </div>
        ) : (
          <Skeleton className="h-48" style={step(2)} />
        )}

        <section aria-labelledby="modes-heading" style={step(3)}>
          <h2 id="modes-heading" className="text-eyebrow mb-4">
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
    </div>
  )
}
