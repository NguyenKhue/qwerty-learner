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
      <div className="flex w-full flex-1 flex-col overflow-y-auto pl-20 pr-20 pt-20">
        <IconX className="absolute right-20 top-10 mr-2 h-7 w-7 cursor-pointer text-muted-foreground" onClick={onBack} />
        <ScrollArea.Root className="flex-1 overflow-y-auto">
          <ScrollArea.Viewport className="h-full w-auto pb-[20rem] [&>div]:!block">
            {isEmpty ? (
              <div className="align-items-center m-4 grid h-80 w-auto place-content-center overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                <div className="text-2xl text-muted-foreground">No practice data yet</div>
              </div>
            ) : (
              <>
                <div className="mx-4 my-8 h-auto w-auto overflow-hidden rounded-lg border border-border bg-card p-8 shadow-lg">
                  <HeatmapCharts title="Practice count heatmap, past year" data={exerciseRecord} />
                </div>
                <div className="mx-4 my-8 h-auto w-auto overflow-hidden rounded-lg border border-border bg-card p-8 shadow-lg">
                  <HeatmapCharts title="Words practiced heatmap, past year" data={wordRecord} />
                </div>
                <div className="mx-4 my-8 h-80 w-auto overflow-hidden rounded-lg border border-border bg-card p-8 shadow-lg">
                  <LineCharts title="WPM trend, past year" name="WPM" data={wpmRecord} />
                </div>
                <div className="mx-4 my-8 h-80 w-auto overflow-hidden rounded-lg border border-border bg-card p-8 shadow-lg">
                  <LineCharts title="Accuracy trend, past year" name="Accuracy (%)" data={accuracyRecord} suffix="%" />
                </div>
                <div className="mx-4 my-8 h-80 w-auto overflow-hidden rounded-lg border border-border bg-card p-8 shadow-lg">
                  <KeyboardWithBarCharts title="Keystroke error ranking" name="Error count" data={wrongTimeRecord} />
                </div>
              </>
            )}
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="flex touch-none select-none bg-transparent" orientation="vertical"></ScrollArea.Scrollbar>
        </ScrollArea.Root>
        <div className="overflow-y-auto"></div>
      </div>
    </Layout>
  )
}

export default Analysis
