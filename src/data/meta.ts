import { call } from './rpc'
import { atom } from 'jotai'
import type { SetStateAction } from 'jotai'

/** The flags that describe the learner's data, as the boot gate loaded them from the data file (key to JSON text). */
export const metaAtom = atom<Record<string, string>>({})

function parseList(text: string | undefined): string[] {
  if (text === undefined) return []
  try {
    const value: unknown = JSON.parse(text)
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/**
 * A list of strings kept in the data file under `key`. It reads and updates like `atomWithStorage<string[]>` did (a value or an
 * update function), shows a write at once and saves it to the data file in the background.
 */
export function listAtom(key: string) {
  const self = atom(
    (get) => parseList(get(metaAtom)[key]),
    (get, set, update: SetStateAction<string[]>) => {
      const next = typeof update === 'function' ? update(get(self)) : update
      const json = JSON.stringify(next)
      set(metaAtom, { ...get(metaAtom), [key]: json })
      call('meta.set', key, json).catch((error) => console.error(`Could not save "${key}" to the data file`, error))
    },
  )
  return self
}
