import { call } from '@/data/rpc'
import dayjs from 'dayjs'
import { useEffect, useState } from 'react'

export function useChapterNumber() {
  const [chapterNumber, setChapterNumber] = useState<number>(0)

  useEffect(() => {
    const fetchChapterNumber = async () => {
      const summary = await call('stats.summary')
      setChapterNumber(summary.chapterCount)
    }

    fetchChapterNumber()
  }, [])

  return chapterNumber
}

export function useDayFromFirstWordRecord() {
  const [dayFromFirstWordRecord, setDayFromFirstWordRecord] = useState<number>(0)

  useEffect(() => {
    const fetchDayFromFirstWordRecord = async () => {
      const summary = await call('stats.summary')
      const firstWordRecordTimeStamp = summary.firstWordTimestamp ?? 0
      const now = dayjs()
      const timestamp = dayjs.unix(firstWordRecordTimeStamp)
      const daysPassed = now.diff(timestamp, 'day')
      setDayFromFirstWordRecord(daysPassed)
    }

    fetchDayFromFirstWordRecord()
  }, [])

  return dayFromFirstWordRecord
}

export function useWordNumber() {
  const [wordNumber, setWordNumber] = useState<number>(0)

  useEffect(() => {
    const fetchWordNumber = async () => {
      const summary = await call('stats.summary')
      setWordNumber(summary.wordCount)
    }

    fetchWordNumber()
  }, [])

  return wordNumber
}

export function useSumWrongCount() {
  const [sumWrongCount, setSumWrongCount] = useState<number>(0)

  useEffect(() => {
    const fetchSumWrongCount = async () => {
      const summary = await call('stats.summary')
      setSumWrongCount(summary.sumWrongCount)
    }

    fetchSumWrongCount()
  }, [])

  return sumWrongCount
}
