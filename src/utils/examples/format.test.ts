import { exampleLinesProblem, formatExamples, mergeExamples, normalizeExamples, parseExamples } from './format'
import { describe, expect, it } from 'vitest'

describe('parseExamples', () => {
  it('parses a sentence and its translation', () => {
    expect(parseExamples('A b. | Một hai.')).toEqual([{ text: 'A b.', trans: 'Một hai.' }])
  })

  it('keeps a line without a separator as a sentence without a translation', () => {
    const result = parseExamples('Only english')
    expect(result).toEqual([{ text: 'Only english' }])
    expect('trans' in result[0]).toBe(false)
  })

  it('splits on the first separator with whitespace, so code and pipes survive', () => {
    expect(parseExamples('if (a || b) run | Chạy')).toEqual([{ text: 'if (a || b) run', trans: 'Chạy' }])
    expect(parseExamples('x | y | z')).toEqual([{ text: 'x', trans: 'y | z' }])
  })

  it('drops blank lines and handles CRLF', () => {
    expect(parseExamples('A | Một\r\n\r\nB | Hai\r\n')).toEqual([
      { text: 'A', trans: 'Một' },
      { text: 'B', trans: 'Hai' },
    ])
  })

  it('drops a line that only has a translation', () => {
    expect(parseExamples(' | only trans')).toEqual([])
    expect(parseExamples('')).toEqual([])
  })
})

describe('formatExamples', () => {
  it('joins the examples into one line each', () => {
    expect(formatExamples([{ text: 'A', trans: 'B' }, { text: 'C' }])).toBe('A | B\nC')
    expect(formatExamples(undefined)).toBe('')
  })

  it('round trips through parseExamples', () => {
    const list = [{ text: 'if (a || b) run', trans: 'Chạy' }, { text: 'Only english' }, { text: 'x', trans: 'y | z' }]
    expect(parseExamples(formatExamples(list))).toEqual(list)
  })
})

describe('normalizeExamples', () => {
  it('returns an empty list for a non-array value', () => {
    expect(normalizeExamples('x')).toEqual([])
  })

  it('keeps only valid items, trimmed and deduplicated by text', () => {
    const value = [null, 5, {}, { text: 3 }, 'plain', { text: ' ok ', trans: ' t ' }, { text: 'ok' }]
    expect(normalizeExamples(value)).toEqual([{ text: 'plain' }, { text: 'ok', trans: 't' }])
  })
})

describe('mergeExamples', () => {
  it('returns undefined when both sides are missing', () => {
    expect(mergeExamples(undefined, undefined)).toBeUndefined()
  })

  it('keeps the order a then b and deduplicates by text', () => {
    const merged = mergeExamples([{ text: 'A', trans: 'One' }], [{ text: 'A', trans: 'Other' }, { text: 'B' }])
    expect(merged).toEqual([{ text: 'A', trans: 'One' }, { text: 'B' }])
  })

  it('returns undefined when the result is empty', () => {
    expect(mergeExamples([], [])).toBeUndefined()
  })
})

describe('exampleLinesProblem', () => {
  it('is null for valid text, blank text and a bare sentence', () => {
    expect(exampleLinesProblem('')).toBeNull()
    expect(exampleLinesProblem('A | B\nC\nif (a || b) x | y')).toBeNull()
  })

  it('names the first line that has a translation but no sentence, counting every line', () => {
    expect(exampleLinesProblem('A | B\n | only trans\n | again')).toBe('Example line 2 has no sentence before "|"')
    expect(exampleLinesProblem('A\n\n | x')).toBe('Example line 3 has no sentence before "|"')
    expect(exampleLinesProblem('A\r\n | x')).toBe('Example line 2 has no sentence before "|"')
  })
})

describe('a separator at the very start or end of a line', () => {
  it('treats a leading | as a missing sentence and a trailing | as a missing translation', () => {
    expect(parseExamples('| only trans')).toEqual([])
    expect(exampleLinesProblem('Fine.\n| only trans')).toBe('Example line 2 has no sentence before "|"')
    expect(parseExamples('Hello |')).toEqual([{ text: 'Hello' }])
    expect(parseExamples('if (a || b) go')).toEqual([{ text: 'if (a || b) go' }])
  })
})
