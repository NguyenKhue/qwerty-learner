import DictDetail from './DictDetail'
import { useDictStats } from './hooks/useDictStats'
import bookCover from '@/assets/book-cover.png'
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
          className={`group flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-card p-4 text-left shadow-1 transition-[transform,box-shadow,border-color] duration-base ease-out hover:-translate-y-0.5 hover:shadow-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isSelected ? 'border-primary ring-1 ring-ring' : 'border-border hover:border-primary/40'
          }`}
          role="button"
          // onClick={onClick}
        >
          <div className="relative ml-1 mt-2 flex h-full w-full flex-col items-start justify-start">
            <h1 className={`mb-1.5 text-lg font-semibold ${isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
              {dictionary.name}
            </h1>
            <TooltipProvider>
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <p className="mb-1 max-w-full truncate whitespace-nowrap text-sm text-muted-foreground">{dictionary.description}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{`${dictionary.description}`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <p className="mb-0.5 text-sm text-muted-foreground">{dictionary.length} words</p>
            <div className="flex w-full items-center pt-2">
              {progress > 0 && (
                <Progress.Root value={progress} max={100} className="mr-4 h-2 w-full rounded-full border border-primary bg-card">
                  <Progress.Indicator className="h-full rounded-full bg-primary pl-0" style={{ width: `calc(${progress}% )` }} />
                </Progress.Root>
              )}
              <img src={bookCover} className={`absolute right-3 top-3 w-16 ${isSelected ? 'opacity-50' : 'opacity-20'}`} />
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogContent className="w-[60rem] max-w-[calc(100vw-2rem)] !rounded-[20px]">
        <DictDetail dictionary={dictionary} />
      </DialogContent>
    </Dialog>
  )
}
