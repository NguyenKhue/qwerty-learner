import type { TypingStateAction } from './index'
import { TypingStateActionType, initialState, typingReducer } from './index'
import type { TypingState } from './type'
import { produce } from 'immer'
import { describe, expect, it } from 'vitest'

// The reducer is written for use-immer: it changes its draft instead of returning a new state
const reduce = (state: TypingState, action: TypingStateAction): TypingState => produce(state, (draft) => typingReducer(draft, action))

const finished = () => ({ ...structuredClone(initialState), isFinished: true, isTyping: false })

describe('a finished chapter', () => {
  it('does not start typing again when a key is pressed on the result screen', () => {
    const next = reduce(finished(), { type: TypingStateActionType.SET_IS_TYPING, payload: true })
    expect(next.isTyping).toBe(false)
  })

  it('does not toggle into typing', () => {
    expect(reduce(finished(), { type: TypingStateActionType.TOGGLE_IS_TYPING }).isTyping).toBe(false)
  })

  it('keeps its chapter time when a tick still arrives', () => {
    const state = { ...finished(), timerData: { time: 194, accuracy: 93, wpm: 6 } }
    expect(reduce(state, { type: TypingStateActionType.TICK_TIMER }).timerData.time).toBe(194)
  })

  it('still lets an unfinished chapter start and tick', () => {
    const state = structuredClone(initialState)
    expect(reduce(state, { type: TypingStateActionType.SET_IS_TYPING, payload: true }).isTyping).toBe(true)
    expect(reduce(state, { type: TypingStateActionType.TICK_TIMER }).timerData.time).toBe(1)
  })

  it('stops the timer for good when the last word is finished', () => {
    const state = { ...structuredClone(initialState), isTyping: true }
    const done = reduce(state, { type: TypingStateActionType.FINISH_CHAPTER })
    expect(done.isTyping).toBe(false)
    expect(reduce(done, { type: TypingStateActionType.SET_IS_TYPING, payload: true }).isTyping).toBe(false)
  })
})
