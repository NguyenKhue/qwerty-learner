export * from './resource'

export type PronunciationType = 'us' | 'uk' | 'romaji' | 'zh' | 'ja' | 'de' | 'hapin' | 'kk' | 'id'
export type PhoneticType = 'us' | 'uk' | 'romaji' | 'zh' | 'ja' | 'de' | 'hapin' | 'kk' | 'id'
export type LanguageType = 'en' | 'romaji' | 'zh' | 'ja' | 'code' | 'de' | 'kk' | 'hapin' | 'id'
export type LanguageCategoryType = 'en' | 'ja' | 'de' | 'code' | 'kk' | 'id'

type Pronunciation2PhoneticMap = Record<PronunciationType, PhoneticType>

export const PRONUNCIATION_PHONETIC_MAP: Pronunciation2PhoneticMap = {
  us: 'us',
  uk: 'uk',
  romaji: 'romaji',
  zh: 'zh',
  ja: 'ja',
  de: 'de',
  hapin: 'hapin',
  kk: 'kk',
  id: 'id',
}

export type Word = {
  name: string
  trans: string[]
  usphone: string
  ukphone: string
  notation?: string
}

export type WordWithIndex = Word & {
  // The original index in the chapter
  index: number
}

export type InfoPanelType = 'donate' | 'vsc' | 'community' | 'redBook'

export type InfoPanelState = {
  [key in InfoPanelType]: boolean
}

export type LoopWordTimesOption = 1 | 3 | 5 | 8 | typeof Number.MAX_SAFE_INTEGER

export type WordDictationType = 'hideAll' | 'hideVowel' | 'hideConsonant' | 'randomHide'
/**
 * Marks whether the user opened dictation mode manually, or through the "dictate this chapter"
 * button in the resultScreen
 *
 * The expected behaviour is that when moving on to the next chapter, a manually opened dictation mode
 * keeps its setting, while a dictation mode opened through the resultScreen's "dictate this chapter"
 * button turns dictation mode off
 */
export type WordDictationOpenBy = 'user' | 'auto'
