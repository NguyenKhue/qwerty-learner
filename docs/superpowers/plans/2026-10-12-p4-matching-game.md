# P4 — Matching Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A matching game for any custom set: 12 tiles (6 words and their 6 meanings) are shown shuffled, the player selects a word and a meaning to match them, matched pairs disappear, a timer runs, and the best time per set is remembered.

**Architecture:** Pure, unit-tested modules do all the work: board generation (which 6 pairs, shuffled, no two pairs with the same meaning), a game reducer (selection, match, mismatch, finish, elapsed time) and best-time helpers (sanitising, comparing, formatting, storage with failure tolerance). A thin React page (`/match/:dictId`: intro → board → result) renders them. The game does **not** touch the spaced-repetition schedule and stores nothing in IndexedDB (spec).

**Tech Stack:** React 18, TypeScript (target es5, strict), react-router 6, SWR, Vitest 0.34 (jsdom), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-12-study-modes-design.md` (section "P4 — Matching game"; it builds on P1).

## Global Constraints

Copied from the spec; every task implicitly includes them.

- Personal use only: everything in the browser, no backend, no accounts.
- Route `/match/:dictId`.
- **6 word/meaning pairs** on a grid; select two to match; **matched pairs disappear**; **timer runs**.
- **Best time per set stored in `localStorage`** (not IndexedDB, not in the SRS): the game never reads or writes `cardProgress`.
- **Needs ≥ 6 words** (made precise in Decision 1).
- Out of scope: leaderboards, sharing, difficulty levels, sounds, mobile layout, editing sets.
- Code style: Prettier (no semicolons, single quotes, width 140, import-sorting plugin) — run `npx prettier --write <files>` before every commit. TypeScript target is `es5`: no spreading/iterating `Map`/`Set` iterators and no `flatMap` (use `Array.from`, `forEach`, `reduce`/`concat`).
- Branch: `feat/study-modes` (P1–P3 are already committed on it).

## Decisions made while planning (fill gaps in the spec)

1. **"≥ 6 words" is made precise:** the game is available when the set has at least **6 distinct meanings** among its words that have a meaning. Two words with the same meaning would make a pair ambiguous, so a board never contains two pairs with the same meaning text.
2. **Tiles:** a word tile shows the word, a meaning tile shows all of the word's meanings joined with `; ` (same as the quiz). Words come from `quizWords` (de-duplicated by name, meaningless words dropped).
3. **Selection rules:** first click selects a tile; a second click on a tile of the **same kind** (word + word / meaning + meaning) just moves the selection (no penalty); a second click on the **other kind** is a match if both tiles belong to the same pair, otherwise a mismatch (mistake counted, both tiles flash red, then clear after 0.7 s or on the next click). Clicking the selected tile again, a matched tile or an unknown tile does nothing.
4. **Timer:** starts when the board is shown, is computed from timestamps (`now - startedAt`, so a throttled background tab does not lose time) and stops when the last pair is matched. A clock that goes backwards counts as 0.
5. **Best time:** milliseconds, stored under `matchBest:<dictionary id>` in `localStorage`. A new best is a strictly smaller time; garbage values in storage are ignored; if `localStorage` is unavailable or throws (private mode), the game still works and just does not remember.
6. **Matched tiles** are rendered invisible and disabled (not removed) so the grid layout does not jump.
7. **Entry points** for custom sets only (as for Study and Quiz): a "Match" button in `/my-sets` and a "Match" link in the typing page's dictionary menu. The route works for any dictionary id.
8. **No Playwright test** (the project's e2e config targets the production site). Verification = Vitest for all logic + a manual browser pass (Task 5).

## Review Focus

Inputs/conditions the spec implies but does not spell out, most likely to bite first. Each has a test in the owning task.

1. **Ambiguous pairs:** two chosen words with the same meaning would make a correct pairing look wrong — a board never contains them; a set with only 5 distinct meanings is "unavailable" — Task 1.
2. **Rapid or odd clicking:** double-click on one tile (must not "match itself"), click on a matched tile, a click while a mismatch is showing, a click after the game finished — Task 2.
3. **Best-time storage:** garbage in storage (`'abc'`, negative, `NaN`, objects), a storage that throws on read or write, equal time is not a new best — Task 3.
4. **Timer:** elapsed is the difference of timestamps, never negative, frozen at the finish — Task 2; display formatting of 0, sub-minute and over-ten-minute times — Task 3.
5. **Odd data:** exactly 6 distinct meanings, duplicate names, words without meaning, very long meanings (layout scrolls instead of overflowing) — Tasks 1 and 4.

## File Structure

Create:

- `src/utils/match/board.ts` (+ `board.test.ts`) — `PAIR_COUNT`, `canPlay`, `buildBoard`, types `Tile`/`TileKind`.
- `src/utils/match/game.ts` (+ `game.test.ts`) — game reducer.
- `src/utils/match/best.ts` (+ `best.test.ts`) — best-time helpers and `formatDuration`.
- `src/pages/Match/index.tsx` (route + intro), `src/pages/Match/MatchBoard.tsx` (board, timer, result).

Modify:

- `src/utils/quiz/questions.ts` — export `shuffle`.
- `src/index.tsx` — route `/match/:dictId`.
- `src/pages/MySets/index.tsx` — "Match" button.
- `src/pages/Typing/components/DictChapterButton/index.tsx` — "Match" link for custom sets.

---

### Task 1: Board generation (`board.ts`)

**Files:**

- Create: `src/utils/match/board.ts`
- Modify: `src/utils/quiz/questions.ts` (export `shuffle`)
- Test: `src/utils/match/board.test.ts`

**Interfaces:**

- Consumes: `Word` from `@/typings`; `quizWords`, `meaningText`, `distinctMeaningCount`, `shuffle` from `@/utils/quiz/questions`.
- Produces:

  - `PAIR_COUNT = 6`
  - `type TileKind = 'word' | 'meaning'`
  - `type Tile = { id: string; pairId: string; kind: TileKind; text: string }`
  - `canPlay(words: Word[]): boolean`
  - `buildBoard(input: { words: Word[]; rng?: () => number }): Tile[]` — 12 shuffled tiles, or `[]` when `canPlay` is false.

- [ ] **Step 1: Export `shuffle`**

In `src/utils/quiz/questions.ts` change `function shuffle<T>(items: T[], rng: () => number): T[] {` to `export function shuffle<T>(items: T[], rng: () => number): T[] {`. No other change.

- [ ] **Step 2: Write the failing tests**

Create `src/utils/match/board.test.ts`:

```ts
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
```

- [ ] **Step 3: Run to verify it fails**

Run: `yarn test src/utils/match/board.test.ts`
Expected: FAIL — cannot find module `./board`.

- [ ] **Step 4: Implement `board.ts`**

Create `src/utils/match/board.ts`:

```ts
import type { Word } from '@/typings'
import { distinctMeaningCount, meaningText, quizWords, shuffle } from '@/utils/quiz/questions'

export const PAIR_COUNT = 6

export type TileKind = 'word' | 'meaning'
export type Tile = { id: string; pairId: string; kind: TileKind; text: string }

/** A set can be played when it has at least 6 distinct meanings (so no two pairs on a board share a meaning). */
export function canPlay(words: Word[]): boolean {
  return distinctMeaningCount(words) >= PAIR_COUNT
}

/** 6 random word/meaning pairs as 12 shuffled tiles. Empty when the set cannot be played. */
export function buildBoard(input: { words: Word[]; rng?: () => number }): Tile[] {
  const rng = input.rng ?? Math.random
  const seenMeanings = new Set<string>()
  const chosen: Word[] = []
  const pool = shuffle(quizWords(input.words), rng)
  for (let i = 0; i < pool.length && chosen.length < PAIR_COUNT; i++) {
    const meaning = meaningText(pool[i])
    // Two chosen words with the same meaning would make a correct pairing look wrong
    if (seenMeanings.has(meaning)) continue
    seenMeanings.add(meaning)
    chosen.push(pool[i])
  }
  if (chosen.length < PAIR_COUNT) return []

  const tiles = chosen.reduce<Tile[]>((all, word, index) => {
    const pairId = `p${index}`
    return all.concat(
      { id: `${pairId}-word`, pairId, kind: 'word', text: word.name },
      { id: `${pairId}-meaning`, pairId, kind: 'meaning', text: meaningText(word) },
    )
  }, [])
  return shuffle(tiles, rng)
}
```

- [ ] **Step 5: Run the tests**

Run: `yarn test src/utils/match src/utils/quiz`
Expected: all PASS (the quiz tests prove exporting `shuffle` changed nothing).

- [ ] **Step 6: Lint, type-check, commit**

Run: `npx eslint src/utils && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: no eslint errors; tsc count `4` (the four pre-existing errors).

```bash
npx prettier --write src/utils/match src/utils/quiz/questions.ts
git add src/utils/match src/utils/quiz/questions.ts
git commit -m "feat: add matching game board generation"
```

(The pre-commit hook runs eslint/prettier; if it fails the commit did not happen — fix and commit again before continuing.)

---

### Task 2: Game reducer (`game.ts`)

**Files:**

- Create: `src/utils/match/game.ts`
- Test: `src/utils/match/game.test.ts`

**Interfaces:**

- Consumes: `Tile` (Task 1).
- Produces:

  - `type GameState = { tiles: Tile[]; selected: string | null; matched: string[]; mismatch: [string, string] | null; mistakes: number; startedAt: number; finishedAt: number | null }` (`matched` holds pair ids)
  - `createGame(tiles: Tile[], now: number): GameState`
  - `select(state, tileId: string, now: number): GameState`
  - `clearMismatch(state): GameState`
  - `isFinished(state): boolean`
  - `isTileMatched(state, tile: Tile): boolean`
  - `elapsed(state, now: number): number` (milliseconds, never negative)

- [ ] **Step 1: Write the failing tests**

Create `src/utils/match/game.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/utils/match/game.test.ts`
Expected: FAIL — cannot find module `./game`.

- [ ] **Step 3: Implement `game.ts`**

Create `src/utils/match/game.ts`:

```ts
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
```

- [ ] **Step 4: Run all tests, lint, type-check, commit**

Run: `yarn test && npx eslint src/utils && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: all tests PASS; no eslint errors; tsc count `4`.

```bash
npx prettier --write src/utils/match
git add src/utils/match
git commit -m "feat: add matching game reducer"
```

---

### Task 3: Best time and duration formatting (`best.ts`)

**Files:**

- Create: `src/utils/match/best.ts`
- Test: `src/utils/match/best.test.ts`

**Interfaces:**

- Produces:

  - `BEST_KEY_PREFIX = 'matchBest:'`
  - `type BestStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }`
  - `sanitizeBest(value: unknown): number | null` (a positive finite number of ms, else null)
  - `updateBest(previous: number | null, elapsedMs: number): { best: number | null; isNewBest: boolean }`
  - `readBest(dictId: string, storage?: BestStorage): number | null`
  - `writeBest(dictId: string, ms: number, storage?: BestStorage): boolean`
  - `formatDuration(ms: number): string` (`m:ss.t`, e.g. `1:05.4`)

- [ ] **Step 1: Write the failing tests**

Create `src/utils/match/best.test.ts`:

```ts
import { BEST_KEY_PREFIX, formatDuration, readBest, sanitizeBest, updateBest, writeBest } from './best'
import type { BestStorage } from './best'
import { afterEach, describe, expect, it } from 'vitest'

const memoryStorage = (initial: Record<string, string> = {}): BestStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }
}
const throwingStorage: BestStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('sanitizeBest', () => {
  it('accepts a positive finite number, also as a numeric string', () => {
    expect(sanitizeBest(4200)).toBe(4200)
    expect(sanitizeBest('4200')).toBe(4200)
  })

  it('rejects everything else', () => {
    for (const bad of ['abc', '', '  ', 0, -5, NaN, Infinity, null, undefined, {}, [], true]) expect(sanitizeBest(bad)).toBeNull()
  })
})

