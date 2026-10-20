import { ReviewRecord } from './record'
import { toReviewRecord } from '@/data/hydrate'
import { call } from '@/data/rpc'
import type { TErrorWordData } from '@/pages/Gallery-N/hooks/useErrorWords'
import type { Word } from '@/typings'
import { useEffect, useState } from 'react'

export function useGetLatestReviewRecord(dictID: string) {
  const [wordReviewRecord, setWordReviewRecord] = useState<ReviewRecord | undefined>(undefined)
  useEffect(() => {
    const fetchWordReviewRecords = async () => {
      const record = await getReviewRecords(dictID)
      setWordReviewRecord(record)
    }
    if (dictID) {
      fetchWordReviewRecords()
    }
  }, [dictID])
  return wordReviewRecord
}

async function getReviewRecords(dictID: string): Promise<ReviewRecord | undefined> {
  const row = await call('reviews.latestUnfinished', dictID)
  return row ? toReviewRecord(row) : undefined
}

type TRankedErrorWordData = TErrorWordData & {
  errorCountScore: number
  latestErrorTimeScore: number
}

export async function generateNewWordReviewRecord(dictID: string, errorData: TErrorWordData[]) {
  const errorCountRankings = [...errorData].sort((a, b) => a.errorCount - b.errorCount)
  const latestErrorTimeRankings = [...errorData].sort((a, b) => a.latestErrorTime - b.latestErrorTime)

  // Compute the ranking score of each item
  const errorDataWithRank: TRankedErrorWordData[] = errorData.map((item) => ({
    ...item,
    errorCountScore: errorCountRankings.indexOf(item) + 1,
    latestErrorTimeScore: latestErrorTimeRankings.indexOf(item) + 1,
  }))

  // Sort by the weighted ranking
  const errorCountWeight = 0.6
  const latestErrorTimeWeight = 0.4

  const sortedWords: Word[] = errorDataWithRank
    .sort((a, b) => {
      // Compute the score of a and b
      const scoreA = a.errorCountScore * errorCountWeight + a.latestErrorTimeScore * latestErrorTimeWeight
      const scoreB = b.errorCountScore * errorCountWeight + b.latestErrorTimeScore * latestErrorTimeWeight

      // Sort by score
      return scoreA - scoreB
    })
    .map((item) => item.originData)

  const record = new ReviewRecord(dictID, sortedWords)
  record.id = await call('reviews.put', record)
  return record
}

export async function putWordReviewRecord(record: ReviewRecord) {
  return call('reviews.put', record)
}
