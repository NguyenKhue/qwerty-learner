import { useLive } from '@/data/useLive'
import { usePersonalSeeds } from '@/hooks/usePersonalSeeds'
import { customDictionariesAtom, customDictionariesLoadedAtom } from '@/store/customDicts'
import { CUSTOM_URL_PREFIX, customDictToDictionary, listCustomDicts } from '@/utils/db/custom-dict'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { mutate } from 'swr'

/** Keeps the custom-set atoms in sync with the data server (live: edits elsewhere in the app show up immediately). */
export default function CustomDictsSync() {
  usePersonalSeeds()
  const records = useLive(() => listCustomDicts(), ['customDicts'], [])
  const setDictionaries = useSetAtom(customDictionariesAtom)
  const setLoaded = useSetAtom(customDictionariesLoadedAtom)

  useEffect(() => {
    if (!records) return
    setDictionaries(records.map(customDictToDictionary))
    setLoaded(true)
    // The word lists of custom sets are cached by SWR under their `idb:` url: clear them so an edit shows up at once (no stale words)
    mutate((key) => typeof key === 'string' && key.indexOf(CUSTOM_URL_PREFIX) === 0, undefined, { revalidate: true })
  }, [records, setDictionaries, setLoaded])

  return null
}
