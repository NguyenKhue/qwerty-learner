import { PAIR_COUNT, buildBoard, canPlay } from './board'
import type { Word } from '@/typings'
import { meaningText } from '@/utils/quiz/questions'
import { describe, expect, it } from 'vitest'

const word = (name: string, ...trans: string[]): Word => ({ name, trans, usphone: '', ukphone: '' })
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const many = (n: number) => Array.from({ length: n }, (_, i) => word(`w${i}`, `meaning ${i}`))

describe('canPlay', () => {
  it('needs at least 6 distinct meanings among words that have one', () => {
    expect(canPlay(many(5))).toBe(false)
    expect(canPlay(many(6))).toBe(true)
    // 8 words but only 5 different meanings
    const repeated = [...many(5), word('x1', 'meaning 0'), word('x2', 'meaning 1'), word('x3', 'meaning 2')]
    expect(canPlay(repeated)).toBe(false)
    // words without a meaning do not count
    expect(canPlay([...many(5), word('none'), word('blank', '  ')])).toBe(false)
    expect(canPlay([])).toBe(false)
  })
})

describe('buildBoard', () => {
  it('returns no tiles when the set cannot be played', () => {
    expect(buildBoard({ words: many(5) })).toEqual([])
  })

  it('has 6 word tiles and 6 meaning tiles, each pair id used by exactly one of each', () => {
    const tiles = buildBoard({ words: many(20), rng: seeded(1) })
    expect(tiles).toHaveLength(PAIR_COUNT * 2)
    expect(tiles.filter((t) => t.kind === 'word')).toHaveLength(PAIR_COUNT)
    expect(tiles.filter((t) => t.kind === 'meaning')).toHaveLength(PAIR_COUNT)
    expect(new Set(tiles.map((t) => t.id)).size).toBe(PAIR_COUNT * 2)
    const pairIds = new Set(tiles.map((t) => t.pairId))
    expect(pairIds.size).toBe(PAIR_COUNT)
    pairIds.forEach((pairId) => {
      expect(
        tiles
          .filter((t) => t.pairId === pairId)
          .map((t) => t.kind)
          .sort(),
      ).toEqual(['meaning', 'word'])
    })
  })

  it('a meaning tile shows the meaning of the word of its pair', () => {
    const words = many(20)
    const tiles = buildBoard({ words, rng: seeded(2) })
    tiles
      .filter((t) => t.kind === 'word')
      .forEach((wordTile) => {
        const source = words.find((w) => w.name === wordTile.text)
        const meaningTile = tiles.find((t) => t.kind === 'meaning' && t.pairId === wordTile.pairId)
        expect(meaningTile?.text).toBe(source ? meaningText(source) : undefined)
      })
  })

  it('never puts two pairs with the same meaning on a board', () => {
    const words = [word('big', 'adj. lớn'), word('large', 'adj. lớn'), word('huge', 'adj. lớn'), ...many(8)]
    for (let seed = 1; seed <= 40; seed++) {
      const tiles = buildBoard({ words, rng: seeded(seed) })
      expect(tiles).toHaveLength(12)
      const meanings = tiles.filter((t) => t.kind === 'meaning').map((t) => t.text)
      expect(new Set(meanings).size).toBe(PAIR_COUNT)
    }
  })

  it('works with exactly 6 distinct meanings and ignores repeated names', () => {
    const words = [...many(6), word('w0', 'something else')]
    const tiles = buildBoard({ words, rng: seeded(3) })
    expect(tiles).toHaveLength(12)
    expect(
      tiles
        .filter((t) => t.kind === 'word')
        .map((t) => t.text)
        .sort(),
    ).toEqual(['w0', 'w1', 'w2', 'w3', 'w4', 'w5'])
  })

  it('shuffles the tiles, is reproducible for a seed and does not mutate its input', () => {
    const words = many(20)
    const before = JSON.stringify(words)
    const a = buildBoard({ words, rng: seeded(4) })
    const b = buildBoard({ words, rng: seeded(4) })
    expect(a).toEqual(b)
    expect(JSON.stringify(words)).toBe(before)
    const orders = new Set<string>()
    for (let seed = 1; seed <= 10; seed++)
      orders.add(
        buildBoard({ words, rng: seeded(seed) })
          .map((t) => t.id)
          .join(),
      )
    expect(orders.size).toBeGreaterThan(1)
  })
})
