import HeatmapCharts from './components/HeatmapCharts'
import KeyboardWithBarCharts from './components/KeyboardWithBarCharts'
import LineCharts from './components/LineCharts'
import { useWordStats } from './hooks/useWordStats'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { isOpenDarkModeAtom } from '@/store'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'

const Analysis = () => {
  const navigate = useNavigate()
  const [, setIsOpenDarkMode] = useAtom(isOpenDarkModeAtom)

  const onBack = useCallback(() => {
    navigate('/typing')
  }, [navigate])

  const changeDarkModeState = () => {
    setIsOpenDarkMode((old) => !old)
  }

  useHotkeys(
    'ctrl+d',
    () => {
      changeDarkModeState()
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  )

  useHotkeys('enter,esc', onBack, { preventDefault: true })

  const { isEmpty, exerciseRecord, wordRecord, wpmRecord, accuracyRecord, wrongTimeRecord } = useWordStats(
    dayjs().subtract(1, 'year').unix(),
    dayjs().unix(),
  )

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Analysis" subtitle="Your typing practice over the past year." />
      {isEmpty ? (
        <Card className="text-muted-foreground">No practice data yet. Finish a chapter in Typing to see it here.</Card>
      ) : (
        <>
          <Card>
            <HeatmapCharts title="Practice count" data={exerciseRecord} />
          </Card>
          <Card>
            <HeatmapCharts title="Words practiced" data={wordRecord} />
          </Card>
          <Card className="h-80 overflow-hidden">
            <LineCharts title="WPM trend, past year" name="WPM" data={wpmRecord} />
          </Card>
          <Card className="h-80 overflow-hidden">
            <LineCharts title="Accuracy trend, past year" name="Accuracy (%)" data={accuracyRecord} suffix="%" />
          </Card>
          <Card className="h-80 overflow-hidden">
            <KeyboardWithBarCharts title="Keystroke error ranking" name="Error count" data={wrongTimeRecord} />
          </Card>
        </>
      )}
    </div>
  )
}

export default Analysis
