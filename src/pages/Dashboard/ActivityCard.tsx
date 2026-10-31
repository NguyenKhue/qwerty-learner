import { Card, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { activityPeriodAtom } from '@/store/study'
import type { ActivityBar, ActivityPeriod } from '@/utils/activity/activity'
import { ACTIVITY_PERIODS } from '@/utils/activity/activity'
import { cn } from '@/utils/ui'
import { useAtom } from 'jotai'
import IconFlame from '~icons/tabler/flame'

const BAR_AREA_REM = 6
/** The bars all finish appearing within this time, however many there are. */
const STAGGER_MS = 280
/** Fixed to the language of the app: month names of some others (Vietnamese: "Tháng 10") are too wide for a bar. */
const DATE_LOCALE = 'en'

const PERIODS: Record<
  ActivityPeriod,
  {
    label: string
    title: string
    empty: string
    gap: string
    corner: string
    labelEvery: number
    barName: Intl.DateTimeFormatOptions
    tick: Intl.DateTimeFormatOptions
  }
> = {
  week: {
    label: 'Week',
    title: 'This week',
    empty: 'this week',
    gap: 'gap-2',
    corner: 'rounded-t-md',
    labelEvery: 1,
    barName: { weekday: 'short' },
    tick: { weekday: 'short' },
  },
  month: {
    label: 'Month',
    title: 'Last 30 days',
    empty: 'in the last 30 days',
    gap: 'gap-0.5',
    corner: 'rounded-t-sm',
    labelEvery: 7,
    barName: { month: 'short', day: 'numeric' },
    tick: { month: 'short', day: 'numeric' },
  },
  year: {
    label: 'Year',
    title: 'Last 12 months',
    empty: 'in the last 12 months',
    gap: 'gap-1',
    corner: 'rounded-t-md',
    labelEvery: 1,
    barName: { month: 'long', year: 'numeric' },
    tick: { month: 'short' },
  },
}

function streakText(streak: number): string {
  if (streak <= 0) return 'Start a streak today'
  return `${streak} day streak`
}

function formatStart(start: number, options: Intl.DateTimeFormatOptions): string {
  return new Date(start).toLocaleDateString(DATE_LOCALE, options)
}

function describeBar(bar: ActivityBar, options: Intl.DateTimeFormatOptions): string {
  return `${formatStart(bar.start, options)}: ${bar.reviews} ${bar.reviews === 1 ? 'card' : 'cards'} reviewed, ${bar.typed} ${
    bar.typed === 1 ? 'word' : 'words'
  } typed`
}

export default function ActivityCard({ bars: barsByPeriod, streak }: { bars: Record<ActivityPeriod, ActivityBar[]>; streak: number }) {
  const [period, setPeriod] = useAtom(activityPeriodAtom)
  const bars = barsByPeriod[period]
  const { title, empty: emptyText, gap, corner, labelEvery, barName, tick } = PERIODS[period]
  const last = bars.length - 1
  const max = Math.max(1, ...bars.map((bar) => bar.reviews + bar.typed))
  const empty = bars.every((bar) => bar.reviews + bar.typed === 0)
  const height = (count: number) => (count === 0 ? 0 : Math.max(0.125, (count / max) * BAR_AREA_REM))

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <CardTitle className="mr-auto">{title}</CardTitle>
        {streak > 0 ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <IconFlame className="h-4 w-4 shrink-0" aria-hidden />
            {streakText(streak)}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{streakText(streak)}</p>
        )}
        <ToggleGroup
          type="single"
          size="sm"
          value={period}
          onValueChange={(value) => value && setPeriod(value as ActivityPeriod)}
          aria-label="Activity period"
        >
          {ACTIVITY_PERIODS.map((value) => (
            <ToggleGroupItem key={value} value={value}>
              {PERIODS[value].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">No activity yet {emptyText}. Review a few cards or type a chapter to see it here.</p>
      ) : (
        <>
          <div key={period} className={`flex items-end ${gap}`} style={{ height: `${BAR_AREA_REM}rem` }} aria-hidden>
            {bars.map((bar, i) => (
              <div
                key={bar.start}
                className="flex h-full min-w-0 flex-1 origin-bottom animate-pop flex-col justify-end"
                style={{ animationDelay: `${Math.round((i * STAGGER_MS) / bars.length)}ms` }}
                title={describeBar(bar, barName)}
              >
                <div className={`flex max-h-full flex-col justify-end overflow-hidden ${corner}`}>
                  <div className="bg-accent" style={{ height: `${height(bar.typed)}rem` }} />
                  <div className="bg-primary" style={{ height: `${height(bar.reviews)}rem` }} />
                </div>
              </div>
            ))}
          </div>
          <div className={`flex text-xs text-muted-foreground ${gap}`} aria-hidden>
            {bars.map((bar, i) => (
              <span
                key={bar.start}
                className={cn(
                  'flex min-w-0 flex-1 justify-center whitespace-nowrap',
                  i === last && 'font-semibold text-primary',
                  i === last && labelEvery > 1 && 'justify-end',
                )}
              >
                {(last - i) % labelEvery === 0 && formatStart(bar.start, tick)}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Cards reviewed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Words typed
            </span>
          </div>
          <ul className="sr-only">
            {bars.map((bar) => (
              <li key={bar.start}>{describeBar(bar, barName)}</li>
            ))}
          </ul>
        </>
      )}
    </Card>
  )
}
