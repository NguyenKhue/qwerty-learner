import * as cardProgress from '../repo/cardProgress'
import * as chapterRecords from '../repo/chapterRecords'
import * as customDicts from '../repo/customDicts'
import * as reviewRecords from '../repo/reviewRecords'
import * as wordRecords from '../repo/wordRecords'
import { ProcedureError, argObject, argString } from './support'
import type { Handler } from './support'
import type { CustomDictInput, ProcedureName } from '@/data/contract'
import { normalizeWords } from '@/utils/custom-dict/parse'
import type { CustomDictRecord } from '@/utils/db/record'

const CUSTOM_DICT_PREFIX = 'custom:'

function newId(at: number): string {
  return at.toString(36) + Math.random().toString(36).slice(2, 8)
}

/** The set input of a call: a name, an optional description and a list of words. */
function readInput(args: unknown[], index: number): CustomDictInput {
  const input = argObject(args, index, 'input')
  if (typeof input.name !== 'string') throw new ProcedureError('BAD_REQUEST', 'input.name must be a string')
  if (input.description !== undefined && input.description !== null && typeof input.description !== 'string') {
    throw new ProcedureError('BAD_REQUEST', 'input.description must be a string')
  }
  if (!Array.isArray(input.words)) throw new ProcedureError('BAD_REQUEST', 'input.words must be a list')
  return { name: input.name, description: (input.description as string | null | undefined) ?? undefined, words: input.words }
}

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  'sets.list': ({ db }) => customDicts.list(db),

  'sets.get': ({ db }, args) => customDicts.get(db, argString(args, 0, 'id')),

  'sets.create': ({ db, now }, args) => {
    const input = readInput(args, 0)
    const at = now()
    const record: CustomDictRecord = {
      id: newId(at),
      name: input.name.trim(),
      description: (input.description ?? '').trim(),
      words: normalizeWords(input.words).words,
      createdAt: at,
      updatedAt: at,
    }
    customDicts.insert(db, record)
    return record
  },

  'sets.update': ({ db, now }, args) => {
    const id = argString(args, 0, 'id')
    const input = readInput(args, 1)
    const existing = customDicts.get(db, id)
    if (!existing) throw new ProcedureError('NOT_FOUND', `Custom dictionary ${id} not found`)
    customDicts.replace(db, {
      ...existing,
      name: input.name.trim(),
      description: (input.description ?? '').trim(),
      words: normalizeWords(input.words).words,
      updatedAt: now(),
    })
    return null
  },

  /** Removes the set and everything that belongs to it (cards, typing records, chapter records, review records) in one transaction. */
  'sets.delete': ({ db }, args) => {
    const id = argString(args, 0, 'id')
    const dictId = CUSTOM_DICT_PREFIX + id
    db.transaction(() => {
      cardProgress.deleteByDict(db, dictId)
      wordRecords.deleteByDict(db, dictId)
      chapterRecords.deleteByDict(db, dictId)
      reviewRecords.deleteByDict(db, dictId)
      customDicts.delete(db, id)
    })
    return null
  },
}
