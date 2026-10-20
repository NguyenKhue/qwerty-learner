import * as cardProgress from '../repo/cardProgress'
import * as chapterRecords from '../repo/chapterRecords'
import * as customDicts from '../repo/customDicts'
import * as reviewLog from '../repo/reviewLog'
import * as reviewRecords from '../repo/reviewRecords'
import * as wordRecords from '../repo/wordRecords'
import { ProcedureError, argArray, argObject, argString } from './support'
import type { Handler } from './support'
import type { ProcedureName } from '@/data/contract'
import type { Word } from '@/typings'
import { normalizeWords } from '@/utils/custom-dict/parse'
import { respell } from '@/utils/detail/respell'
import { mergeExtras } from '@/utils/detail/sidecar'
import type { WordExtras } from '@/utils/detail/sidecar'
import { mergeExamples } from '@/utils/examples/format'

const CUSTOM_DICT_PREFIX = 'custom:'

function str(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string') throw new ProcedureError('BAD_REQUEST', `${key} must be a string`)
  return value
}

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  /**
   * Turns a built-in dictionary into an editable set of the user and carries everything done with it over, in one transaction (all or
   * nothing): study progress, typing history, mistake reviews and the review log. Safe to run again: an existing set is never overwritten
   * and rows already on the new set are kept.
   */
  'personal.migrate': ({ db, now }, args) => {
    const input = argObject(args, 0, 'input')
    const builtInId = str(input, 'builtInId')
    const customId = str(input, 'customId')
    const name = str(input, 'name')
    const description = str(input, 'description')
    if (!Array.isArray(input.words)) throw new ProcedureError('BAD_REQUEST', 'words must be a list')
    const words = input.words as Word[]
    const newDictId = CUSTOM_DICT_PREFIX + customId

    return db.transaction(() => {
      let created = false
      if (!customDicts.get(db, customId)) {
        const at = now()
        customDicts.insert(db, {
          id: customId,
          name: name.trim(),
          description: description.trim(),
          words: normalizeWords(words).words,
          createdAt: at,
          updatedAt: at,
        })
        created = true
      }

      const oldCards = cardProgress.byDict(db, builtInId)
      for (const row of oldCards) {
        if (!cardProgress.get(db, newDictId, row.word)) cardProgress.put(db, { ...row, dict: newDictId })
        cardProgress.delete(db, builtInId, row.word)
      }

      const typedWords = wordRecords.moveDict(db, builtInId, newDictId)
      const chapters = chapterRecords.moveDict(db, builtInId, newDictId)
      const reviews = reviewRecords.moveDict(db, builtInId, newDictId)
      const log = reviewLog.moveDict(db, builtInId, newDictId)
      return { created, cards: oldCards.length, typedWords, chapters, reviews, log }
    })
  },

  /**
   * Tops up an already created set with the extras (details, examples) of its built-in file: a word keeps its own detail and its own
   * sentences (they stay first) and only receives what it does not have yet. Returns the number of words that changed.
   */
  'personal.backfill': ({ db, now }, args) => {
    const customId = argString(args, 0, 'customId')
    const extras = argObject(args, 1, 'extras') as Record<string, WordExtras>
    return db.transaction(() => {
      const record = customDicts.get(db, customId)
      if (!record) return 0
      const words = mergeExtras(record.words, extras)
      const changed = words.filter((word, index) => word !== record.words[index]).length
      if (changed > 0) customDicts.replace(db, { ...record, words, updatedAt: now() })
      return changed
    })
  },

  /**
   * Corrects misspelled word names of a set. A word whose correct spelling is not in the set is renamed (its detail is respelled and its
   * study card, review log and typing history move to the new name). When the correct word already exists the two are merged. Returns
   * how many words were fixed; nothing is written when it is 0.
   */
  'personal.fixNames': ({ db, now }, args) => {
    const customId = argString(args, 0, 'customId')
    const list = argArray(args, 1, 'renames')
    const renames = list.map((item) => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof (item as Record<string, unknown>).from !== 'string' ||
        typeof (item as Record<string, unknown>).to !== 'string'
      ) {
        throw new ProcedureError('BAD_REQUEST', 'every rename needs a from and a to')
      }
      return item as { from: string; to: string }
    })
    const dictId = CUSTOM_DICT_PREFIX + customId

    return db.transaction(() => {
      const record = customDicts.get(db, customId)
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
        const oldCard = cardProgress.get(db, dictId, from)
        if (oldCard) {
          if (!cardProgress.get(db, dictId, to)) cardProgress.put(db, { ...oldCard, word: to })
          cardProgress.delete(db, dictId, from)
        }
        reviewLog.renameWord(db, dictId, from, to)
        wordRecords.renameWord(db, dictId, from, to)
        fixed++
      }
      if (fixed > 0) customDicts.replace(db, { ...record, words, updatedAt: now() })
      return fixed
    })
  },
}
