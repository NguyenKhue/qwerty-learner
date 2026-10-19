import { CUSTOM_DICT_PREFIX } from './custom-dict'
import { db } from './database'
import type { Word } from '@/typings'
import { normalizeWords } from '@/utils/custom-dict/parse'
import { mergeExtras } from '@/utils/detail/sidecar'
import type { WordExtras } from '@/utils/detail/sidecar'
import { mergeExamples } from '@/utils/examples/format'

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

/** Bumped whenever the example sentences of a built-in file change, so a set created earlier is topped up once more. */
export const EXTRAS_VERSION = 2

/** The entry of the "already topped up" list for a built-in set at the current data version. */
export function extrasFlag(builtInId: string): string {
  return `${builtInId}@${EXTRAS_VERSION}`
}

/**
 * Tops up an already created set with the extras (details, examples) of its built-in file: a word keeps its own detail and its own
 * sentences (they stay first) and only receives what it does not have yet, so the user's edits are never lost. Returns the number of
 * words that changed; the record is untouched when it is 0.
 */
export async function backfillPersonalExtras(customId: string, map: Record<string, WordExtras>): Promise<number> {
  return db.transaction('rw', db.customDicts, async () => {
    const record = await db.customDicts.get(customId)
    if (!record) return 0
    const words = mergeExtras(record.words, map)
    const changed = words.filter((word, index) => word !== record.words[index]).length
    if (changed > 0) await db.customDicts.put({ ...record, words, updatedAt: Date.now() })
    return changed
  })
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

/** Replaces a misspelling in a text, case-insensitively and as a whole word, keeping a leading capital. */
function respell(text: string, from: string, to: string): string {
  const pattern = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  return text.replace(pattern, (match) => (match[0] === match[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to))
}

/**
 * Corrects misspelled word names of a set. A word whose correct spelling is not in the set is renamed (its detail is respelled and its
 * study card, review log and typing history move to the new name). When the correct word already exists the two are merged: it keeps
 * its own card, meanings and detail and gains the meanings and sentences it lacked; history is re-pointed to it. Returns how many
 * words were fixed; nothing is written when it is 0.
 */
export async function fixWordNames(customId: string, renames: { from: string; to: string }[]): Promise<number> {
  const dictId = CUSTOM_DICT_PREFIX + customId
  return db.transaction('rw', [db.customDicts, db.cardProgress, db.reviewLog, db.wordRecords], async () => {
    const record = await db.customDicts.get(customId)
    if (!record) return 0
    let words = record.words.slice()
    let fixed = 0
    for (const { from, to } of renames) {
      const fromIndex = words.findIndex((w) => w.name === from)
      if (fromIndex === -1) continue
      const source = words[fromIndex]
      const toIndex = words.findIndex((w) => w.name === to)
      if (toIndex === -1) {
        words[fromIndex] = { ...source, name: to, ...(source.detail === undefined ? {} : { detail: respell(source.detail, from, to) }) }
      } else {
        const target = words[toIndex]
        const examples = mergeExamples(target.examples, source.examples)
        const trans = target.trans.concat(source.trans.filter((t) => target.trans.indexOf(t) === -1))
        words[toIndex] = { ...target, trans, ...(examples === undefined ? {} : { examples }) }
        words = words.filter((_, index) => index !== fromIndex)
      }
      const oldCard = await db.cardProgress.get([dictId, from])
      if (oldCard) {
        if (!(await db.cardProgress.get([dictId, to]))) await db.cardProgress.put({ ...oldCard, word: to })
        await db.cardProgress.delete([dictId, from])
      }
      await db.reviewLog
        .where('dict')
        .equals(dictId)
        .filter((entry) => entry.word === from)
        .modify({ word: to })
      await db.wordRecords
        .where('dict')
        .equals(dictId)
        .filter((entry) => entry.word === from)
        .modify({ word: to })
      fixed++
    }
    if (fixed > 0) await db.customDicts.put({ ...record, words, updatedAt: Date.now() })
    return fixed
  })
}
