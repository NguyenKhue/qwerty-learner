import type { LetterState } from './Letter'
import type { LetterMistakes } from '@/utils/db/record'

export type WordState = {
  displayWord: string
  inputWord: string
  letterStates: LetterState[]
  isFinished: boolean
  // Whether an input error has occurred
  hasWrong: boolean
  // Whether an input error has ever been recorded
  hasMadeInputWrong: boolean
  // Number of input errors made by the user
  wrongCount: number
  startTime: string
  endTime: string
  inputCount: number
  correctCount: number
  letterTimeArray: number[]
  letterMistake: LetterMistakes
  // Used by the random letter hiding feature
  randomLetterVisible: boolean[]
}

export const initialWordState: WordState = {
  displayWord: '',
  inputWord: '',
  letterStates: [],
  isFinished: false,
  hasWrong: false,
  hasMadeInputWrong: false,
  wrongCount: 0,
  startTime: '',
  endTime: '',
  inputCount: 0,
  correctCount: 0,
  letterTimeArray: [],
  letterMistake: {},
  randomLetterVisible: [],
}
