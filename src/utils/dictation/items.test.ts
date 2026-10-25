import { toItems } from './items'
import type { DictationSentence } from './types'
import { describe, expect, it } from 'vitest'

const sentences: DictationSentence[] = [
  { start: 0, end: 2, en: 'Hello, everyone!', vi: 'Xin chào', viSource: 'youtube' },
  { start: 2, end: 4, en: 'We met at the café.' },
  { start: 4, end: 6, en: "Don't worry about it." },
  { start: 6, end: 8, en: 'See you tomorrow, then.' },
]

describe('toItems', () => {
  it('turns sentences into what the learner types, keeping their times, text and translation', () => {
    const items = toItems(sentences)
    expect(items[0]).toEqual({
      text: 'hello everyone',
      index: 0,
      start: 0,
      end: 2,
      en: 'Hello, everyone!',
      vi: 'Xin chào',
      viSource: 'youtube',
    })
    expect(items.map((i) => i.text)).toEqual(['hello everyone', "don't worry about it", 'see you tomorrow then'])
  })

  it('starts at a given sentence and keeps the original positions', () => {
    const items = toItems(sentences, 2)
    expect(items.map((i) => i.index)).toEqual([2, 3])
  })
})
