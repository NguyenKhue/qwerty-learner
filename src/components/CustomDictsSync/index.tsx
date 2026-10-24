import { useLive } from '@/data/useLive'
import { usePersonalSeeds } from '@/hooks/usePersonalSeeds'
import { customDictionariesAtom, customDictionariesLoadedAtom } from '@/store/customDicts'
import { CUSTOM_URL_PREFIX, customDictToDictionary, listCustomDicts } from '@/utils/db/custom-dict'
import { useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'
import { mutate } from 'swr'

/** Keeps the custom-set atoms in sync with the data server (live: edits elsewhere in the app show up immediately). */
export default function CustomDictsSync() {
  usePersonalSeeds()
  const records = useLive(() => listCustomDicts(), ['customDicts'], [])
  const setDictionaries = useSetAtom(customDictionariesAtom)
  const setLoaded = useSetAtom(customDictionariesLoadedAtom)

  // The list is read again whenever the page wakes up: nothing is touched when that read finds the same sets
  const lastSignature = useRef('')
  useEffect(() => {
    if (!records) return
    const signature = JSON.stringify(records.map((record) => [record.id, record.updatedAt, record.words.length]))
    if (signature === lastSignature.current) return
    lastSignature.current = signature
    setDictionaries(records.map(customDictToDictionary))
    setLoaded(true)
    // The word lists of custom sets are cached by SWR under their `idb:` url: read them again so an edit shows up. The old words stay on
    // screen until the new ones arrive (clearing the cache first left the pages on their loading skeleton)
    mutate((key) => typeof key === 'string' && key.indexOf(CUSTOM_URL_PREFIX) === 0)
  }, [records, setDictionaries, setLoaded])

  return null
}
