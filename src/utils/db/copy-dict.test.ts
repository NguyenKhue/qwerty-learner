import { duplicateDictionaryAsCustom } from './copy-dict'
import { getCustomDictWords } from './custom-dict'
import type { Dictionary, Word } from '@/typings'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const words: Word[] = [
  { name: 'strict', trans: ['adj. nghiêm ngặt'], usphone: '', ukphone: '' },
  { name: 'plain', trans: ['adj. đơn giản'], usphone: '', ukphone: '' },
]

vi.mock('@/utils/wordListFetcher', () => ({ wordListFetcher: vi.fn(async () => words.map((w) => ({ ...w }))) }))
vi.mock('@/utils/detail/sidecar', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/detail/sidecar')>()
  return { ...original, fetchDetailMap: vi.fn(async () => ({ strict: 'Long detail for strict' })) }
})

const dict = (over: Partial<Dictionary> = {}): Dictionary => ({
  id: 'built-in',
  name: 'Built-in',
  description: '',
  category: 'x',
  tags: [],
  url: '/dicts/built-in.json',
  length: 2,
  language: 'en',
  languageCategory: 'en',
  chapterCount: 1,
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('duplicateDictionaryAsCustom with details', () => {
  it('copies the details of a built-in set that has a detail file, so the copy keeps its flip-card text', async () => {
    const record = await duplicateDictionaryAsCustom(dict({ detailUrl: '/dicts/built-in.detail.json' }))
    const copied = await getCustomDictWords(record.id)
    expect(copied.find((w) => w.name === 'strict')?.detail).toBe('Long detail for strict')
    expect(copied.find((w) => w.name === 'plain')?.detail).toBeUndefined()
  })

  it('does not fetch a detail file for a set that has none', async () => {
    const { fetchDetailMap } = await import('@/utils/detail/sidecar')
    const record = await duplicateDictionaryAsCustom(dict())
    expect(fetchDetailMap).not.toHaveBeenCalled()
    expect((await getCustomDictWords(record.id)).every((w) => w.detail === undefined)).toBe(true)
  })
})
