import type { Tile } from './board'

export type GameState = {
  tiles: Tile[]
  selected: string | null
  /** Pair ids that have been matched */
  matched: string[]
  /** The two tiles of the last wrong guess, while they are being flashed */
  mismatch: [string, string] | null
  mistakes: number
  startedAt: number
  finishedAt: number | null
}

export function createGame(tiles: Tile[], now: number): GameState {
  return { tiles, selected: null, matched: [], mismatch: null, mistakes: 0, startedAt: now, finishedAt: null }
}

export function isFinished(state: GameState): boolean {
  return state.finishedAt !== null
}

export function isTileMatched(state: GameState, tile: Tile): boolean {
  return state.matched.indexOf(tile.pairId) !== -1
}

/** Milliseconds since the game started (frozen at the finish); never negative. */
export function elapsed(state: GameState, now: number): number {
  return Math.max(0, (state.finishedAt ?? now) - state.startedAt)
}

export function clearMismatch(state: GameState): GameState {
  return state.mismatch === null ? state : { ...state, mismatch: null }
}

function pairCount(state: GameState): number {
  return state.tiles.length / 2
}

/** Handles a click on a tile. Ignores clicks on unknown or matched tiles, on the already selected tile, and after the game finished. */
export function select(state: GameState, tileId: string, now: number): GameState {
  if (isFinished(state)) return state
  const tile = state.tiles.filter((t) => t.id === tileId)[0]
  if (!tile || isTileMatched(state, tile)) return state

  // A click while a wrong guess is flashing dismisses the flash and counts as the first click of a new guess
  const base: GameState = state.mismatch === null ? state : { ...state, mismatch: null, selected: null }
  if (base.selected === tile.id) return base

  const first = base.selected === null ? undefined : base.tiles.filter((t) => t.id === base.selected)[0]
  if (!first || first.kind === tile.kind) return { ...base, selected: tile.id }

  if (first.pairId === tile.pairId) {
    const matched = base.matched.concat(tile.pairId)
    return { ...base, selected: null, matched, finishedAt: matched.length === pairCount(base) ? now : null }
  }
  return { ...base, selected: null, mismatch: [first.id, tile.id], mistakes: base.mistakes + 1 }
}
