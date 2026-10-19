import { idDictionaryMap } from '@/resources/dictionary'
import { currentDictIdAtom } from '@/store'
import { backfilledPersonalExtrasAtom, seededPersonalSetsAtom } from '@/store/personal'
import { CUSTOM_DICT_PREFIX } from '@/utils/db/custom-dict'
import { PERSONAL_SEEDS, backfillPersonalExtras, migratePersonalSet } from '@/utils/db/personal-seed'
import { attachExtras, fetchWordExtras, sidecarUrlOf } from '@/utils/detail/sidecar'
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
  const [backfilled, setBackfilled] = useAtom(backfilledPersonalExtrasAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const running = useRef(false)

  useEffect(() => {
    const pending = PERSONAL_SEEDS.filter((seed) => seeded.indexOf(seed.builtInId) === -1)
    // Sets created before the examples existed get them once, without touching what the user already has
    const toBackfill = PERSONAL_SEEDS.filter((seed) => seeded.indexOf(seed.builtInId) !== -1 && backfilled.indexOf(seed.builtInId) === -1)
    if ((pending.length === 0 && toBackfill.length === 0) || running.current) return
    running.current = true
    ;(async () => {
      for (const seed of pending) {
        const dict = idDictionaryMap[seed.builtInId]
        if (!dict) continue
        try {
          const words = await wordListFetcher(dict.url)
          const sidecarUrl = sidecarUrlOf(dict)
          const extras = sidecarUrl ? await fetchWordExtras(sidecarUrl) : undefined
          await migratePersonalSet({
            builtInId: seed.builtInId,
            customId: seed.customId,
            name: dict.name,
            description: dict.description,
            words: attachExtras(words, extras),
          })
          const newId = CUSTOM_DICT_PREFIX + seed.customId
          const best = readBest(seed.builtInId)
          if (best !== null && readBest(newId) === null) writeBest(newId, best)
          setCurrentDictId((current) => (current === seed.builtInId ? newId : current))
          setSeeded((list) => (list.indexOf(seed.builtInId) === -1 ? list.concat(seed.builtInId) : list))
          // The set may already exist (the stored flags can still be loading on a restart): top it up instead of assuming it is new
          const extrasLoaded = extras !== undefined && Object.keys(extras).length > 0
          if (extras && extrasLoaded) await backfillPersonalExtras(seed.customId, extras)
          // A sidecar that could not be read is retried on the next start instead of being marked done
          if (extrasLoaded || !sidecarUrl)
            setBackfilled((list) => (list.indexOf(seed.builtInId) === -1 ? list.concat(seed.builtInId) : list))
        } catch (error) {
          console.warn('Could not turn the built-in set into your own set yet', seed.builtInId, error)
        }
      }
      for (const seed of toBackfill) {
        const dict = idDictionaryMap[seed.builtInId]
        const sidecarUrl = dict ? sidecarUrlOf(dict) : undefined
        if (!sidecarUrl) continue
        try {
          const extras = await fetchWordExtras(sidecarUrl)
          // An empty map means the file could not be read: try again on the next start instead of marking it done
          if (Object.keys(extras).length === 0) continue
          await backfillPersonalExtras(seed.customId, extras)
          setBackfilled((list) => (list.indexOf(seed.builtInId) === -1 ? list.concat(seed.builtInId) : list))
        } catch (error) {
          console.warn('Could not add the example sentences to your set yet', seed.builtInId, error)
        }
      }
      running.current = false
    })()
  }, [seeded, backfilled, setSeeded, setBackfilled, setCurrentDictId])
}
