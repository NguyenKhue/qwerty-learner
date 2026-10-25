import { segmentWindow, shouldStop } from './segment'
import { describe, expect, it } from 'vitest'

describe('segmentWindow', () => {
  it('adds 0.3 s before and after a sentence, never before the start of the video', () => {
    expect(segmentWindow(0.1, 2)).toEqual({ from: 0, to: 2.3 })
    expect(segmentWindow(10, 12)).toEqual({ from: 9.7, to: 12.3 })
  })
})

describe('shouldStop', () => {
  it('stops once the player reaches the end of the window', () => {
    expect(shouldStop(12.29, 12.3)).toBe(false)
    expect(shouldStop(12.3, 12.3)).toBe(true)
    expect(shouldStop(13, 12.3)).toBe(true)
  })
})