describe('updateBest', () => {
  it('the first time is a new best', () => {
    expect(updateBest(null, 5000)).toEqual({ best: 5000, isNewBest: true })
  })

  it('only a strictly smaller time is a new best', () => {
    expect(updateBest(5000, 4000)).toEqual({ best: 4000, isNewBest: true })
    expect(updateBest(5000, 5000)).toEqual({ best: 5000, isNewBest: false })
    expect(updateBest(5000, 6000)).toEqual({ best: 5000, isNewBest: false })
  })

  it('rounds to whole milliseconds and never records less than 1 ms', () => {
    expect(updateBest(null, 1234.6)).toEqual({ best: 1235, isNewBest: true })
    expect(updateBest(null, 0)).toEqual({ best: 1, isNewBest: true })
  })

  it('ignores a time that is not a number', () => {
    expect(updateBest(5000, NaN)).toEqual({ best: 5000, isNewBest: false })
    expect(updateBest(null, Infinity)).toEqual({ best: null, isNewBest: false })
  })
})

describe('readBest / writeBest', () => {
  it('round-trips through a storage, per dictionary', () => {
    const storage = memoryStorage()
    expect(readBest('custom:a', storage)).toBeNull()
    expect(writeBest('custom:a', 4200, storage)).toBe(true)
    expect(storage.data[`${BEST_KEY_PREFIX}custom:a`]).toBe('4200')
    expect(readBest('custom:a', storage)).toBe(4200)
    expect(readBest('custom:b', storage)).toBeNull()
  })

  it('ignores garbage stored under the key', () => {
    expect(readBest('custom:a', memoryStorage({ [`${BEST_KEY_PREFIX}custom:a`]: 'abc' }))).toBeNull()
    expect(readBest('custom:a', memoryStorage({ [`${BEST_KEY_PREFIX}custom:a`]: '-5' }))).toBeNull()
  })

  it('does not throw when the storage is blocked', () => {
    expect(readBest('custom:a', throwingStorage)).toBeNull()
    expect(writeBest('custom:a', 4200, throwingStorage)).toBe(false)
  })
})

