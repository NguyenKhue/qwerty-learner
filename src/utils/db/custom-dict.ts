import { db } from './database'
import type { CustomDictRecord } from './record'
import { CHAPTER_LENGTH } from '@/constants'
import type { Dictionary, Word } from '@/typings'
import { normalizeWords } from '@/utils/custom-dict/parse'

export const CUSTOM_DICT_PREFIX = 'custom:'
export const CUSTOM_URL_PREFIX = 'idb:'

export type CustomDictInput = { name: string; description?: string; words: Word[] }

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function isCustomDictId(dictId: string): boolean {
  return dictId.indexOf(CUSTOM_DICT_PREFIX) === 0
}

export function customIdOf(dictId: string): string {
  return isCustomDictId(dictId) ? dictId.slice(CUSTOM_DICT_PREFIX.length) : dictId
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
  const now = Date.now()
  const record: CustomDictRecord = {
    id: newId(),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    words: normalizeWords(input.words).words,
    createdAt: now,
    updatedAt: now,
  }
  await db.customDicts.add(record)
  return record
}

export async function updateCustomDict(id: string, input: CustomDictInput): Promise<void> {
  const existing = await db.customDicts.get(id)
  if (!existing) throw new Error(`Custom dictionary ${id} not found`)
  await db.customDicts.put({
    ...existing,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    words: normalizeWords(input.words).words,
    updatedAt: Date.now(),
  })
}

export async function deleteCustomDict(id: string): Promise<void> {
  const dictId = CUSTOM_DICT_PREFIX + id
  await db.transaction('rw', [db.customDicts, db.cardProgress, db.wordRecords, db.chapterRecords, db.reviewRecords], async () => {
    await db.cardProgress.where('dict').equals(dictId).delete()
    await db.wordRecords.where('dict').equals(dictId).delete()
    await db.chapterRecords.where('dict').equals(dictId).delete()
    await db.reviewRecords.where('dict').equals(dictId).delete()
    await db.customDicts.delete(id)
  })
}

export async function getCustomDict(id: string): Promise<CustomDictRecord | undefined> {
  return db.customDicts.get(id)
}

export async function listCustomDicts(): Promise<CustomDictRecord[]> {
  return db.customDicts.orderBy('createdAt').toArray()
}

export async function getCustomDictWords(id: string): Promise<Word[]> {
  const record = await db.customDicts.get(id)
  if (!record) throw new Error(`Custom dictionary ${id} not found`)
  return record.words
}
