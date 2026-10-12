import { describeSaveFailures } from './failures'
import { describe, expect, it } from 'vitest'

describe('describeSaveFailures', () => {
  it('is empty when nothing failed', () => {
    expect(describeSaveFailures([])).toBe('')
  })

  it('names the words that could not be saved, once each', () => {
    expect(describeSaveFailures(['apple'])).toBe('Could not save the schedule update for: apple.')
    expect(describeSaveFailures(['apple', 'pear', 'apple'])).toBe('Could not save the schedule update for: apple, pear.')
  })

  it('shortens a long list', () => {
    const words = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    expect(describeSaveFailures(words)).toBe('Could not save the schedule update for: a, b, c, d, e and 2 more.')
    expect(describeSaveFailures(words, 7)).toBe('Could not save the schedule update for: a, b, c, d, e, f, g.')
  })
})
