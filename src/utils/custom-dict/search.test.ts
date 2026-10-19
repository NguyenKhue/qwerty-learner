import { PAGE_SIZE, filterIndexes, normalizeForSearch, visibleCount } from './search'
import { describe, expect, it } from 'vitest'

const words = [
  { name: 'strict', trans: ['adj. nghiêm ngặt, chặt chẽ', 'adj. khắc khe'], detail: 'Mẹo nhớ: Nghiêm ngặt / Chặt chẽ' },
  { name: 'Enforcement', trans: ['n. sự thực thi'] },
  { name: 'đồng bộ', trans: ['v. synchronize'] },
  { name: 'safeguard', trans: ['n. biện pháp bảo vệ'], detail: 'Câu mẫu: The company uses a safeguard.' },
]

describe('normalizeForSearch', () => {
  it('lowercases, removes Vietnamese diacritics and maps đ to d', () => {
    expect(normalizeForSearch('Nghiêm Ngặt')).toBe('nghiem ngat')
    expect(normalizeForSearch('đồng bộ')).toBe('dong bo')
    expect(normalizeForSearch('  Mixed   CASE  ')).toBe('mixed case')
  })
})

describe('filterIndexes', () => {
  it('returns every index for an empty or blank query', () => {
    expect(filterIndexes(words, '')).toEqual([0, 1, 2, 3])
    expect(filterIndexes(words, '   ')).toEqual([0, 1, 2, 3])
  })

  it('matches the word, any meaning and the detail, ignoring case and diacritics', () => {
    expect(filterIndexes(words, 'ENFORCE')).toEqual([1])
    expect(filterIndexes(words, 'nghiem ngat')).toEqual([0])
    expect(filterIndexes(words, 'khắc khe')).toEqual([0])
    expect(filterIndexes(words, 'dong bo')).toEqual([2])
    expect(filterIndexes(words, 'company')).toEqual([3])
  })

  it('needs every term to match (AND), in any order, and returns original positions', () => {
    expect(filterIndexes(words, 'ngat nghiem')).toEqual([0])
    expect(filterIndexes(words, 'n. bao ve')).toEqual([3])
    expect(filterIndexes(words, 'strict synchronize')).toEqual([])
  })

  it('works on editor rows whose meanings are one string, and tolerates a missing detail', () => {
    const rows = [
      { name: 'a', trans: 'adj. một\nadj. hai', detail: '' },
      { name: 'b', trans: 'n. ba' },
    ]
    expect(filterIndexes(rows, 'hai')).toEqual([0])
    expect(filterIndexes(rows, 'ba')).toEqual([1])
    expect(filterIndexes(rows, 'zzz')).toEqual([])
  })

  it('matches a term that appears only in an example sentence or its translation', () => {
    const withExamples = [
      {
        name: 'strict',
        trans: ['adj. x'],
        examples: [{ text: 'Be strict with yourself.', trans: 'Hãy nghiêm khắc với bản thân.' }],
      },
      { name: 'other', trans: ['n. khác'] },
    ]
    expect(filterIndexes(withExamples, 'yourself')).toEqual([0])
    expect(filterIndexes(withExamples, 'nghiem khac')).toEqual([0])
    expect(filterIndexes(withExamples, 'zzz')).toEqual([])
  })
})

describe('visibleCount', () => {
  it('starts at one page and grows by a page, never past the total', () => {
    expect(PAGE_SIZE).toBe(50)
    expect(visibleCount(0, 555)).toBe(50)
    expect(visibleCount(50, 555)).toBe(100)
    expect(visibleCount(500, 555)).toBe(550)
    expect(visibleCount(550, 555)).toBe(555)
    expect(visibleCount(555, 555)).toBe(555)
    expect(visibleCount(0, 12)).toBe(12)
    expect(visibleCount(0, 0)).toBe(0)
  })
})
