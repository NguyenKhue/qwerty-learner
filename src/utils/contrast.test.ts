import { contrastRatio, parseTokenBlock } from './contrast'
import { describe, expect, it } from 'vitest'

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBeCloseTo(1, 5)
  })
  it('does not depend on argument order', () => {
    expect(contrastRatio([79, 70, 229], [255, 255, 255])).toBeCloseTo(contrastRatio([255, 255, 255], [79, 70, 229]), 10)
  })
})

describe('parseTokenBlock', () => {
  const css = `@layer base { :root { --a: 1 2 3; --b-c: 255 0 10; } .dark { --a: 9 9 9; } } html.dark body { color: red; }`
  it('reads the triples of the requested block only', () => {
    expect(parseTokenBlock(css, ':root')).toEqual({ a: [1, 2, 3], 'b-c': [255, 0, 10] })
    expect(parseTokenBlock(css, '.dark')).toEqual({ a: [9, 9, 9] })
  })
  it('returns an empty object when the block is missing', () => {
    expect(parseTokenBlock(css, '.nope')).toEqual({})
  })
})
