import { rowIssues } from './issues'
import { describe, expect, it } from 'vitest'

const row = (name: string, trans: string, extra: Record<string, string> = {}) => ({ name, trans, usphone: '', ukphone: '', ...extra })

describe('rowIssues', () => {
  it('gives null for a complete row and for a completely blank row', () => {
    expect(rowIssues([row('a', 'adj. x'), row('', '')])).toEqual([null, null])
  })

  it('flags a word without a meaning and a meaning without a word', () => {
    const issues = rowIssues([row('a', ''), row('', 'adj. x'), row('', '', { usphone: 'ei' })])
    expect(issues[0]).toBe('Add at least one meaning')
    expect(issues[1]).toBe('Add the word')
    expect(issues[2]).toBe('Add the word')
  })

  it('treats a row with only spaces as blank', () => {
    expect(rowIssues([row('   ', ' \n ')])).toEqual([null])
  })

  it('flags later duplicates (same word ignoring case and surrounding spaces) and points to the first one', () => {
    const issues = rowIssues([row('Strict', 'adj. x'), row('other', 'adj. y'), row(' strict ', 'adj. z')])
    expect(issues[0]).toBeNull()
    expect(issues[1]).toBeNull()
    expect(issues[2]).toBe('Same word as row 1: the meanings will be merged')
  })

  it('reports the missing meaning before the duplicate warning', () => {
    expect(rowIssues([row('a', 'adj. x'), row('a', '')])[1]).toBe('Add at least one meaning')
  })

  it('treats examples as content when deciding whether a row is blank', () => {
    expect(rowIssues([row('', '', { examples: 'x | y' })])).toEqual(['Add the word'])
  })

  it('flags an example line with a translation but no sentence, with its line number', () => {
    expect(rowIssues([row('a', 'adj. x', { examples: ' | only trans' })])[0]).toBe('Example line 1 has no sentence before "|"')
    expect(rowIssues([row('a', 'adj. x', { examples: 'x | y\n | only trans' })])[0]).toBe('Example line 2 has no sentence before "|"')
  })

  it('gives null for a row with valid examples', () => {
    expect(rowIssues([row('a', 'adj. x', { examples: 'A b. | Một hai.\nC d.' })])).toEqual([null])
  })
})
