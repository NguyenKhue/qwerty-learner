import { customDictionariesAtom, customDictionariesLoadedAtom } from '@/store/customDicts'
import { CUSTOM_URL_PREFIX, customDictToDictionary, listCustomDicts } from '@/utils/db/custom-dict'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { mutate } from 'swr'

/** Keeps the custom-set atoms in sync with IndexedDB (live: edits elsewhere in the app show up immediately). */
export default function CustomDictsSync() {
  const records = useLiveQuery(() => listCustomDicts(), [])
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
