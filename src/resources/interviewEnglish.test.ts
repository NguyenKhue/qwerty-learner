import { idDictionaryMap } from './dictionary'
import { findTarget } from '@/utils/sentences/highlight'
import { isPlayable } from '@/utils/sentences/pool'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

type Entry = { name: string; trans: string[]; usphone: string; ukphone: string }
type Extras = Record<string, { detail: string; examples: { text: string; trans: string }[] }>

const read = <T>(file: string): T => JSON.parse(readFileSync(`public/dicts/${file}`, 'utf8')) as T
const words = read<Entry[]>('interview-english.json')
const extras = read<Extras>('interview-english.extras.json')

describe('Interview English set', () => {
  it('is declared with the number of words of its file', () => {
    const dict = idDictionaryMap.interviewEnglish
    expect(dict).toBeDefined()
    expect(dict.length).toBe(words.length)
    expect(dict.url).toBe('/dicts/interview-english.json')
  })

  it('has unique words, each with meanings and an entry in the extras file', () => {
    const names = words.map((w) => w.name.toLowerCase())
    expect(new Set(names).size).toBe(names.length)
    words.forEach((w) => {
      expect(w.trans.length, w.name).toBeGreaterThan(0)
      expect(extras[w.name], w.name).toBeDefined()
    })
    expect(Object.keys(extras).length).toBe(words.length)
  })

  it('has example sentences that Sentences mode can use: playable, and containing their word', () => {
    words.forEach((w) => {
      const { examples } = extras[w.name]
      expect(examples.length, w.name).toBeGreaterThanOrEqual(2)
      examples.forEach((example) => {
        expect(isPlayable(example.text), `${w.name}: ${example.text}`).toBe(true)
        expect(findTarget(example.text, w.name), `${w.name}: ${example.text}`).not.toBeNull()
        expect(example.trans.length).toBeGreaterThan(0)
      })
    })
  })
})
