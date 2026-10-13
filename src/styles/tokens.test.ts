import { contrastRatio, parseTokenBlock } from '@/utils/contrast'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Vitest turns CSS imports into an empty string, so read the stylesheet from disk
const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')

const NAMES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'muted',
  'muted-foreground',
  'border',
  'ring',
  'primary',
  'primary-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
]
const TEXT_PAIRS: Array<[string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['primary', 'background'],
  ['primary', 'card'],
]
const UI_PAIRS: Array<[string, string]> = [
  ['ring', 'background'],
  ['ring', 'card'],
  // the switch knob (card) against its off track (muted-foreground)
  ['muted-foreground', 'card'],
]

for (const [mode, selector] of [
  ['light', ':root'],
  ['dark', '.dark'],
] as const) {
  describe(`${mode} tokens`, () => {
    const tokens = parseTokenBlock(css, selector)
    it('defines every token', () => {
      for (const name of NAMES) expect(tokens[name], name).toBeDefined()
    })
    it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
      expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5)
    })
    it.each(UI_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
      expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3)
    })
  })
}
