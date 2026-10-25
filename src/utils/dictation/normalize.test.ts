import { dictationText } from './normalize'
import { describe, expect, it } from 'vitest'

describe('dictationText', () => {
  it('keeps only lowercase letters, digits, spaces and the apostrophe of a contraction', () => {
    expect(dictationText("Don't stop, it's 3.5!")).toBe("don't stop it's 3 5")
    expect(dictationText('well-known')).toBe('well known')
    expect(dictationText('The U.S. economy')).toBe('the u s economy')
  })

  it('treats curly quotes and dashes as keyboard characters', () => {
    expect(dictationText('It’s “fine” — really…')).toBe("it's fine really")
  })

  it('drops an apostrophe that is only a quote mark', () => {
    expect(dictationText("He said 'hello' to them")).toBe('he said hello to them')
  })

  it('refuses a sentence that cannot be typed or has nothing to type', () => {
    expect(dictationText('Café')).toBeNull()
    expect(dictationText('   ')).toBeNull()
    expect(dictationText('!!!')).toBeNull()
    expect(dictationText('a'.repeat(201))).toBeNull()
  })
})
