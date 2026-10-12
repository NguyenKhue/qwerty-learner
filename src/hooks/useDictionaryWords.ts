import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending, lookupDictionary } from '@/store/customDicts'
import type { Dictionary, Word } from '@/typings'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'

/**
 * Resolves a dictionary id (built-in or custom) and loads its words.
 * Unknown ids redirect to the Gallery; a custom id is given time to load before it is judged unknown.
 */
export function useDictionaryWords(id: string): { dict: Dictionary | undefined; words: Word[] | undefined; error: unknown } {
  const navigate = useNavigate()
  const dictionaryById = useAtomValue(dictionaryByIdAtom)
  const customLoaded = useAtomValue(customDictionariesLoadedAtom)
  const dict = lookupDictionary(dictionaryById, id)
  const pending = isCustomDictPending(id, customLoaded)

  useEffect(() => {
    if (!dict && !pending) navigate('/gallery', { replace: true })
  }, [dict, pending, navigate])

  const { data: words, error } = useSWR(dict ? dict.url : null, wordListFetcher)
  return { dict, words, error }
}
