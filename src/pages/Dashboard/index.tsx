import ActivityCard from './ActivityCard'
import { buildNavItems } from '@/components/AppShell/navItems'
import type { NavItem } from '@/components/AppShell/navItems'
import SetProgress from '@/components/SetProgress'
import { Card, CardEyebrow, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { useLive } from '@/data/useLive'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { useNow } from '@/hooks/useNow'
import { currentDictInfoAtom } from '@/store'
import { newCardsPerDayAtom, studyReverseAtom } from '@/store/study'
import { dashboardRefreshDelay, dashboardStats } from '@/utils/dashboard/stats'
import type { ModeState } from '@/utils/dashboard/stats'
import { loadActivity } from '@/utils/db/activity'
import { getDictProgress } from '@/utils/db/card-progress'
import { customEditPath } from '@/utils/db/custom-dict'
import { formatDuration, readBest } from '@/utils/match/best'
import { progressSummary } from '@/utils/progress/status'
import { sanitizeNewPerDay } from '@/utils/srs/queue'
import { cn } from '@/utils/ui'
import { useAtomValue } from 'jotai'
import type { ComponentType, ReactNode } from 'react'
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
const primaryButton = `group inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-medium text-primary-foreground shadow-2 transition-[transform,box-shadow] duration-base ease-out hover:shadow-3 active:scale-[0.98] ${focusRing}`
const secondaryButton = `inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-1 transition-colors duration-fast hover:bg-muted ${focusRing}`
const interactiveCard =
  'transition-[transform,box-shadow,border-color] duration-base ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2'

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
  const progress = useLive(() => getDictProgress(dict.id), [`cards:${dict.id}`], [dict.id])
  const newPerDay = sanitizeNewPerDay(useAtomValue(newCardsPerDayAtom))
  const reverse = useAtomValue(studyReverseAtom)
  const getDelay = useCallback(
    (at: number) => (words && progress ? dashboardRefreshDelay(words, progress, at) : 60 * 1000),
    [words, progress],
  )
  const now = useNow(getDelay)
  const activity = useLive(() => loadActivity(now), ['reviewLog', 'wordRecords'], [now])
  const stats = useMemo(
    () => (words && progress ? dashboardStats({ words, progress, now, newPerDay }) : null),
    [words, progress, now, newPerDay],
  )
  const summary = useMemo(() => (words && progress ? progressSummary(words, progress) : null), [words, progress])
  const items = useMemo(() => buildNavItems(), [])
  const link = (id: NavItem['id']) => items.find((item) => item.id === id)?.to ?? '/'
  const best = readBest(dict.id)
  const editPath = customEditPath(dict.id)

  const nextPhonetic = stats?.next?.usphone || stats?.next?.ukphone
  const todayLabel = useMemo(() => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }), [])

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Today" subtitle={todayLabel} />

      <div className="flex flex-col gap-8">
        {error && !words ? (
          <div className={card}>
            <p className="text-destructive">Could not load this set.</p>
            <Link to="/gallery" className={`${secondaryButton} mt-4`}>
              Change set
            </Link>
          </div>
        ) : !stats ? (
          <>
            <Skeleton className="h-48 md:h-56" />
            <Skeleton className="h-32" />
          </>
        ) : (
          <>
            <section aria-labelledby="next-heading">
              {stats.next ? (
                <>
                  <h2 id="next-heading" className="text-sm font-medium text-muted-foreground">
                    Next up
                  </h2>
                  {reverse ? (
                    <p className="mt-3 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{stats.next.trans.join('; ')}</p>
                  ) : (
                    <>
                      <p className="text-word mt-3 break-words">{stats.next.name}</p>
                      {nextPhonetic && <p className="mt-3 text-lg text-muted-foreground">[{nextPhonetic}]</p>}
                    </>
                  )}
                  <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                    <Link to={link('study')} className={primaryButton}>
                      Start review
                      <IconArrowRight className="h-5 w-5 transition-transform duration-base group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                    <p className="num text-sm text-muted-foreground">
                      {stats.due} due, {stats.newToday} new
                    </p>
                  </div>
                </>
              ) : stats.total === 0 ? (
                <>
                  <h2 id="next-heading" className="text-title">
                    This set has no words yet
                  </h2>
                  <Link to="/my-sets" className={`${secondaryButton} mt-4`}>
                    Manage my sets
                  </Link>
                </>
              ) : (
                <>
                  <h2 id="next-heading" className="text-title flex items-center gap-2">
                    <IconCheck className="h-6 w-6 shrink-0 text-accent" aria-hidden />
                    All caught up
                  </h2>
                  <p className="mt-2 text-muted-foreground">Come back tomorrow for more.</p>
                </>
              )}
            </section>

            <Card as="section" aria-labelledby="continue-heading" className="p-4 sm:p-5">
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
              {summary && <SetProgress summary={summary} className="mt-4" />}
            </Card>
          </>
        )}

        {activity ? <ActivityCard bars={activity.bars} streak={activity.streak} /> : <Skeleton className="h-48" />}

        <section aria-labelledby="modes-heading">
          <h2 id="modes-heading" className="text-heading mb-4">
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