describe('default storage (localStorage)', () => {
  afterEach(() => localStorage.clear())

  it('uses localStorage when no storage is given', () => {
    expect(writeBest('custom:z', 3100)).toBe(true)
    expect(localStorage.getItem(`${BEST_KEY_PREFIX}custom:z`)).toBe('3100')
    expect(readBest('custom:z')).toBe(3100)
  })
})

describe('formatDuration', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatDuration(0)).toBe('0:00.0')
    expect(formatDuration(5400)).toBe('0:05.4')
    expect(formatDuration(59999)).toBe('0:59.9')
    expect(formatDuration(65400)).toBe('1:05.4')
    expect(formatDuration(600000)).toBe('10:00.0')
  })

  it('shows zero for a negative or non-numeric duration', () => {
    expect(formatDuration(-1)).toBe('0:00.0')
    expect(formatDuration(NaN)).toBe('0:00.0')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/utils/match/best.test.ts`
Expected: FAIL — cannot find module `./best`.

- [ ] **Step 3: Implement `best.ts`**

Create `src/utils/match/best.ts`:

```ts
export const BEST_KEY_PREFIX = 'matchBest:'

export type BestStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** localStorage, or undefined when it is not available (reading the property itself can throw in private mode). */
function defaultStorage(): BestStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/** A stored best time: a positive finite number of milliseconds, otherwise null. */
export function sanitizeBest(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

/** Compares a finished game's time with the previous best. Only a strictly smaller time is a new best. */
export function updateBest(previous: number | null, elapsedMs: number): { best: number | null; isNewBest: boolean } {
  if (!Number.isFinite(elapsedMs)) return { best: previous, isNewBest: false }
  const time = Math.max(1, Math.round(elapsedMs))
  if (previous === null || time < previous) return { best: time, isNewBest: true }
  return { best: previous, isNewBest: false }
}

export function readBest(dictId: string, storage: BestStorage | undefined = defaultStorage()): number | null {
  try {
    return sanitizeBest(storage?.getItem(BEST_KEY_PREFIX + dictId))
  } catch {
    return null
  }
}

/** Returns false when the best time could not be stored (storage missing or blocked); the game works without it. */
export function writeBest(dictId: string, ms: number, storage: BestStorage | undefined = defaultStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(BEST_KEY_PREFIX + dictId, String(ms))
    return true
  } catch {
    return false
  }
}

/** `m:ss.t`, for example 65400 → `1:05.4`. A negative or non-numeric duration shows as zero. */
export function formatDuration(ms: number): string {
  const tenths = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 100) : 0
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${tenths % 10}`
}
```

- [ ] **Step 4: Run all tests, lint, type-check, commit**

Run: `yarn test && npx eslint src/utils && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: all tests PASS; no eslint errors; tsc count `4`.

```bash
npx prettier --write src/utils/match
git add src/utils/match
git commit -m "feat: add best-time storage and duration formatting for the matching game"
```

---

### Task 4: Match page (intro, board, result, route)

**Files:**

- Create: `src/pages/Match/index.tsx`, `src/pages/Match/MatchBoard.tsx`
- Modify: `src/index.tsx`

**Interfaces:**

- Consumes: `canPlay`, `buildBoard`, `Tile` (Task 1); `createGame`, `select`, `clearMismatch`, `isFinished`, `isTileMatched`, `elapsed`, `GameState` (Task 2); `readBest`, `writeBest`, `updateBest`, `formatDuration` (Task 3); `useDictionaryWords` (P3); `Layout`, `ScrollCenter`, `Button`.
- Produces: route `/match/:dictId`.

This task is UI; there is no unit test for the components (all logic they call is covered in Tasks 1–3). It is verified by type-check, lint, the existing suite and the manual pass in Task 5.

- [ ] **Step 1: Board, timer and result screen**

Create `src/pages/Match/MatchBoard.tsx`:

```tsx
import Layout from '@/components/Layout'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { formatDuration, readBest, updateBest, writeBest } from '@/utils/match/best'
import type { Tile } from '@/utils/match/board'
import { clearMismatch, createGame, elapsed, isFinished, isTileMatched, select } from '@/utils/match/game'
import type { GameState } from '@/utils/match/game'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  dictId: string
  tiles: Tile[]
  onBestChange: (best: number | null) => void
  onRestart: () => void
  onBack: () => void
}

const MISMATCH_FLASH_MS = 700

export default function MatchBoard({ dictId, tiles, onBestChange, onRestart, onBack }: Props) {
  const [game, setGame] = useState(() => createGame(tiles, Date.now()))
  // Handlers read this ref (updated synchronously) so two clicks in the same tick are both applied in order
  const gameRef = useRef(game)
  const update = useCallback((next: GameState) => {
    gameRef.current = next
    setGame(next)
  }, [])
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<{ time: number; best: number | null; isNewBest: boolean } | null>(null)
  const saved = useRef(false)

  const finished = isFinished(game)

  // The clock: computed from timestamps, so a throttled background tab does not lose time
  useEffect(() => {
    if (finished) return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [finished])

  // A wrong guess is flashed for a moment and then cleared (a click clears it sooner)
  useEffect(() => {
    if (!game.mismatch) return
    const timer = window.setTimeout(() => update(clearMismatch(gameRef.current)), MISMATCH_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [game.mismatch, update])

  // Record the best time once, when the last pair is matched
  useEffect(() => {
    if (!finished || saved.current) return
    saved.current = true
    const time = elapsed(game, Date.now())
    const { best, isNewBest } = updateBest(readBest(dictId), time)
    if (isNewBest && best !== null) {
      writeBest(dictId, best)
      onBestChange(best)
    }
    setResult({ time, best, isNewBest })
  }, [finished, game, dictId, onBestChange])

  const onTile = (tileId: string) => update(select(gameRef.current, tileId, Date.now()))

  if (finished && result) {
    return (
      <Layout>
        <ScrollCenter className="max-w-xl gap-6">
          <div className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm text-gray-500">All pairs matched</p>
            <p className="text-4xl font-medium text-gray-800 dark:text-gray-100">{formatDuration(result.time)}</p>
            <p className="mt-2 text-sm text-gray-500">
              {game.mistakes} {game.mistakes === 1 ? 'mistake' : 'mistakes'}
              {result.best !== null && ` · best ${formatDuration(result.best)}`}
            </p>
            {result.isNewBest && <p className="mt-2 text-emerald-600">New best time!</p>}
          </div>
          <div className="flex gap-3">
            <Button onClick={onRestart}>Play again</Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </ScrollCenter>
      </Layout>
    )
  }

  return (
    <Layout>
      <ScrollCenter className="max-w-4xl gap-6">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            {formatDuration(elapsed(game, now))} · {game.matched.length} / {game.tiles.length / 2} matched · {game.mistakes}{' '}
            {game.mistakes === 1 ? 'mistake' : 'mistakes'}
          </span>
          <Button size="sm" variant="outline" onClick={onBack}>
            Exit
          </Button>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
          {game.tiles.map((tile) => {
            const matched = isTileMatched(game, tile)
            const selected = game.selected === tile.id
            const wrong = game.mismatch !== null && game.mismatch.indexOf(tile.id) !== -1
            const style = wrong
              ? 'bg-red-500 text-white'
              : selected
              ? 'bg-indigo-500 text-white'
              : 'bg-white text-gray-800 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
            return (
              <button
                key={tile.id}
                disabled={matched}
                aria-hidden={matched}
                aria-pressed={selected}
                onClick={() => onTile(tile.id)}
                // Matched tiles stay in the grid (invisible) so the layout does not jump
                className={`min-h-[4.5rem] rounded-lg px-4 py-3 text-center shadow transition-colors ${
                  tile.kind === 'word' ? 'text-xl font-medium' : 'text-base'
                } ${style} ${matched ? 'invisible' : ''}`}
              >
                {tile.text}
              </button>
            )
          })}
        </div>
      </ScrollCenter>
    </Layout>
  )
}
```

- [ ] **Step 2: Route container with the intro screen**

Create `src/pages/Match/index.tsx`:

```tsx
import MatchBoard from './MatchBoard'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { formatDuration, readBest } from '@/utils/match/best'
import { buildBoard, canPlay } from '@/utils/match/board'
import type { Tile } from '@/utils/match/board'
import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

// Keyed by id so moving between two sets in place starts from a clean state
export default function MatchRoute() {
  const { dictId = '' } = useParams()
  return <Match key={dictId} id={dictId} />
}

function Match({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { dict, words, error } = useDictionaryWords(id)
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  // Bumped on every start so MatchBoard remounts with a fresh game ("Play again")
  const [round, setRound] = useState(0)
  const [best, setBest] = useState<number | null>(() => readBest(id))

  const playable = useMemo(() => (words ? canPlay(words) : false), [words])

  // `default` is the key of the first history entry: there is nothing to go back to, so fall back to the sets page
  const onBack = useCallback(() => (location.key === 'default' ? navigate('/my-sets') : navigate(-1)), [location.key, navigate])

  const start = useCallback(() => {
    if (!words) return
    const board = buildBoard({ words })
    if (board.length === 0) return
    setRound((r) => r + 1)
    setTiles(board)
  }, [words])

  const message = (text: string, tone = 'text-gray-500') => (
    <Layout>
      <p className={`m-auto ${tone}`}>{text}</p>
    </Layout>
  )

  if (!dict) return message('Loading…')
  if (error && !words) return message('Could not load the words of this set.', 'text-red-600')
  if (!words) return message('Loading…')

  if (tiles) {
    return <MatchBoard key={round} dictId={id} tiles={tiles} onBestChange={setBest} onRestart={start} onBack={() => setTiles(null)} />
  }

  return (
    <Layout>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{dict.name}</h1>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
        {playable ? (
          <div className="space-y-4 rounded-lg bg-white p-6 text-gray-700 shadow dark:bg-gray-800 dark:text-gray-300">
            <p>Match 6 words with their meanings as fast as you can.</p>
            {best !== null && <p className="text-sm text-gray-500">Best time: {formatDuration(best)}</p>}
            <Button onClick={start}>Start</Button>
          </div>
        ) : (
          <p className="rounded-lg bg-white p-6 text-gray-600 shadow dark:bg-gray-800 dark:text-gray-300">
            This set cannot be played yet: it needs at least 6 words with different meanings.
          </p>
        )}
      </div>
    </Layout>
  )
}
```

- [ ] **Step 3: Add the route**

In `src/index.tsx` add below the other lazy pages:

```tsx
const MatchPage = lazy(() => import('./pages/Match'))
```

and inside the non-mobile routes, after the `/quiz/:dictId` route:

```tsx
<Route path="/match/:dictId" element={<MatchPage />} />
```

- [ ] **Step 4: Verify**

Run: `npx prettier --write src/pages/Match src/index.tsx && npx eslint . && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn test`
Expected: no eslint errors; tsc count `4`; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Match src/index.tsx
git commit -m "feat: add matching game page"
```

---

### Task 5: Entry points and end-to-end verification

**Files:**

- Modify: `src/pages/MySets/index.tsx`, `src/pages/Typing/components/DictChapterButton/index.tsx`

**Interfaces:**

- Consumes: route `/match/:dictId` (Task 4); `isCustomDictId` from `@/utils/db/custom-dict` (P1).
- Produces: user-visible buttons only.

- [ ] **Step 1: "Match" button in `/my-sets`**

In `src/pages/MySets/index.tsx`, inside each set's button group, add right after the existing Quiz button:

```tsx
<Button size="sm" onClick={() => navigate(`/match/${encodeURIComponent(dict.id)}`)}>
  Match
</Button>
```

- [ ] **Step 2: "Match" link in the typing page's dictionary menu**

In `src/pages/Typing/components/DictChapterButton/index.tsx`, directly after the existing "Take a multiple-choice quiz" `Tooltip` block (the one guarded by `isCustomDictId(currentDictInfo.id) && !isReviewMode`), add:

```tsx
{
  isCustomDictId(currentDictInfo.id) && !isReviewMode && (
    <Tooltip content="Play the matching game">
      <NavLink
        className="block rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
        to={`/match/${encodeURIComponent(currentDictInfo.id)}`}
      >
        Match
      </NavLink>
    </Tooltip>
  )
}
```

- [ ] **Step 3: Static checks**

Run: `npx prettier --write src/pages/MySets/index.tsx src/pages/Typing/components/DictChapterButton/index.tsx && npx eslint . && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn test && yarn build`
Expected: no eslint errors; tsc count `4`; all tests PASS; the production build finishes.

- [ ] **Step 4: Manual pass in the browser (`yarn dev`, http://localhost:5173)**

Prepare data in the browser console (the dev server serves the modules):

```js
const cd = await import('/src/utils/db/custom-dict.ts')
const mk = (n, t) => ({ name: n, trans: [t], usphone: '', ukphone: '' })
await cd.createCustomDict({ name: 'M20', words: Array.from({ length: 20 }, (_, i) => mk('w' + i, 'nghĩa ' + i)) })
await cd.createCustomDict({ name: 'M5', words: Array.from({ length: 5 }, (_, i) => mk('s' + i, 'nghĩa ' + i)) })
await cd.createCustomDict({
  name: 'M8dup',
  words: [mk('a', 'x'), mk('b', 'x'), mk('c', 'x'), ...Array.from({ length: 6 }, (_, i) => mk('d' + i, 'khác ' + i))],
})
await cd.createCustomDict({
  name: 'Long',
  words: Array.from({ length: 8 }, (_, i) => ({
    name: 'l' + i,
    trans: Array.from({ length: 5 }, (_, k) => 'nghĩa dài ' + k + ' của ' + i + ' ' + 'lorem ipsum dolor sit amet '.repeat(6)),
    usphone: '',
    ukphone: '',
  })),
})
```

Then check each item and fix anything that fails:

1. `/my-sets` shows a **Match** button next to Quiz on each set; the typing page shows a **Match** link when a custom set is selected and not for a built-in dictionary.
2. Open `M20`: the intro says "Match 6 words…" with a **Start** button and no best time yet. **Start** → 12 tiles (6 bold words, 6 meanings) in a shuffled order; the header shows `0:00.0 · 0 / 6 matched · 0 mistakes` and the time advances.
3. Click a word, then a wrong meaning → both turn red for about 0.7 s, the mistakes counter becomes 1, nothing disappears. Click a word, then its meaning → both tiles disappear (the grid does not jump) and the matched counter increases.
4. Click a word, then another word → the selection moves, no mistake. Double-click one tile → nothing is matched and nothing changes. Click a tile while two red tiles are flashing → the flash clears and the new tile is selected.
5. Match all 6 pairs → the timer stops and the result shows the time, the number of mistakes and "New best time!"; the intro of the same set now shows the best time; `localStorage` has `matchBest:custom:<id>`.
6. **Play again** → a different board; finish it slower than the best → no "New best time!" and the best is unchanged; finish it faster (or set `localStorage` `matchBest:...` to `999999999` first) → "New best time!".
7. Put garbage in `localStorage` (`matchBest:custom:<id>` = `abc`, then `-5`) and reload → the intro shows no best time and the game still works.
8. `M5` (5 distinct meanings) shows "This set cannot be played yet…" and no Start button. `M8dup` has 9 words but 7 distinct meanings (`x` three times plus `khác 0–5`), so it is playable: start it 10 times and check that **no board ever contains two meaning tiles with the same text**.
9. `Long`: tiles with very long meanings make the page scroll inside the frame (the footer stays visible) and every tile is reachable.
10. Keyboard: Tab reaches the tiles, Enter/Space selects them (a selected tile shows `aria-pressed`), and a full game can be played without a mouse; a matched tile is no longer focusable.
11. The game never writes to the schedule: in DevTools → IndexedDB → RecordDB → `cardProgress` stays empty after playing. `/match/custom%3Anope` redirects to `/gallery`.

The console must show no new errors (the existing Youdao audio CORS error is expected).

- [ ] **Step 5: Record deviations and commit**

If the manual pass revealed a deviation from the spec, add a short "Findings from P4 implementation" note at the end of `docs/superpowers/specs/2026-10-12-study-modes-design.md`.

```bash
git add src/pages/MySets/index.tsx src/pages/Typing/components/DictChapterButton/index.tsx docs/superpowers/specs/2026-10-12-study-modes-design.md
git commit -m "feat: add Match entry points in My Sets and the typing page"
```

(`git add` of the spec file is harmless when it did not change.)

---

## Self-review

**Spec coverage (P4 section):**

- 6 word/meaning pairs on a grid, select two to match, matched pairs disappear, timer runs → Task 1 (board of 12 tiles), Task 2 (select/match/finish/elapsed), Task 4 (grid, invisible matched tiles, 100 ms clock).
- Best time per set in `localStorage`, not IndexedDB, not in the SRS → Task 3 (`readBest`/`writeBest`/`updateBest`) and Task 4 (stored on finish); Task 5 item 11 checks that `cardProgress` stays empty.
- Needs ≥ 6 words → Task 1 (`canPlay`, made precise in Decision 1) and Task 4 (intro message, no Start).
- Route `/match/:dictId` and entry points → Tasks 4 and 5.

**Placeholder scan:** none; every code step contains full code. The Task 5 data-preparation snippet is complete.

**Type consistency:** `Tile`, `TileKind`, `PAIR_COUNT`, `canPlay`, `buildBoard` (Task 1) match their uses in Tasks 2 and 4; `GameState`, `createGame`, `select`, `clearMismatch`, `isFinished`, `isTileMatched`, `elapsed` (Task 2) match `MatchBoard`; `BestStorage`, `sanitizeBest`, `updateBest`, `readBest`, `writeBest`, `formatDuration` (Task 3) match their uses; `shuffle` is exported in Task 1 Step 1 before `board.ts` imports it.
