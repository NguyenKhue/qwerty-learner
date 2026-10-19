import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { useLiveQuery } from 'dexie-react-hooks'

/** The study card of every word of a set that has one, kept up to date as cards change; undefined until read. Read-only. */
export function useCardProgress(dictId: string): ICardProgress[] | undefined {
  return useLiveQuery(() => getDictProgress(dictId), [dictId])
}
