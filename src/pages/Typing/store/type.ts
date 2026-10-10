import type { WordWithIndex } from '@/typings'
import type { LetterMistakes } from '@/utils/db/record'

export type ChapterData = {
  // warning: because words can be shuffled within a chapter, every place that records an index should use WordWithIndex.index
  words: WordWithIndex[]
  // chapter index
  index: number
  // Number of words typed
  wordCount: number
  // Number of words typed correctly
  correctCount: number
  // Number of words typed incorrectly
  wrongCount: number
  // Input log for each word
  userInputLogs: UserInputLog[]
  // List of record ids of the words typed by the user in this chapter
  wordRecordIds: number[]
}

export type UserInputLog = {
  // the index in ChapterData.words, not the index in WordWithIndex
  index: number
  correctCount: number
  wrongCount: number
  LetterMistakes: LetterMistakes
}

export type TimerData = {
  time: number
  accuracy: number
  wpm: number
}

export type WrongWordData = {
  name: string
  wrongCount: number
  wrongLetters: Array<{
    letter: string
    count: number
  }>
}

export type TypingState = {
  chapterData: ChapterData
  timerData: TimerData
  isTyping: boolean
  isFinished: boolean
  isShowSkip: boolean
  isTransVisible: boolean
  isLoopSingleWord: boolean
  // Whether data is currently being saved
  isSavingRecord: boolean
}
