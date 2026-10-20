import { respell } from './respell'
import { describe, expect, it } from 'vitest'

describe('respell', () => {
  it('replaces a whole word case-insensitively and keeps a leading capital', () => {
    expect(respell('Disclamer - Loại từ. The disclamer is clear.', 'disclamer', 'disclaimer')).toBe(
      'Disclaimer - Loại từ. The disclaimer is clear.',
    )
  })

  it('does not touch a longer word that contains the misspelling', () => {
    expect(respell('disclamers and predisclamer', 'disclamer', 'disclaimer')).toBe('disclamers and predisclamer')
  })

  it('treats characters with a meaning in a regular expression as plain text', () => {
    expect(respell('a (b) and a (b).', '(b)', 'c')).toBe('a (b) and a (b).')
    expect(respell('c++ is not c', 'c+', 'cpp')).toBe('c++ is not c')
  })

  it('returns the text unchanged when the word is absent', () => {
    expect(respell('nothing here', 'widepread', 'widespread')).toBe('nothing here')
  })
})
