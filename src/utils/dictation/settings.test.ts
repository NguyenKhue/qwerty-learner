import { DICTATION_SPEEDS, sanitizeSpeed } from './settings'
import { describe, expect, it } from 'vitest'

describe('sanitizeSpeed', () => {
  it('keeps a speed the menu offers', () => {
    for (const speed of DICTATION_SPEEDS) expect(sanitizeSpeed(speed)).toBe(speed)
  })

  it('falls back to normal speed for anything else stored', () => {
    expect(sanitizeSpeed(3)).toBe(1)
    expect(sanitizeSpeed('fast')).toBe(1)
    expect(sanitizeSpeed(null)).toBe(1)
    expect(sanitizeSpeed(Number.NaN)).toBe(1)
  })
})
