import { call } from '@/data/rpc'
import type { Word } from '@/typings'
import type { WordExtras } from '@/utils/detail/sidecar'

export type PersonalSeedInput = {
  /** Id of the built-in dictionary being turned into the user's own set (e.g. `myVocab`) */
  builtInId: string
  /** Bare record id of the new editable set; the dictionary id becomes `custom:<customId>` */
  customId: string
  name: string
  description: string
  words: Word[]
}

/** Built-in sets that belong to the user and become editable sets of their own the first time the app opens. */
export const PERSONAL_SEEDS: { builtInId: string; customId: string }[] = [{ builtInId: 'myVocab', customId: 'myvocab' }]

/**
 * Whether `customId` (a bare record id) belongs to a built-in set that has not been turned into the user's set yet. A page opened on
 * its address during the very first start finds no record at that moment: it has to wait for the move instead of reporting "not found".
 */
export function isPersonalSeedPending(customId: string, seededBuiltInIds: string[]): boolean {
  return PERSONAL_SEEDS.some((seed) => seed.customId === customId && seededBuiltInIds.indexOf(seed.builtInId) === -1)
}

export type PersonalSeedResult = { created: boolean; cards: number; typedWords: number; chapters: number; reviews: number; log: number }

/** Turns a built-in dictionary into an editable set of the user, carrying everything done with it over, all or nothing. */
export async function migratePersonalSet(input: PersonalSeedInput): Promise<PersonalSeedResult> {
  return call('personal.migrate', input)
}

/** Bumped whenever the example sentences of a built-in file change, so a set created earlier is topped up once more. */
export const EXTRAS_VERSION = 2

/** The entry of the "already topped up" list for a built-in set at the current data version. */
export function extrasFlag(builtInId: string): string {
  return `${builtInId}@${EXTRAS_VERSION}`
}

/** Tops up an already created set with the extras of its built-in file and returns how many words changed. */
export async function backfillPersonalExtras(customId: string, map: Record<string, WordExtras>): Promise<number> {
  return call('personal.backfill', customId, map)
}

/** Words of a built-in personal set whose name was misspelled in the original data, with the correct spelling. */
export const PERSONAL_RENAMES: Record<string, { from: string; to: string }[]> = {
  myVocab: [
    { from: 'disclamer', to: 'disclaimer' },
    { from: 'reponsive', to: 'responsive' },
    { from: 'widepread', to: 'widespread' },
    { from: 'accommplish', to: 'accomplish' },
  ],
}

/** The entry of the "already topped up" list that marks the spelling fixes of a built-in set as done. */
export function namesFlag(builtInId: string): string {
  return `${builtInId}#names1`
}

/** Corrects misspelled word names of a set and returns how many words were fixed. */
export async function fixWordNames(customId: string, renames: { from: string; to: string }[]): Promise<number> {
  return call('personal.fixNames', customId, renames)
}
