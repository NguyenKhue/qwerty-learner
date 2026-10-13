import { CUSTOM_DICT_PREFIX } from './custom-dict'
import { db } from './database'
import type { Word } from '@/typings'
import { normalizeWords } from '@/utils/custom-dict/parse'

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

/**
 * Turns a built-in dictionary into an editable set of the user and carries everything done with it over, in one transaction (all or
 * nothing): study progress, typing history, mistake reviews and the review log. Safe to run again: an existing set is never overwritten
 * (the user's edits survive) and rows already on the new set are kept.
 */
export async function migratePersonalSet(input: PersonalSeedInput): Promise<PersonalSeedResult> {
  const newDictId = CUSTOM_DICT_PREFIX + input.customId
  const tables = [db.customDicts, db.cardProgress, db.wordRecords, db.chapterRecords, db.reviewRecords, db.reviewLog]
  return db.transaction('rw', tables, async () => {
    let created = false
    if (!(await db.customDicts.get(input.customId))) {
      const now = Date.now()
      await db.customDicts.add({
        id: input.customId,
        name: input.name.trim(),
        description: input.description.trim(),
        words: normalizeWords(input.words).words,
        createdAt: now,
        updatedAt: now,
      })
      created = true
    }

    const oldCards = await db.cardProgress.where('dict').equals(input.builtInId).toArray()
    for (let i = 0; i < oldCards.length; i++) {
      const row = oldCards[i]
      if (!(await db.cardProgress.get([newDictId, row.word]))) await db.cardProgress.put({ ...row, dict: newDictId })
      await db.cardProgress.delete([input.builtInId, row.word])
    }

    const typedWords = await db.wordRecords.where('dict').equals(input.builtInId).modify({ dict: newDictId })
    const chapters = await db.chapterRecords.where('dict').equals(input.builtInId).modify({ dict: newDictId })
    const reviews = await db.reviewRecords.where('dict').equals(input.builtInId).modify({ dict: newDictId })
    const log = await db.reviewLog.where('dict').equals(input.builtInId).modify({ dict: newDictId })
    return { created, cards: oldCards.length, typedWords, chapters, reviews, log }
  })
}
