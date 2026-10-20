import { useLive } from '@/data/useLive'
import type { Word } from '@/typings'
import { getDictProgress } from '@/utils/db/card-progress'
import { type ProgressSummary, progressSummary } from '@/utils/progress/status'
import { useMemo } from 'react'

/** The set's learned/in-progress/new counts, kept up to date as cards change; null until both words and cards are read. */
export function useSetProgress(dictId: string, words: Word[] | null | undefined): ProgressSummary | null {
  const progress = useLive(() => getDictProgress(dictId), [`cards:${dictId}`], [dictId])
  return useMemo(() => (words && progress ? progressSummary(words, progress) : null), [words, progress])
}
