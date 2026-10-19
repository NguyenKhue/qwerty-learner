import { useDictionaryWords } from './useDictionaryWords'
import type { Dictionary, Word } from '@/typings'
import { attachExtras, fetchWordExtras, sidecarUrlOf } from '@/utils/detail/sidecar'
import { useMemo } from 'react'
import useSWR from 'swr'

/**
 * The words of a set with the example sentences of its sidecar attached (custom sets already carry theirs).
 * `words` stays undefined until the word list and, when the set has a sidecar, the extras have loaded; a sidecar that cannot be read
 * is an empty map, so it never blocks.
 */
export function useExampleWords(id: string): { dict: Dictionary | undefined; words: Word[] | undefined; error: unknown } {
  const { dict, words, error } = useDictionaryWords(id)
  const sidecarUrl = dict ? sidecarUrlOf(dict) : undefined
  const { data: extras } = useSWR(sidecarUrl ?? null, fetchWordExtras)
  const merged = useMemo(() => (words && (!sidecarUrl || extras) ? attachExtras(words, extras) : undefined), [words, extras, sidecarUrl])
  return { dict, words: merged, error }
}
