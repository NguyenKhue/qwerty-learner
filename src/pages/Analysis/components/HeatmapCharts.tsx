import { CardTitle } from '@/components/ui/card'
import { isOpenDarkModeAtom } from '@/store'
import { useAtom } from 'jotai'
import type { FC } from 'react'
import React, { useEffect, useRef } from 'react'
import type { Activity } from 'react-activity-calendar'
import ActivityCalendar from 'react-activity-calendar'
import { Tooltip as ReactTooltip } from 'react-tooltip'
import 'react-tooltip/dist/react-tooltip.css'

interface HeatmapChartsProps {
  title: string
  data: Activity[]
}

const HeatmapCharts: FC<HeatmapChartsProps> = ({ data, title }) => {
  const [isOpenDarkMode] = useAtom(isOpenDarkModeAtom)
  const total = data.reduce((sum, day) => sum + day.count, 0)

  // On a phone the year scrolls sideways at a readable size, starting from the latest weeks
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <CardTitle>{title}</CardTitle>
        <p className="num text-sm text-muted-foreground">{total} in the past year</p>
      </div>
      <div ref={scroller} className="overflow-x-auto pb-1">
        <div className="w-max">
          <ActivityCalendar
            fontSize={12}
            blockSize={12}
            blockMargin={3}
            blockRadius={3}
            hideTotalCount
            hideColorLegend
            style={{ color: isOpenDarkMode ? '#94a3b8' : '#475569' }}
            colorScheme={isOpenDarkMode ? 'dark' : 'light'}
            data={data}
            theme={{
              light: ['#f1f3fa', '#4f46e5'],
              dark: ['#21253a', '#818cf8'],
            }}
            renderBlock={(block, activity) =>
              React.cloneElement(block, {
                'data-tooltip-id': 'react-tooltip',
                'data-tooltip-html': `${activity.date} practiced ${activity.count} times`,
              })
            }
            showWeekdayLabels={true}
            labels={{
              months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
              weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            }}
          />
        </div>
      </div>
      <ReactTooltip id="react-tooltip" />
    </div>
  )
}

export default HeatmapCharts
