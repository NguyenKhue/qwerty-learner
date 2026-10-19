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

  it('finds a hyphenated or phrase headword with an inflected tail, and treats a space like a hyphen', () => {
    expect(findTarget('The team fine-tuned the model.', 'fine-tune')).toEqual({ start: 9, end: 19 })
    expect(findTarget('Logging is a cross-cutting concern.', 'cross cutting')).toEqual({ start: 13, end: 26 })
    expect(findTarget('The committee consists of five members.', 'consist of')).toEqual({ start: 14, end: 25 })
  })

  it('finds an inflection of a headword that ends in e or y by dropping that letter', () => {
    expect(findTarget('The design embodies trust.', 'embody')).toEqual({ start: 11, end: 19 })
    expect(findTarget('It is evolving fast.', 'evolve')).toEqual({ start: 6, end: 14 })
    expect(findTarget('Everything was justified later.', 'justify')).toEqual({ start: 15, end: 24 })
  })

  it('does not stem short headwords, phrases or a word that only contains the stem', () => {
    expect(findTarget('A typing test.', 'type')).toBeNull()
    expect(findTarget('Prevention helps.', 'prevent')).toEqual({ start: 0, end: 10 })
    expect(findTarget('Nothing to see.', 'a phrase')).toBeNull()
    expect(findTarget('The disembodies it.', 'embody')).toBeNull()
  })

  it('never throws for odd headwords', () => {
    for (const headword of ['-', ' - ', '++', '(', '[a', 'a--b', '\\'])
      expect(() => findTarget('Some (text) [a] a--b ++', headword)).not.toThrow()
  })
})
