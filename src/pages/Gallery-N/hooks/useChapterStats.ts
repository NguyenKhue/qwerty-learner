import { toChapterRecord } from '@/data/hydrate'
import { call } from '@/data/rpc'
import { toFixedNumber } from '@/utils'
import { useEffect, useState } from 'react'

export function useChapterStats(chapter: number, dictID: string, isStartLoad: boolean) {
  const [chapterStats, setChapterStats] = useState<IChapterStats | null>(null)

  useEffect(() => {
    const fetchChapterStats = async () => {
      const stats = await getChapterStats(dictID, chapter)
      setChapterStats(stats)
    }

    if (isStartLoad && !chapterStats) {
      fetchChapterStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictID, chapter, isStartLoad])

  return chapterStats
}

interface IChapterStats {
  exerciseCount: number
  avgWrongWordCount: number
  avgWrongInputCount: number
}

async function getChapterStats(dict: string, chapter: number): Promise<IChapterStats> {
  const records = (await call('chapters.byDictChapter', dict, chapter)).map(toChapterRecord)

  const exerciseCount = records.length
  const totalWrongWordCount = records.reduce(
    (total, { wordNumber, correctWordIndexes }) => total + (wordNumber - correctWordIndexes.length),
    0,
  )
  const avgWrongWordCount = exerciseCount > 0 ? toFixedNumber(totalWrongWordCount / exerciseCount, 2) : 0

  const totalWrongInputCount = records.reduce((total, { wrongCount }) => total + (wrongCount ?? 0), 0)
  const avgWrongInputCount = exerciseCount > 0 ? toFixedNumber(totalWrongInputCount / exerciseCount, 2) : 0

  return { exerciseCount, avgWrongWordCount, avgWrongInputCount }
}
