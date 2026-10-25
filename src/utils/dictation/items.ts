import { dictationText } from './normalize'
import type { DictationSentence } from './types'

/** One sentence to type in a dictation run: `text` is what is typed, `index` its position in the video's sentence list. */
export type DictationItem = {
  text: string
  index: number
  start: number
  end: number
  en: string
  vi?: string
  viSource?: 'youtube' | 'ai'
}

/** The sentences from position `from` on, as items to type; a sentence that cannot be typed is skipped. */
export function toItems(sentences: DictationSentence[], from = 0): DictationItem[] {
  const items: DictationItem[] = []
  sentences.forEach((sentence, index) => {
    if (index < from) return
    const text = dictationText(sentence.en)
    if (text === null) return
    items.push({ text, index, ...sentence })
  })
  return items
}
