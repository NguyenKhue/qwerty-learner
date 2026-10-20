import type { CustomDictRecord } from './record'
import { CHAPTER_LENGTH } from '@/constants'
import type { CustomDictInput } from '@/data/contract'
import { call } from '@/data/rpc'
import type { Dictionary, Word } from '@/typings'

export type { CustomDictInput }

export const CUSTOM_DICT_PREFIX = 'custom:'
export const CUSTOM_URL_PREFIX = 'idb:'

export function isCustomDictId(dictId: string): boolean {
  return dictId.indexOf(CUSTOM_DICT_PREFIX) === 0
}

export function customIdOf(dictId: string): string {
  return isCustomDictId(dictId) ? dictId.slice(CUSTOM_DICT_PREFIX.length) : dictId
}

/** The detail page of a user-made set, or null for a built-in set. */
export function customViewPath(dictId: string): string | null {
  const id = customIdOf(dictId)
  return isCustomDictId(dictId) && id !== '' ? `/my-sets/${id}` : null
}

/** The editor route of a user-made set, or null for a built-in set (those cannot be edited). */
export function customEditPath(dictId: string): string | null {
  const view = customViewPath(dictId)
  return view === null ? null : `${view}/edit`
}

export function customDictToDictionary(rec: CustomDictRecord): Dictionary {
  return {
    id: CUSTOM_DICT_PREFIX + rec.id,
    name: rec.name,
    description: rec.description,
    category: 'My Sets',
    tags: ['Custom'],
    url: CUSTOM_URL_PREFIX + rec.id,
    length: rec.words.length,
    language: 'en',
    languageCategory: 'en',
    // Same formula as calcChapterCount in @/utils; not imported to keep this module free of the utils import cycle
    chapterCount: Math.ceil(rec.words.length / CHAPTER_LENGTH),
  }
}

export async function createCustomDict(input: CustomDictInput): Promise<CustomDictRecord> {
  return call('sets.create', input)
}

export async function updateCustomDict(id: string, input: CustomDictInput): Promise<void> {
  await call('sets.update', id, input)
}

export async function duplicateCustomDict(id: string): Promise<CustomDictRecord> {
  const existing = await call('sets.get', id)
  if (!existing) throw new Error(`Custom dictionary ${id} not found`)
  return createCustomDict({
    name: `${existing.name} (copy)`,
    description: existing.description,
    // createCustomDict normalises into fresh word objects, so the copy never shares state with the original
    words: existing.words,
  })
}

export async function deleteCustomDict(id: string): Promise<void> {
  await call('sets.delete', id)
}

export async function getCustomDict(id: string): Promise<CustomDictRecord | undefined> {
  return (await call('sets.get', id)) ?? undefined
}

export async function listCustomDicts(): Promise<CustomDictRecord[]> {
  return call('sets.list')
}

export async function getCustomDictWords(id: string): Promise<Word[]> {
  const record = await call('sets.get', id)
  if (!record) throw new Error(`Custom dictionary ${id} not found`)
  return record.words
}
