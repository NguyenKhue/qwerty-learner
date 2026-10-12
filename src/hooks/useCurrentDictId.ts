import { currentDictIdAtom, currentDictInfoAtom } from '@/store'
import { customDictionariesLoadedAtom, isCustomDictPending } from '@/store/customDicts'
import { useAtomValue } from 'jotai'

/** The id of the current set, or null while a stored custom id is still being read from IndexedDB (otherwise the fallback set would flash and load). */
export function useCurrentDictId(): string | null {
  const storedId = useAtomValue(currentDictIdAtom)
  const loaded = useAtomValue(customDictionariesLoadedAtom)
  const dict = useAtomValue(currentDictInfoAtom)
  return isCustomDictPending(storedId, loaded) ? null : dict.id
}
