import type { LanguageCategoryType, LanguageType, PronunciationType } from '.'

export type DictionaryResource = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  url: string
  length: number
  language: LanguageType
  languageCategory: LanguageCategoryType
  //override default pronunciation when not undefined
  defaultPronIndex?: number
  // JSON map { word: string | { detail?, examples? } }; `detailUrl` is the legacy name for the same loader
  extrasUrl?: string
  // JSON map { word: detail } fetched only by Flashcards
  detailUrl?: string
}

export type Dictionary = {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  url: string
  length: number
  language: LanguageType
  languageCategory: LanguageCategoryType
  // calculated in the store
  chapterCount: number
  //override default pronunciation when not undefined
  defaultPronIndex?: number
  // JSON map { word: string | { detail?, examples? } }; `detailUrl` is the legacy name for the same loader
  extrasUrl?: string
  // JSON map { word: detail } fetched only by Flashcards
  detailUrl?: string
}

export type PronunciationConfig = {
  name: string
  pron: PronunciationType
}

export type LanguagePronunciationMapConfig = {
  defaultPronIndex: number
  pronunciation: PronunciationConfig[]
}

export type LanguagePronunciationMap = {
  [key in LanguageType]: LanguagePronunciationMapConfig
}

export type SoundResource = {
  key: string
  name: string
  filename: string
}
