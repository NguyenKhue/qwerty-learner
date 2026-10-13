import HeatmapCharts from './components/HeatmapCharts'
import KeyboardWithBarCharts from './components/KeyboardWithBarCharts'
import LineCharts from './components/LineCharts'
import { useWordStats } from './hooks/useWordStats'
import Layout from '@/components/Layout'
import { isOpenDarkModeAtom } from '@/store'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import dayjs from 'dayjs'
import { useAtom } from 'jotai'
import { useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

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
    <Layout>
      <div className="mx-auto flex w-full max-w-5xl flex-1 animate-enter-up flex-col gap-6 overflow-y-auto px-4 py-6 md:px-8">
        <IconX className="ml-auto h-7 w-7 shrink-0 cursor-pointer text-muted-foreground" onClick={onBack} />
        <ScrollArea.Root className="flex-1 overflow-y-auto">
          <ScrollArea.Viewport className="h-full w-auto pb-[20rem] [&>div]:!block">
            {isEmpty ? (
              <div className="grid h-80 w-full place-content-center overflow-hidden rounded-xl border border-border bg-card shadow-1">
                <div className="text-2xl text-muted-foreground">No practice data yet</div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-1 sm:p-6">
                  <HeatmapCharts title="Practice count heatmap, past year" data={exerciseRecord} />
                </div>
                <div className="w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-1 sm:p-6">
                  <HeatmapCharts title="Words practiced heatmap, past year" data={wordRecord} />
                </div>
                <div className="h-80 w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-1 sm:p-6">
                  <LineCharts title="WPM trend, past year" name="WPM" data={wpmRecord} />
                </div>
                <div className="h-80 w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-1 sm:p-6">
                  <LineCharts title="Accuracy trend, past year" name="Accuracy (%)" data={accuracyRecord} suffix="%" />
                </div>
                <div className="h-80 w-full overflow-hidden rounded-xl border border-border bg-card p-4 shadow-1 sm:p-6">
                  <KeyboardWithBarCharts title="Keystroke error ranking" name="Error count" data={wrongTimeRecord} />
                </div>
              </div>
            )}
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent " orientation="vertical"></ScrollArea.Scrollbar>
        </ScrollArea.Root>
        <div className="overflow-y-auto"></div>
      </div>
    </Layout>
  )
}

export default Analysis
