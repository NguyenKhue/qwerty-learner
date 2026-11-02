import DictDetail from './DictDetail'
import { useDictStats } from './hooks/useDictStats'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import useIntersectionObserver from '@/hooks/useIntersectionObserver'
import { currentDictIdAtom } from '@/store'
import type { Dictionary } from '@/typings'
import { calcChapterCount } from '@/utils'
import * as Progress from '@radix-ui/react-progress'
import { useAtomValue } from 'jotai'
import { useMemo, useRef } from 'react'

interface Props {
  dictionary: Dictionary
}

export default function DictionaryComponent({ dictionary }: Props) {
  const currentDictID = useAtomValue(currentDictIdAtom)

  const divRef = useRef<HTMLDivElement>(null)
  const entry = useIntersectionObserver(divRef, {})
  const isVisible = !!entry?.isIntersecting
  const dictStats = useDictStats(dictionary.id, isVisible)
  const chapterCount = useMemo(() => calcChapterCount(dictionary.length), [dictionary.length])
  const isSelected = currentDictID === dictionary.id
  const progress = useMemo(
    () => (dictStats ? Math.ceil((dictStats.exercisedChapterCount / chapterCount) * 100) : 0),
    [dictStats, chapterCount],
  )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          ref={divRef}
          className={`group flex w-full cursor-pointer flex-col justify-center gap-1 overflow-hidden rounded-xl border bg-card p-4 text-left shadow-1 transition-[transform,box-shadow,border-color] duration-base ease-out hover:-translate-y-0.5 hover:shadow-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isSelected ? 'border-primary ring-1 ring-ring' : 'border-border hover:border-primary/40'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              e.currentTarget.click()
            }
          }}
        >
          <h2 className={`text-base font-semibold ${isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
            {dictionary.name}
          </h2>
          <TooltipProvider>
            <Tooltip delayDuration={400}>
              <TooltipTrigger asChild>
                <p className="max-w-full truncate whitespace-nowrap text-sm text-muted-foreground">{dictionary.description}</p>
              </TooltipTrigger>
              <TooltipContent>
                <p>{`${dictionary.description}`}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <p className="num text-sm text-muted-foreground">{dictionary.length} words</p>
          {progress > 0 && (
            <Progress.Root value={progress} max={100} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <Progress.Indicator className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </Progress.Root>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="w-[60rem] max-w-[calc(100vw-2rem)] !rounded-[20px]">
        <DictDetail dictionary={dictionary} />
      </DialogContent>
    </Dialog>
  )
}
