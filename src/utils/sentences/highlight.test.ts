import { findTarget } from './highlight'
import { describe, expect, it } from 'vitest'

describe('findTarget', () => {
  it('finds a whole word, case-insensitively', () => {
    expect(findTarget('Enable strict mode.', 'strict')).toEqual({ start: 7, end: 13 })
    expect(findTarget('Strict mode', 'STRICT')).toEqual({ start: 0, end: 6 })
  })

  it('falls back to the first word that starts with the headword', () => {
    expect(findTarget('The enforcement is on.', 'enforce')).toEqual({ start: 4, end: 15 })
  })

  it('prefers a whole-word match over an earlier prefix match', () => {
    expect(findTarget('enforcement and enforce it', 'enforce')).toEqual({ start: 16, end: 23 })
  })

  it('returns null when the headword is not a word of the text', () => {
    expect(findTarget('nothing here', 'strict')).toBeNull()
    expect(findTarget('unstrict', 'strict')).toBeNull()
  })

  it('handles headwords with regex characters without throwing', () => {
    expect(findTarget('Use C++ here', 'c++')).toEqual({ start: 4, end: 7 })
    expect(findTarget('a well-known fact', 'well-known')).toEqual({ start: 2, end: 12 })
    expect(findTarget('use (a) here', '(a)')).toEqual({ start: 4, end: 7 })
    expect(findTarget('Use e.g. here.', 'e.g.')).toEqual({ start: 4, end: 8 })
  })

  it('never throws and returns null for an empty headword', () => {
    for (const text of ['Enable strict mode.', 'Use C++ here', 'a well-known fact', 'use (a) here', '']) {
      expect(() => findTarget(text, '')).not.toThrow()
      expect(findTarget(text, '')).toBeNull()
    }
  })
})
