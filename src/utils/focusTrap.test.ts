import { nextFocusIndex } from './focusTrap'
import { describe, expect, it } from 'vitest'

describe('nextFocusIndex', () => {
  it('moves forward and wraps from the last element to the first', () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1)
    expect(nextFocusIndex(2, 3, false)).toBe(0)
  })
  it('moves backward and wraps from the first element to the last', () => {
    expect(nextFocusIndex(2, 3, true)).toBe(1)
    expect(nextFocusIndex(0, 3, true)).toBe(2)
  })
  it('starts at an end when nothing inside is focused', () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0)
    expect(nextFocusIndex(-1, 3, true)).toBe(2)
  })
  it('returns -1 when there is nothing to focus', () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1)
  })
})
