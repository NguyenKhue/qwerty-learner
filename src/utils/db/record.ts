import { getUTCUnixTimestamp } from '../time'
import type { Word } from '@/typings'

export interface IWordRecord {
  word: string
  timeStamp: number
  // dictKey for a normal chapter, the corresponding type for other features
  dict: string
  // null if the user was practising in the error book or a similar component, otherwise starts from 0
  chapter: number | null
  // The time difference between each letter typed in a correct run, the total time can be computed from this
  timing: number[]
  // Number of errors
  wrongCount: number
  // What each letter was mistakenly typed as, index is the letter index and the array holds the wrong e.key values
  mistakes: LetterMistakes
}

export interface LetterMistakes {
  // What each letter was mistakenly typed as, index is the letter index and the array holds the wrong e.key values
  [index: number]: string[]
}

export class WordRecord implements IWordRecord {
  word: string
  timeStamp: number
  dict: string
  chapter: number | null
  timing: number[]
  wrongCount: number
  mistakes: LetterMistakes

  constructor(word: string, dict: string, chapter: number | null, timing: number[], wrongCount: number, mistakes: LetterMistakes) {
    this.word = word
    this.timeStamp = getUTCUnixTimestamp()
    this.dict = dict
    this.chapter = chapter
    this.timing = timing
    this.wrongCount = wrongCount
    this.mistakes = mistakes
  }

  get totalTime() {
    return this.timing.reduce((acc, curr) => acc + curr, 0)
  }
}

export interface IChapterRecord {
  // dictKey for a normal chapter, the corresponding type for other features
  dict: string
  // -1 in the error book scenario
  chapter: number | null
  timeStamp: number
  // In seconds, a chapter record does not need millisecond precision
  time: number
  // Number of correct key presses, recorded once per letter typed correctly
  correctCount: number
  // Number of wrong key presses. An error clears the whole input but is only counted once
  wrongCount: number
  // Total number of words typed by the user, which can exceed 20 when features like word looping are used
  wordCount: number
  // List of words typed perfectly without mistakes, comparing it with wordNumber gives the indexes of the words that had errors
  correctWordIndexes: number[]
  // Total number of words in the chapter
  wordNumber: number
  // List of word record ids
  wordRecordIds: number[]
}

export class ChapterRecord implements IChapterRecord {
  dict: string
  chapter: number | null
  timeStamp: number
  time: number
  correctCount: number
  wrongCount: number
  wordCount: number
  correctWordIndexes: number[]
  wordNumber: number
  wordRecordIds: number[]

  constructor(
    dict: string,
    chapter: number | null,
    time: number,
    correctCount: number,
    wrongCount: number,
    wordCount: number,
    correctWordIndexes: number[],
    wordNumber: number,
    wordRecordIds: number[],
  ) {
    this.dict = dict
    this.chapter = chapter
    this.timeStamp = getUTCUnixTimestamp()
    this.time = time
    this.correctCount = correctCount
    this.wrongCount = wrongCount
    this.wordCount = wordCount
    this.correctWordIndexes = correctWordIndexes
    this.wordNumber = wordNumber
    this.wordRecordIds = wordRecordIds
  }

  get wpm() {
    return Math.round((this.wordCount / this.time) * 60)
  }

  get inputAccuracy() {
    return Math.round((this.correctCount / this.correctCount + this.wrongCount) * 100)
  }

  get wordAccuracy() {
    return Math.round((this.correctWordIndexes.length / this.wordNumber) * 100)
  }
}

export interface IReviewRecord {
  id?: number
  dict: string
  // Current practice progress
  index: number
  // Creation time
  createTime: number
  // Whether it has already been finished
  isFinished: boolean
  // Word list, generated and modified by the review algorithm, may contain duplicates
  words: Word[]
}

export class ReviewRecord implements IReviewRecord {
  id?: number
  dict: string
  index: number
  createTime: number
  isFinished: boolean
  words: Word[]

  constructor(dict: string, words: Word[]) {
    this.dict = dict
    this.index = 0
    this.createTime = getUTCUnixTimestamp()
    this.words = words
    this.isFinished = false
  }
}

export interface IRevisionDictRecord {
  dict: string
  revisionIndex: number
  createdTime: number
}

export class RevisionDictRecord implements IRevisionDictRecord {
  dict: string
  revisionIndex: number
  createdTime: number

  constructor(dict: string, revisionIndex: number, createdTime: number) {
    this.dict = dict
    this.revisionIndex = revisionIndex
    this.createdTime = createdTime
  }
}

export interface IRevisionWordRecord {
  word: string
  timeStamp: number
  dict: string
  errorCount: number
}

export class RevisionWordRecord implements IRevisionWordRecord {
  word: string
  timeStamp: number
  dict: string
  errorCount: number

  constructor(word: string, dict: string, errorCount: number) {
    this.word = word
    this.timeStamp = getUTCUnixTimestamp()
    this.dict = dict
    this.errorCount = errorCount
  }
}

export interface CustomDictRecord {
  // Bare id; the Dictionary id is `custom:<id>`
  id: string
  name: string
  description: string
  words: Word[]
  createdAt: number
  updatedAt: number
}

// Spaced-repetition state of one word in one dictionary (used by the study modes)
export interface ICardProgress {
  dict: string
  word: string
  state: 'learning' | 'review'
  // Next review time in ms since epoch
  due: number
  // Days
  interval: number
  ease: number
  reps: number
  lapses: number
  firstSeen: number
  lastReviewed: number
}

/** One graded flashcard or schedule-changing quiz answer; the source of the dashboard's weekly activity and streak. */
export interface IReviewLogEntry {
  id?: number
  // Epoch milliseconds
  at: number
  dict: string
  word: string
  kind: 'flashcard' | 'quiz'
}
