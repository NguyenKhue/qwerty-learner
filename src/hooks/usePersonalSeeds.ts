import { idDictionaryMap } from '@/resources/dictionary'
import { currentDictIdAtom } from '@/store'
import { seededPersonalSetsAtom } from '@/store/personal'
import { CUSTOM_DICT_PREFIX } from '@/utils/db/custom-dict'
import { PERSONAL_SEEDS, migratePersonalSet } from '@/utils/db/personal-seed'
import { attachDetails, fetchDetailMap } from '@/utils/detail/sidecar'
import { readBest, writeBest } from '@/utils/match/best'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtom, useSetAtom } from 'jotai'
import { useEffect, useRef } from 'react'

/**
 * The first time the app opens, built-in sets that belong to the user (My Vocabulary) become editable sets of their own, with the
 * study progress and typing history moved along. Once done the built-in copy is hidden from the Library. A failure (for example the
 * word file cannot be fetched) changes nothing and is retried on the next start.
 */
export function usePersonalSeeds() {
  const [seeded, setSeeded] = useAtom(seededPersonalSetsAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const running = useRef(false)

  useEffect(() => {
    const pending = PERSONAL_SEEDS.filter((seed) => seeded.indexOf(seed.builtInId) === -1)
    if (pending.length === 0 || running.current) return
    running.current = true
    ;(async () => {
      for (const seed of pending) {
        const dict = idDictionaryMap[seed.builtInId]
        if (!dict) continue
        try {
          const words = await wordListFetcher(dict.url)
          const detailMap = dict.detailUrl ? await fetchDetailMap(dict.detailUrl) : undefined
          await migratePersonalSet({
            builtInId: seed.builtInId,
            customId: seed.customId,
            name: dict.name,
            description: dict.description,
            words: attachDetails(words, detailMap),
          })
          const newId = CUSTOM_DICT_PREFIX + seed.customId
          const best = readBest(seed.builtInId)
          if (best !== null && readBest(newId) === null) writeBest(newId, best)
          setCurrentDictId((current) => (current === seed.builtInId ? newId : current))
          setSeeded((list) => (list.indexOf(seed.builtInId) === -1 ? list.concat(seed.builtInId) : list))
        } catch (error) {
          console.warn('Could not turn the built-in set into your own set yet', seed.builtInId, error)
        }
      }
      running.current = false
    })()
  }, [seeded, setSeeded, setCurrentDictId])
}
