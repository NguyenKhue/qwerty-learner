import type { Tile } from './board'
import { clearMismatch, createGame, elapsed, isFinished, isTileMatched, select } from './game'
import { describe, expect, it } from 'vitest'

const T0 = 1_000_000
// Two pairs are enough to exercise every rule
const tiles: Tile[] = [
  { id: 'a-word', pairId: 'a', kind: 'word', text: 'apple' },
  { id: 'b-word', pairId: 'b', kind: 'word', text: 'pear' },
  { id: 'a-meaning', pairId: 'a', kind: 'meaning', text: 'quả táo' },
  { id: 'b-meaning', pairId: 'b', kind: 'meaning', text: 'quả lê' },
]
const start = () => createGame(tiles, T0)

describe('selection and matching', () => {
  it('starts with nothing selected, matched or finished', () => {
    expect(start()).toMatchObject({ selected: null, matched: [], mismatch: null, mistakes: 0, startedAt: T0, finishedAt: null })
  })

  it('the first click selects a tile', () => {
    expect(select(start(), 'a-word', T0 + 10).selected).toBe('a-word')
  })

  it('clicking the other kind of the same pair matches and clears the selection', () => {
    const s = select(select(start(), 'a-word', T0 + 1), 'a-meaning', T0 + 2)
    expect(s.matched).toEqual(['a'])
    expect(s.selected).toBeNull()
    expect(s.mistakes).toBe(0)
    expect(isTileMatched(s, tiles[0])).toBe(true)
    expect(isTileMatched(s, tiles[1])).toBe(false)
  })

  it('works in either order (meaning first, then word)', () => {
    const s = select(select(start(), 'b-meaning', T0 + 1), 'b-word', T0 + 2)
    expect(s.matched).toEqual(['b'])
  })

  it('the other kind of a different pair is a mismatch: mistake counted, both tiles flagged, selection cleared', () => {
    const s = select(select(start(), 'a-word', T0 + 1), 'b-meaning', T0 + 2)
    expect(s.matched).toEqual([])
    expect(s.mismatch).toEqual(['a-word', 'b-meaning'])
    expect(s.mistakes).toBe(1)
    expect(s.selected).toBeNull()
  })

  it('a second tile of the same kind only moves the selection, without a penalty', () => {
    const s = select(select(start(), 'a-word', T0 + 1), 'b-word', T0 + 2)
    expect(s.selected).toBe('b-word')
    expect(s.mistakes).toBe(0)
    expect(s.mismatch).toBeNull()
  })

  it('a click while a mismatch is showing dismisses it and starts a new selection', () => {
    const mismatched = select(select(start(), 'a-word', T0 + 1), 'b-meaning', T0 + 2)
    const s = select(mismatched, 'a-meaning', T0 + 3)
    expect(s.mismatch).toBeNull()
    expect(s.selected).toBe('a-meaning')
    expect(s.mistakes).toBe(1)
  })

  it('clearMismatch removes the flag and is a no-op without one', () => {
    const mismatched = select(select(start(), 'a-word', T0 + 1), 'b-meaning', T0 + 2)
    expect(clearMismatch(mismatched).mismatch).toBeNull()
    const fresh = start()
    expect(clearMismatch(fresh)).toBe(fresh)
  })
})

describe('clicks that must do nothing', () => {
  it('clicking the selected tile again (double click) does not match it with itself or change anything', () => {
    const selected = select(start(), 'a-word', T0 + 1)
    expect(select(selected, 'a-word', T0 + 2)).toBe(selected)
  })

  it('clicking a matched tile is ignored', () => {
    const matched = select(select(start(), 'a-word', T0 + 1), 'a-meaning', T0 + 2)
    expect(select(matched, 'a-word', T0 + 3)).toBe(matched)
    expect(select(matched, 'a-meaning', T0 + 3)).toBe(matched)
  })

  it('an unknown tile id is ignored', () => {
    const s = start()
    expect(select(s, 'nope', T0 + 1)).toBe(s)
  })

  it('nothing changes after the game is finished', () => {
    let s = select(select(start(), 'a-word', T0 + 1), 'a-meaning', T0 + 2)
    s = select(select(s, 'b-word', T0 + 3), 'b-meaning', T0 + 4)
    expect(isFinished(s)).toBe(true)
    expect(select(s, 'a-word', T0 + 5)).toBe(s)
  })
})

describe('finish and elapsed time', () => {
  it('matching the last pair records the finish time', () => {
    let s = select(select(start(), 'a-word', T0 + 100), 'a-meaning', T0 + 200)
    expect(isFinished(s)).toBe(false)
    s = select(select(s, 'b-word', T0 + 300), 'b-meaning', T0 + 1234)
    expect(isFinished(s)).toBe(true)
    expect(s.finishedAt).toBe(T0 + 1234)
  })

  it('elapsed runs from the start while playing and freezes at the finish', () => {
    const s = start()
    expect(elapsed(s, T0 + 5000)).toBe(5000)
    let done = select(select(s, 'a-word', T0 + 1), 'a-meaning', T0 + 2)
    done = select(select(done, 'b-word', T0 + 3), 'b-meaning', T0 + 4000)
    expect(elapsed(done, T0 + 999999)).toBe(4000)
  })

  it('a clock that went backwards counts as zero', () => {
    expect(elapsed(start(), T0 - 5000)).toBe(0)
  })

  it('does not mutate the previous state', () => {
    const s = start()
    const before = JSON.stringify(s)
    select(s, 'a-word', T0 + 1)
    expect(JSON.stringify(s)).toBe(before)
  })
})
