import { Panel } from '@/components/ModePage'
import type { DayActivity } from '@/utils/activity/activity'
import { startOfLocalDay } from '@/utils/srs/time'

const BAR_AREA_REM = 6

function streakText(streak: number): string {
  if (streak <= 0) return 'Start a streak today'
  return `${streak} day streak`
}

function dayName(start: number): string {
  return new Date(start).toLocaleDateString(undefined, { weekday: 'short' })
}

function describeDay(day: DayActivity): string {
  return `${dayName(day.start)}: ${day.reviews} ${day.reviews === 1 ? 'card' : 'cards'} reviewed, ${day.typed} ${
    day.typed === 1 ? 'word' : 'words'
  } typed`
}

export default function WeekCard({ week, streak, now }: { week: DayActivity[]; streak: number; now: number }) {
  const today = startOfLocalDay(now)
  const max = Math.max(1, ...week.map((day) => day.reviews + day.typed))
  const empty = week.every((day) => day.reviews + day.typed === 0)
  const height = (count: number) => (count === 0 ? 0 : Math.max(0.125, (count / max) * BAR_AREA_REM))

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">This week</h2>
        <p className="text-sm font-medium text-accent">{streakText(streak)}</p>
      </div>

      {empty ? (
        <p className="text-sm text-muted-foreground">No activity yet this week. Review a few cards or type a chapter to see it here.</p>
      ) : (
        <>
          <div className="flex items-end gap-2" style={{ height: `${BAR_AREA_REM}rem` }} aria-hidden>
            {week.map((day) => (
              <div key={day.start} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex max-h-full flex-col justify-end overflow-hidden rounded-t-md">
                  <div className="bg-accent" style={{ height: `${height(day.typed)}rem` }} title={`${day.typed} typed`} />
                  <div className="bg-primary" style={{ height: `${height(day.reviews)}rem` }} title={`${day.reviews} reviewed`} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground" aria-hidden>
            {week.map((day) => (
              <span key={day.start} className={`flex-1 text-center ${day.start === today ? 'font-semibold text-foreground' : ''}`}>
                {dayName(day.start)}
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
            {week.map((day) => (
              <li key={day.start}>{describeDay(day)}</li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}
