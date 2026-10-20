import { call } from '@/data/rpc'
import { useEffect, useState } from 'react'

export function useRevisionWordCount(dictID: string) {
  const [wordCount, setWordCount] = useState<number>(0)

  useEffect(() => {
    const fetchWordCount = async () => {
      const count = await getRevisionWordCount(dictID)
      setWordCount(count)
    }

    if (dictID) {
      fetchWordCount()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dictID])

  return wordCount
}

async function getRevisionWordCount(dict: string): Promise<number> {
  return call('words.revisionCount', dict)
}
