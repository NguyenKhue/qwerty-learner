import { customDictionariesAtom, customDictionariesLoadedAtom } from '@/store/customDicts'
import { customDictToDictionary, listCustomDicts } from '@/utils/db/custom-dict'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'

/** Keeps the custom-set atoms in sync with IndexedDB (live: edits elsewhere in the app show up immediately). */
export default function CustomDictsSync() {
  const records = useLiveQuery(() => listCustomDicts(), [])
  const setDictionaries = useSetAtom(customDictionariesAtom)
  const setLoaded = useSetAtom(customDictionariesLoadedAtom)

  useEffect(() => {
    if (!records) return
    setDictionaries(records.map(customDictToDictionary))
    setLoaded(true)
  }, [records, setDictionaries, setLoaded])

  return null
}
