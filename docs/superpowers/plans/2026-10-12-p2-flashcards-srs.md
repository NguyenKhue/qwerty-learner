# P2 — Flashcards + Spaced Repetition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user study any custom set with flashcards that are scheduled by a simplified SM-2 algorithm: a daily queue of due cards plus a limited number of new cards, graded with Again / Hard / Good / Easy, with all progress stored in the browser.

**Architecture:** Three pure modules (`time`, `scheduler`, `queue` + `session`) hold all the logic and are fully unit-tested; one thin DB module reads/writes `cardProgress` (created empty in P1); the study page is a thin React layer on top (overview screen → session screen) that only calls those modules. Learning data is keyed by `(dictionary id, word)` exactly as P1 prepared, so the same page works for any dictionary id.

**Tech Stack:** React 18, TypeScript (target es5, strict), Dexie 3.2, jotai 2.1, react-hotkeys-hook 4, SWR, Vitest 0.34 (jsdom) + fake-indexeddb (already set up in P1), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-12-study-modes-design.md` (section "P2 — Flashcards + SRS", plus "P1" for the data model it builds on).

## Global Constraints

Copied from the spec; every task implicitly includes them.

- Personal use only: everything in the browser (IndexedDB), no backend, no sharing, no accounts.
- Learning data is keyed by `(dictionary id, word)`: `cardProgress` key is `[dict+word]`, row shape `{ dict, word, state: 'learning' | 'review', due (ms), interval (days), ease, reps, lapses, firstSeen, lastReviewed }`.
- Grades: `again | hard | good | easy`. Simplified SM-2:
  - New card, first grade: `again` → `learning`, due in 10 min; `hard` → due 1 day, interval 1; `good` → interval 1; `easy` → interval 3. Initial ease 2.5.
  - Review card: `again` → `lapses+1`, ease −0.2 (min 1.3), state `learning`, due in 10 min, interval reset to 1; `hard` → interval × 1.2, ease −0.15; `good` → interval × ease; `easy` → interval × ease × 1.3, ease +0.15.
  - Interval is rounded to whole days (min 1) and `due` is the start of that day offset from `now`.
  - `learning` cards graded `good`/`easy` graduate to `review` with interval 1 / 3.
- Queue: cards with `due <= now` (oldest first), then new cards in set order, limited to `newPerDay` (default **20**, user setting). New cards already introduced today (`firstSeen >= start of today`) count against the limit. In-session `again` cards are re-queued at the end of the session.
- UI at `/study/:dictId`: front = word, phonetic, pronunciation button (existing hook); Space flips; toggle for reversed direction (meaning first); grade with keys 1–4 or buttons showing the next interval; header with remaining new / due counts; empty queue → "Done for today" screen with the next due date.
- Entry points: a "Study" button on each custom set in `/my-sets` and a "Study" link in the typing page's dictionary menu.
- Out of scope: sharing, accounts/sync, feeding the schedule into the typing mode, SRS charts, reminders, mobile layout, editing built-ins.
- Code style: Prettier (no semicolons, single quotes, width 140, import-sorting plugin) — run `npx prettier --write <files>` before every commit. TypeScript target is `es5`: no spreading/iterating `Map`/`Set` iterators (use `Array.from`, `forEach`).
- Branch: `feat/study-modes` (P1 is already committed on it).

## Decisions made while planning (fill gaps in the spec)

1. **`nextState` takes the card identity** — `nextState(card | undefined, identity, grade, now)` — because a brand-new card has no row to read `dict`/`word` from.
2. **Learning cards:** `again` and `hard` on a `learning` card keep it `learning`, due in 10 min, no lapse counted (a lapse is only counted when a _review_ card is failed). A new card graded `hard` behaves like `good` (spec).
3. **`reps`** counts every grade given to the card.
4. **Safety clamps** (the spec is silent): `interval` is capped at 365 days; `ease` is rounded to 2 decimals and never below 1.3; a stored `ease`/`interval` that is not a finite number is treated as 2.5 / 1.
5. **Day boundaries use the browser's local time** (`start of day` = local midnight). Calendar-day arithmetic goes through `new Date(y, m, d + n)` so it is DST-safe.
6. **A new card only needs an unseen word name.** Words are de-duplicated by name (first occurrence wins) before queueing, rows whose word is no longer in the set are ignored everywhere (queue, counts, next-due), and a renamed word is simply a new card.
7. **Queue is a snapshot built when "Start" is pressed.** An `again` card is also saved as due in 10 min, so after a reload it reappears only once those 10 minutes have passed; graded-`good` cards never reappear before they are due.
8. **Settings:** `newCardsPerDay` (default 20, clamped to an integer 0–500) and "reverse direction" are stored with `atomWithStorage`.
9. **Entry points** are shown for custom sets only (the route itself works for any dictionary id because the data is keyed generically); built-in dictionaries can be enabled later by adding a button.
10. **No Playwright test** (same reason as P1: the project's e2e config targets the production site). Verification = Vitest for all logic + a manual browser pass (Task 5).

## Review Focus

Inputs/conditions the spec implies but does not spell out, most likely to bite first. Each has a test in the owning task.

1. **Day boundary of the new-card limit:** a card introduced at 00:00:00 counts for today, one introduced at 23:59:59 yesterday does not — Task 2 (`buildQueue`).
2. **The set changes after progress exists:** removed words (orphan rows) must not appear, be counted, or set "next due"; added words become new cards; duplicate names in a built-in list produce one card — Task 2.
3. **Very long streaks / corrupt rows:** interval stays ≤ 365 days, ease never below 1.3, NaN `ease`/`interval` in a stored row does not poison the schedule — Task 1.
4. **Bad settings:** `newPerDay` of 0, negative, fractional, non-numeric or huge must yield a sane limit (0 means "no new cards today", due cards still show) — Task 2 (`sanitizeNewPerDay`).
5. **Fast double key presses / grading before the flip:** a second grade while the first is still saving, or a grade before the answer is shown, must be ignored (no double-counted review, no skipped card) — Task 2 (`answer` is a no-op unless flipped) and Task 4 (busy guard).

## File Structure

Create:

- `src/utils/srs/time.ts` (+ `time.test.ts`) — local-day arithmetic.
- `src/utils/srs/scheduler.ts` (+ `scheduler.test.ts`) — `nextState`, `describeInterval`, `previewLabels`.
- `src/utils/srs/queue.ts` (+ `queue.test.ts`) — `buildQueue`, `queueCounts`, `nextDueTime`, `sanitizeNewPerDay`.
- `src/utils/srs/session.ts` (+ `session.test.ts`) — in-memory study session state.
- `src/utils/db/card-progress.ts` (+ `card-progress.test.ts`) — `getDictProgress`, `reviewCard`.
- `src/store/study.ts` — `newCardsPerDayAtom`, `studyReverseAtom`.
- `src/pages/Study/index.tsx` (route + data loading), `src/pages/Study/Overview.tsx`, `src/pages/Study/StudySession.tsx`.

Modify:

- `src/index.tsx` — route `/study/:dictId`.
- `src/pages/MySets/index.tsx` — "Study" button.
- `src/pages/Typing/components/DictChapterButton/index.tsx` — "Study" link for custom sets.

---

### Task 1: Time helpers and the scheduler

**Files:**

- Create: `src/utils/srs/time.ts`, `src/utils/srs/scheduler.ts`
- Test: `src/utils/srs/time.test.ts`, `src/utils/srs/scheduler.test.ts`

**Interfaces:**

- Consumes: `ICardProgress` from `@/utils/db/record` (created in P1).
- Produces (exact signatures later tasks use):

  - `time.ts`: `MINUTE_MS: number`, `HOUR_MS: number`, `DAY_MS: number`, `startOfLocalDay(ms: number): number`, `addLocalDays(ms: number, days: number): number` (local midnight of the day `days` after `ms`'s day).
  - `scheduler.ts`: `type Grade = 'again' | 'hard' | 'good' | 'easy'`, `GRADES: Grade[]` (in that order), `type CardIdentity = { dict: string; word: string }`, `INITIAL_EASE = 2.5`, `MIN_EASE = 1.3`, `MAX_INTERVAL_DAYS = 365`, `LEARNING_STEP_MS`, `nextState(card: ICardProgress | undefined, identity: CardIdentity, grade: Grade, now: number): ICardProgress`, `describeInterval(due: number, now: number): string`, `previewLabels(card: ICardProgress | undefined, identity: CardIdentity, now: number): Record<Grade, string>`.

- [ ] **Step 1: Write the failing tests for `time.ts`**

Create `src/utils/srs/time.test.ts`:

```ts
import { DAY_MS, HOUR_MS, MINUTE_MS, addLocalDays, startOfLocalDay } from './time'
import { describe, expect, it } from 'vitest'

describe('time helpers', () => {
  it('exposes the unit constants', () => {
    expect(MINUTE_MS).toBe(60000)
    expect(HOUR_MS).toBe(3600000)
    expect(DAY_MS).toBe(86400000)
  })

  it('startOfLocalDay returns local midnight', () => {
    const afternoon = new Date(2026, 9, 12, 15, 30, 45).getTime()
    expect(startOfLocalDay(afternoon)).toBe(new Date(2026, 9, 12).getTime())
    const lastSecond = new Date(2026, 9, 12, 23, 59, 59).getTime()
    expect(startOfLocalDay(lastSecond)).toBe(new Date(2026, 9, 12).getTime())
    const midnight = new Date(2026, 9, 12).getTime()
    expect(startOfLocalDay(midnight)).toBe(midnight)
  })

  it('addLocalDays moves by calendar days, across months', () => {
    const now = new Date(2026, 9, 12, 15, 30).getTime()
    expect(addLocalDays(now, 0)).toBe(new Date(2026, 9, 12).getTime())
    expect(addLocalDays(now, 3)).toBe(new Date(2026, 9, 15).getTime())
    const endOfMonth = new Date(2026, 9, 30, 8).getTime()
    expect(addLocalDays(endOfMonth, 3)).toBe(new Date(2026, 10, 2).getTime())
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/utils/srs/time.test.ts`
Expected: FAIL — cannot find module `./time`.

- [ ] **Step 3: Implement `time.ts`**

Create `src/utils/srs/time.ts`:

```ts
export const MINUTE_MS = 60 * 1000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/** Local midnight of the day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Local midnight of the day `days` calendar days after the day containing `ms` (DST-safe). */
export function addLocalDays(ms: number, days: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime()
}
```

- [ ] **Step 3b: Run to verify it passes**

Run: `yarn test src/utils/srs/time.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Write the failing tests for the scheduler**

Create `src/utils/srs/scheduler.test.ts`:

```ts
import { GRADES, INITIAL_EASE, MAX_INTERVAL_DAYS, describeInterval, nextState, previewLabels } from './scheduler'
import type { Grade } from './scheduler'
import { MINUTE_MS } from './time'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const identity = { dict: 'd', word: 'w' }
const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const day = (n: number) => new Date(2026, 9, 12 + n).getTime()
const STEP = 10 * MINUTE_MS

const review = (over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: 'w',
  state: 'review',
  due: day(0),
  interval: 10,
  ease: 2.5,
  reps: 4,
  lapses: 1,
  firstSeen: 111,
  lastReviewed: 222,
  ...over,
})
const learning = (over: Partial<ICardProgress> = {}): ICardProgress => review({ state: 'learning', interval: 1, due: NOW, ...over })

describe('nextState — new card', () => {
  it('again: learning, due in 10 minutes, nothing graduated', () => {
    expect(nextState(undefined, identity, 'again', NOW)).toEqual({
      dict: 'd',
      word: 'w',
      state: 'learning',
      due: NOW + STEP,
      interval: 0,
      ease: INITIAL_EASE,
      reps: 1,
      lapses: 0,
      firstSeen: NOW,
      lastReviewed: NOW,
    })
  })

  it.each([
    ['hard', 1],
    ['good', 1],
    ['easy', 3],
  ] as [Grade, number][])('%s: review with interval %i day(s), due at the start of that day', (grade, interval) => {
    expect(nextState(undefined, identity, grade, NOW)).toEqual({
      dict: 'd',
      word: 'w',
      state: 'review',
      due: day(interval),
      interval,
      ease: INITIAL_EASE,
      reps: 1,
      lapses: 0,
      firstSeen: NOW,
      lastReviewed: NOW,
    })
  })
})

describe('nextState — review card', () => {
  it('again: lapse, ease -0.2, back to learning with interval 1', () => {
    const next = nextState(review(), identity, 'again', NOW)
    expect(next).toMatchObject({
      state: 'learning',
      due: NOW + STEP,
      interval: 1,
      ease: 2.3,
      lapses: 2,
      reps: 5,
      firstSeen: 111,
      lastReviewed: NOW,
    })
  })

  it('hard: interval x1.2, ease -0.15', () => {
    expect(nextState(review(), identity, 'hard', NOW)).toMatchObject({ state: 'review', interval: 12, ease: 2.35, due: day(12), lapses: 1 })
  })

  it('good: interval x ease, ease unchanged', () => {
    expect(nextState(review(), identity, 'good', NOW)).toMatchObject({ state: 'review', interval: 25, ease: 2.5, due: day(25), reps: 5 })
  })

  it('easy: interval x ease x 1.3, ease +0.15', () => {
    expect(nextState(review({ interval: 20 }), identity, 'easy', NOW)).toMatchObject({ interval: 65, ease: 2.65, due: day(65) })
  })

  it('never drops the ease below 1.3', () => {
    expect(nextState(review({ ease: 1.3 }), identity, 'again', NOW).ease).toBe(1.3)
    expect(nextState(review({ ease: 1.35 }), identity, 'hard', NOW).ease).toBe(1.3)
  })

  it('caps the interval at 365 days', () => {
    const next = nextState(review({ interval: 300 }), identity, 'good', NOW)
    expect(next.interval).toBe(MAX_INTERVAL_DAYS)
    expect(next.due).toBe(day(MAX_INTERVAL_DAYS))
  })

  it('never goes below one day', () => {
    expect(nextState(review({ interval: 1 }), identity, 'hard', NOW).interval).toBe(1)
  })

  it('treats a corrupt ease/interval as the defaults instead of propagating NaN', () => {
    const next = nextState(review({ ease: NaN, interval: NaN }), identity, 'good', NOW)
    expect(next.interval).toBe(3)
    expect(next.ease).toBe(INITIAL_EASE)
    expect(next.due).toBe(day(3))
  })

  it('does not mutate the card it was given', () => {
    const card = review()
    const copy = { ...card }
    nextState(card, identity, 'good', NOW)
    expect(card).toEqual(copy)
  })
})

describe('nextState — learning card', () => {
  it.each(['again', 'hard'] as Grade[])('%s: stays learning, due in 10 minutes, no lapse counted', (grade) => {
    expect(nextState(learning(), identity, grade, NOW)).toMatchObject({
      state: 'learning',
      due: NOW + STEP,
      interval: 1,
      lapses: 1,
      ease: 2.5,
    })
  })

  it('good graduates to review with interval 1', () => {
    expect(nextState(learning(), identity, 'good', NOW)).toMatchObject({ state: 'review', interval: 1, due: day(1), ease: 2.5 })
  })

  it('easy graduates to review with interval 3', () => {
    expect(nextState(learning(), identity, 'easy', NOW)).toMatchObject({ state: 'review', interval: 3, due: day(3), ease: 2.5 })
  })
})

describe('describeInterval / previewLabels', () => {
  it('describes minutes, days, months and years', () => {
    expect(describeInterval(NOW + STEP, NOW)).toBe('10m')
    expect(describeInterval(NOW + 20 * 1000, NOW)).toBe('1m')
    expect(describeInterval(day(1), NOW)).toBe('1d')
    expect(describeInterval(day(3), NOW)).toBe('3d')
    expect(describeInterval(day(60), NOW)).toBe('2mo')
    expect(describeInterval(day(365), NOW)).toBe('1y')
  })

  it('previews the next interval of every grade for a new card', () => {
    expect(previewLabels(undefined, identity, NOW)).toEqual({ again: '10m', hard: '1d', good: '1d', easy: '3d' })
  })

  it('GRADES lists the four grades in button order', () => {
    expect(GRADES).toEqual(['again', 'hard', 'good', 'easy'])
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `yarn test src/utils/srs/scheduler.test.ts`
Expected: FAIL — cannot find module `./scheduler`.

- [ ] **Step 6: Implement `scheduler.ts`**

Create `src/utils/srs/scheduler.ts`:

```ts
import { DAY_MS, HOUR_MS, MINUTE_MS, addLocalDays, startOfLocalDay } from './time'
import type { ICardProgress } from '@/utils/db/record'

export type Grade = 'again' | 'hard' | 'good' | 'easy'
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy']

export type CardIdentity = { dict: string; word: string }

export const INITIAL_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_INTERVAL_DAYS = 365
export const LEARNING_STEP_MS = 10 * MINUTE_MS

const clampInterval = (days: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)))
const clampEase = (ease: number) => Math.max(MIN_EASE, Math.round(ease * 100) / 100)

function review(base: ICardProgress, interval: number, ease: number, now: number): ICardProgress {
  const days = clampInterval(interval)
  return { ...base, state: 'review', interval: days, ease: clampEase(ease), due: addLocalDays(now, days) }
}

function learningStep(base: ICardProgress, now: number, extra: Partial<ICardProgress> = {}): ICardProgress {
  return { ...base, ...extra, state: 'learning', due: now + LEARNING_STEP_MS }
}

/**
 * The state of a card after it was graded. Pure: never mutates `card`.
 * `identity` is needed because a brand-new card has no row to take `dict`/`word` from.
 */
export function nextState(card: ICardProgress | undefined, identity: CardIdentity, grade: Grade, now: number): ICardProgress {
  if (!card) {
    const base: ICardProgress = {
      dict: identity.dict,
      word: identity.word,
      state: 'review',
      due: now,
      interval: 0,
      ease: INITIAL_EASE,
      reps: 1,
      lapses: 0,
      firstSeen: now,
      lastReviewed: now,
    }
    if (grade === 'again') return learningStep(base, now)
    return review(base, grade === 'easy' ? 3 : 1, INITIAL_EASE, now)
  }

  const ease = Number.isFinite(card.ease) ? card.ease : INITIAL_EASE
  const interval = Number.isFinite(card.interval) && card.interval >= 1 ? card.interval : 1
  const base: ICardProgress = { ...card, ease, interval, reps: card.reps + 1, lastReviewed: now }

  if (card.state === 'learning') {
    if (grade === 'again' || grade === 'hard') return learningStep(base, now)
    return review(base, grade === 'easy' ? 3 : 1, ease, now)
  }

  switch (grade) {
    case 'again':
      return learningStep(base, now, { interval: 1, ease: clampEase(ease - 0.2), lapses: card.lapses + 1 })
    case 'hard':
      return review(base, interval * 1.2, ease - 0.15, now)
    case 'good':
      return review(base, interval * ease, ease, now)
    default:
      return review(base, interval * ease * 1.3, ease + 0.15, now)
  }
}

/** Short label for the time until `due`: 10m, 1d, 2mo, 1y. */
export function describeInterval(due: number, now: number): string {
  const diff = due - now
  if (diff < HOUR_MS) return `${Math.max(1, Math.round(diff / MINUTE_MS))}m`
  const days = Math.max(1, Math.round((startOfLocalDay(due) - startOfLocalDay(now)) / DAY_MS))
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}

/** What each grade button would schedule, for the labels on the buttons. */
export function previewLabels(card: ICardProgress | undefined, identity: CardIdentity, now: number): Record<Grade, string> {
  const label = (grade: Grade) => describeInterval(nextState(card, identity, grade, now).due, now)
  return { again: label('again'), hard: label('hard'), good: label('good'), easy: label('easy') }
}
```

- [ ] **Step 7: Run the tests**

Run: `yarn test src/utils/srs`
Expected: all PASS. If a rounding assertion fails (for example `interval: 12` for `hard`), print `nextState(review(), identity, 'hard', NOW)` and fix the code, not the test — the spec fixes the factors.

- [ ] **Step 8: Lint, type-check, commit**

Run: `npx eslint src/utils/srs && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: no eslint errors; tsc count `4` (the four pre-existing errors).

```bash
npx prettier --write src/utils/srs
git add src/utils/srs
git commit -m "feat: add SM-2 scheduler and local-day helpers for spaced repetition"
```

(The pre-commit hook runs eslint/prettier; if it fails the commit did not happen — fix and commit again before continuing.)

---

### Task 2: Queue builder and session state

**Files:**

- Create: `src/utils/srs/queue.ts`, `src/utils/srs/session.ts`
- Test: `src/utils/srs/queue.test.ts`, `src/utils/srs/session.test.ts`

**Interfaces:**

- Consumes: `Word` from `@/typings`; `ICardProgress` from `@/utils/db/record`; `startOfLocalDay` (Task 1); `Grade` (Task 1).
- Produces:

  - `queue.ts`: `DEFAULT_NEW_PER_DAY = 20`, `MAX_NEW_PER_DAY = 500`, `type QueueItem = { word: Word; kind: 'due' | 'new' }`, `sanitizeNewPerDay(value: unknown): number`, `buildQueue(input: { words: Word[]; progress: ICardProgress[]; now: number; newPerDay: number }): QueueItem[]`, `queueCounts(queue: QueueItem[]): { due: number; new: number }`, `nextDueTime(words: Word[], progress: ICardProgress[], now: number): number | null`.
  - `session.ts`: `type StudySession = { queue: QueueItem[]; flipped: boolean; reviewed: number; again: number }`, `createSession(queue: QueueItem[]): StudySession`, `currentItem(session): QueueItem | undefined`, `flip(session): StudySession`, `answer(session, grade: Grade): StudySession`.

- [ ] **Step 1: Write the failing tests for the queue**

Create `src/utils/srs/queue.test.ts`:

```ts
import { DEFAULT_NEW_PER_DAY, buildQueue, nextDueTime, queueCounts, sanitizeNewPerDay } from './queue'
import { startOfLocalDay } from './time'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const TODAY = startOfLocalDay(NOW)
const word = (name: string): Word => ({ name, trans: [`n. ${name}`], usphone: '', ukphone: '' })
const card = (name: string, over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: name,
  state: 'review',
  due: NOW + 1000,
  interval: 3,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: TODAY - 5 * 86400000,
  lastReviewed: TODAY - 1000,
  ...over,
})
const names = (items: { word: Word }[]) => items.map((i) => i.word.name)

describe('buildQueue', () => {
  it('puts due cards first (oldest due first), then new cards in set order; skips future cards', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map(word)
    const progress = [
      card('b', { due: NOW - 1000 }), // due, newer
      card('d', { due: NOW - 5000 }), // due, older
      card('a', { due: NOW + 60000 }), // future
    ]
    const queue = buildQueue({ words, progress, now: NOW, newPerDay: 20 })
    expect(queue.map((i) => [i.word.name, i.kind])).toEqual([
      ['d', 'due'],
      ['b', 'due'],
      ['c', 'new'],
      ['e', 'new'],
    ])
  })

  it('limits new cards to newPerDay minus the cards first seen today', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map(word)
    expect(names(buildQueue({ words, progress: [], now: NOW, newPerDay: 2 }))).toEqual(['a', 'b'])
    const introduced = [card('a', { firstSeen: TODAY + 1000, due: NOW + 99999 })]
    expect(names(buildQueue({ words, progress: introduced, now: NOW, newPerDay: 2 }))).toEqual(['b'])
    expect(names(buildQueue({ words, progress: introduced, now: NOW, newPerDay: 1 }))).toEqual([])
  })

  it('counts a card first seen exactly at local midnight as today, one second before as yesterday', () => {
    const words = ['a', 'b', 'c'].map(word)
    const atMidnight = [card('a', { firstSeen: TODAY, due: NOW + 99999 })]
    expect(names(buildQueue({ words, progress: atMidnight, now: NOW, newPerDay: 1 }))).toEqual([])
    const justBefore = [card('a', { firstSeen: TODAY - 1000, due: NOW + 99999 })]
    expect(names(buildQueue({ words, progress: justBefore, now: NOW, newPerDay: 1 }))).toEqual(['b'])
  })

  it('newPerDay 0 gives no new cards but still gives due cards', () => {
    const words = ['a', 'b'].map(word)
    const queue = buildQueue({ words, progress: [card('a', { due: NOW - 1 })], now: NOW, newPerDay: 0 })
    expect(queue.map((i) => [i.word.name, i.kind])).toEqual([['a', 'due']])
  })

  it('ignores progress rows of words that are no longer in the set, and treats added words as new', () => {
    const words = ['a', 'z'].map(word)
    const progress = [card('gone', { due: NOW - 1, firstSeen: TODAY + 1 }), card('a', { due: NOW + 99999 })]
    const queue = buildQueue({ words, progress, now: NOW, newPerDay: 1 })
    expect(queue.map((i) => [i.word.name, i.kind])).toEqual([['z', 'new']])
  })

  it('queues a word name that appears twice in the list only once', () => {
    const words = [word('a'), word('b'), word('a')]
    expect(names(buildQueue({ words, progress: [], now: NOW, newPerDay: 20 }))).toEqual(['a', 'b'])
  })

  it('returns an empty queue for an empty set', () => {
    expect(buildQueue({ words: [], progress: [], now: NOW, newPerDay: 20 })).toEqual([])
  })
})

describe('queueCounts', () => {
  it('counts due and new cards', () => {
    expect(
      queueCounts([
        { word: word('a'), kind: 'due' },
        { word: word('b'), kind: 'new' },
        { word: word('c'), kind: 'new' },
      ]),
    ).toEqual({ due: 1, new: 2 })
  })
})

describe('nextDueTime', () => {
  it('returns the earliest future due time among words in the set, ignoring orphans and due-now cards', () => {
    const words = ['a', 'b'].map(word)
    const progress = [
      card('a', { due: NOW + 5000 }),
      card('b', { due: NOW + 9000 }),
      card('gone', { due: NOW + 10 }),
      card('b', { due: NOW - 5 }),
    ]
    expect(nextDueTime(words, [progress[0], progress[2]], NOW)).toBe(NOW + 5000)
    expect(nextDueTime(words, [progress[3]], NOW)).toBeNull()
    expect(nextDueTime(words, [], NOW)).toBeNull()
  })
})

describe('sanitizeNewPerDay', () => {
  it('gives sane integers for any stored value', () => {
    expect(sanitizeNewPerDay(20)).toBe(20)
    expect(sanitizeNewPerDay(0)).toBe(0)
    expect(sanitizeNewPerDay(-5)).toBe(0)
    expect(sanitizeNewPerDay(3.7)).toBe(3)
    expect(sanitizeNewPerDay(9999)).toBe(500)
    expect(sanitizeNewPerDay('15')).toBe(15)
    expect(sanitizeNewPerDay('abc')).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay('')).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay(NaN)).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay(null)).toBe(DEFAULT_NEW_PER_DAY)
    expect(sanitizeNewPerDay(undefined)).toBe(DEFAULT_NEW_PER_DAY)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/utils/srs/queue.test.ts`
Expected: FAIL — cannot find module `./queue`.

- [ ] **Step 3: Implement `queue.ts`**

Create `src/utils/srs/queue.ts`:

```ts
import { startOfLocalDay } from './time'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'

export const DEFAULT_NEW_PER_DAY = 20
export const MAX_NEW_PER_DAY = 500

export type QueueItem = { word: Word; kind: 'due' | 'new' }

/** Turns whatever is stored for "new cards per day" into an integer between 0 and 500 (default 20). */
export function sanitizeNewPerDay(value: unknown): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return DEFAULT_NEW_PER_DAY
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_NEW_PER_DAY
  return Math.min(MAX_NEW_PER_DAY, Math.max(0, Math.floor(n)))
}

function uniqueWords(words: Word[]): Word[] {
  const seen = new Set<string>()
  const result: Word[] = []
  words.forEach((word) => {
    if (seen.has(word.name)) return
    seen.add(word.name)
    result.push(word)
  })
  return result
}

/** Progress rows of the words that are in the set (rows of removed words are ignored). */
function progressOfWords(words: Word[], progress: ICardProgress[]): Map<string, ICardProgress> {
  const inSet = new Set(words.map((word) => word.name))
  const byWord = new Map<string, ICardProgress>()
  progress.forEach((card) => {
    if (inSet.has(card.word)) byWord.set(card.word, card)
  })
  return byWord
}

/** Today's queue: due cards (oldest first), then new cards in set order, limited to `newPerDay` minus those first seen today. */
export function buildQueue(input: { words: Word[]; progress: ICardProgress[]; now: number; newPerDay: number }): QueueItem[] {
  const words = uniqueWords(input.words)
  const byWord = progressOfWords(words, input.progress)
  const dayStart = startOfLocalDay(input.now)

  let introducedToday = 0
  byWord.forEach((card) => {
    if (card.firstSeen >= dayStart) introducedToday++
  })

  const due: { word: Word; due: number }[] = []
  const fresh: Word[] = []
  words.forEach((word) => {
    const card = byWord.get(word.name)
    if (!card) fresh.push(word)
    else if (card.due <= input.now) due.push({ word, due: card.due })
  })
  due.sort((a, b) => a.due - b.due)

  const newLimit = Math.max(0, sanitizeNewPerDay(input.newPerDay) - introducedToday)
  return due
    .map((item): QueueItem => ({ word: item.word, kind: 'due' }))
    .concat(fresh.slice(0, newLimit).map((word): QueueItem => ({ word, kind: 'new' })))
}

export function queueCounts(queue: QueueItem[]): { due: number; new: number } {
  const due = queue.filter((item) => item.kind === 'due').length
  return { due, new: queue.length - due }
}

/** The earliest moment after `now` at which a card of the set becomes due, or null if nothing is scheduled. */
export function nextDueTime(words: Word[], progress: ICardProgress[], now: number): number | null {
  const byWord = progressOfWords(uniqueWords(words), progress)
  return Array.from(byWord.values()).reduce<number | null>((next, card) => {
    if (card.due <= now) return next
    return next === null || card.due < next ? card.due : next
  }, null)
}
```

- [ ] **Step 4: Run to verify the queue tests pass**

Run: `yarn test src/utils/srs/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for the session**

Create `src/utils/srs/session.test.ts`:

```ts
import type { QueueItem } from './queue'
import { answer, createSession, currentItem, flip } from './session'
import { describe, expect, it } from 'vitest'

const item = (name: string, kind: 'due' | 'new' = 'new'): QueueItem => ({ word: { name, trans: ['x'], usphone: '', ukphone: '' }, kind })

describe('study session', () => {
  it('starts on the first card, not flipped', () => {
    const s = createSession([item('a'), item('b')])
    expect(currentItem(s)?.word.name).toBe('a')
    expect(s).toMatchObject({ flipped: false, reviewed: 0, again: 0 })
  })

  it('flip shows the answer and is idempotent', () => {
    const s = flip(createSession([item('a')]))
    expect(s.flipped).toBe(true)
    expect(flip(s)).toEqual(s)
  })

  it('answer before the flip is ignored (no double count, no skipped card)', () => {
    const s = createSession([item('a'), item('b')])
    expect(answer(s, 'good')).toBe(s)
  })

  it('good moves to the next card, unflipped, and counts the review', () => {
    const s = answer(flip(createSession([item('a'), item('b')])), 'good')
    expect(currentItem(s)?.word.name).toBe('b')
    expect(s).toMatchObject({ flipped: false, reviewed: 1, again: 0 })
  })

  it('again puts the card back at the end of the queue and counts it', () => {
    const s = answer(flip(createSession([item('a'), item('b')])), 'again')
    expect(s.queue.map((i) => i.word.name)).toEqual(['b', 'a'])
    expect(s).toMatchObject({ reviewed: 1, again: 1, flipped: false })
  })

  it('finishes with an empty queue and ignores further input', () => {
    let s = flip(createSession([item('a')]))
    s = answer(s, 'easy')
    expect(currentItem(s)).toBeUndefined()
    expect(flip(s)).toBe(s)
    expect(answer(s, 'good')).toBe(s)
  })

  it('does not mutate the previous session', () => {
    const s = flip(createSession([item('a'), item('b')]))
    const before = JSON.stringify(s)
    answer(s, 'again')
    expect(JSON.stringify(s)).toBe(before)
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `yarn test src/utils/srs/session.test.ts`
Expected: FAIL — cannot find module `./session`.

- [ ] **Step 7: Implement `session.ts`**

Create `src/utils/srs/session.ts`:

```ts
import type { QueueItem } from './queue'
import type { Grade } from './scheduler'

export type StudySession = { queue: QueueItem[]; flipped: boolean; reviewed: number; again: number }

export function createSession(queue: QueueItem[]): StudySession {
  return { queue, flipped: false, reviewed: 0, again: 0 }
}

export function currentItem(session: StudySession): QueueItem | undefined {
  return session.queue[0]
}

export function flip(session: StudySession): StudySession {
  if (session.queue.length === 0 || session.flipped) return session
  return { ...session, flipped: true }
}

/** Applies a grade to the current card. A no-op until the answer has been shown. `again` puts the card back at the end. */
export function answer(session: StudySession, grade: Grade): StudySession {
  if (session.queue.length === 0 || !session.flipped) return session
  const [head, ...rest] = session.queue
  return {
    queue: grade === 'again' ? rest.concat(head) : rest,
    flipped: false,
    reviewed: session.reviewed + 1,
    again: session.again + (grade === 'again' ? 1 : 0),
  }
}
```

- [ ] **Step 8: Run all tests, lint, type-check, commit**

Run: `yarn test && npx eslint src/utils/srs && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: all tests PASS; no eslint errors; tsc count `4`.

```bash
npx prettier --write src/utils/srs
git add src/utils/srs
git commit -m "feat: add study queue builder and session state"
```

---

### Task 3: Progress persistence (`card-progress.ts`)

**Files:**

- Create: `src/utils/db/card-progress.ts`
- Test: `src/utils/db/card-progress.test.ts`

**Interfaces:**

- Consumes: `db` from `./database` (has `cardProgress: Table<ICardProgress, [string, string]>`, from P1); `nextState`, `Grade` (Task 1).
- Produces: `getDictProgress(dict: string): Promise<ICardProgress[]>`, `reviewCard(dict: string, word: string, grade: Grade, now?: number): Promise<ICardProgress>` (reads the card, applies `nextState`, writes it, returns the saved card; `now` defaults to `Date.now()`).

- [ ] **Step 1: Write the failing tests**

Create `src/utils/db/card-progress.test.ts`:

```ts
import { getDictProgress, reviewCard } from './card-progress'
import { db } from './database'
import { beforeEach, describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()

beforeEach(async () => {
  await db.cardProgress.clear()
})

describe('reviewCard', () => {
  it('creates a row for a new card and returns it', async () => {
    const saved = await reviewCard('custom:a', 'apple', 'good', NOW)
    expect(saved).toMatchObject({ dict: 'custom:a', word: 'apple', state: 'review', interval: 1, reps: 1, firstSeen: NOW })
    expect(await db.cardProgress.get(['custom:a', 'apple'])).toEqual(saved)
  })

  it('updates the same row on the next review and keeps firstSeen', async () => {
    await reviewCard('custom:a', 'apple', 'good', NOW)
    const later = NOW + 3 * 86400000
    const saved = await reviewCard('custom:a', 'apple', 'good', later)
    expect(saved).toMatchObject({ reps: 2, firstSeen: NOW, lastReviewed: later, interval: 3 })
    expect(await db.cardProgress.count()).toBe(1)
  })

  it('keeps the same word in different dictionaries apart', async () => {
    await reviewCard('custom:a', 'apple', 'easy', NOW)
    await reviewCard('custom:b', 'apple', 'again', NOW)
    expect((await db.cardProgress.get(['custom:a', 'apple']))?.state).toBe('review')
    expect((await db.cardProgress.get(['custom:b', 'apple']))?.state).toBe('learning')
  })
})

describe('getDictProgress', () => {
  it('returns only the rows of the given dictionary', async () => {
    await reviewCard('custom:a', 'apple', 'good', NOW)
    await reviewCard('custom:a', 'pear', 'good', NOW)
    await reviewCard('custom:b', 'plum', 'good', NOW)
    const rows = await getDictProgress('custom:a')
    expect(rows.map((r) => r.word).sort()).toEqual(['apple', 'pear'])
    expect(await getDictProgress('custom:none')).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/utils/db/card-progress.test.ts`
Expected: FAIL — cannot find module `./card-progress`.

- [ ] **Step 3: Implement**

Create `src/utils/db/card-progress.ts`:

```ts
import { db } from './database'
import type { ICardProgress } from './record'
import { nextState } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'

export async function getDictProgress(dict: string): Promise<ICardProgress[]> {
  return db.cardProgress.where('dict').equals(dict).toArray()
}

/** Grades one card: reads its row, computes the next state, saves it, and returns the saved row. */
export async function reviewCard(dict: string, word: string, grade: Grade, now: number = Date.now()): Promise<ICardProgress> {
  return db.transaction('rw', db.cardProgress, async () => {
    const existing = await db.cardProgress.get([dict, word])
    const next = nextState(existing, { dict, word }, grade, now)
    await db.cardProgress.put(next)
    return next
  })
}
```

- [ ] **Step 4: Run all tests, lint, type-check, commit**

Run: `yarn test && npx eslint src/utils && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: all tests PASS; no eslint errors; tsc count `4`.

```bash
npx prettier --write src/utils/db/card-progress.ts src/utils/db/card-progress.test.ts
git add src/utils/db/card-progress.ts src/utils/db/card-progress.test.ts
git commit -m "feat: persist spaced-repetition progress per dictionary and word"
```

---

### Task 4: Study page (store, overview, session, route)

**Files:**

- Create: `src/store/study.ts`, `src/pages/Study/index.tsx`, `src/pages/Study/Overview.tsx`, `src/pages/Study/StudySession.tsx`
- Modify: `src/index.tsx`

**Interfaces:**

- Consumes: `buildQueue`, `queueCounts`, `nextDueTime`, `sanitizeNewPerDay`, `DEFAULT_NEW_PER_DAY`, `QueueItem` (Task 2); `createSession`, `currentItem`, `flip`, `answer` (Task 2); `GRADES`, `Grade`, `previewLabels` (Task 1); `getDictProgress`, `reviewCard` (Task 3); `dictionaryByIdAtom`, `customDictionariesLoadedAtom`, `isCustomDictPending` from `@/store/customDicts` (P1); `wordListFetcher` (P1, handles `idb:` urls); `WordPronunciationIcon` from `@/components/WordPronunciationIcon`; `Layout`, `Button`.
- Produces: route `/study/:dictId` (the id is URL-encoded, e.g. `/study/custom%3Aabc`); atoms `newCardsPerDayAtom` and `studyReverseAtom`; `type SessionSummary = { reviewed: number; again: number }`.

This task is UI; there is no unit test for the components (all logic they call is covered in Tasks 1–3). It is verified by type-check, lint, the existing suite and the manual pass in Task 5.

- [ ] **Step 1: Create the settings atoms**

Create `src/store/study.ts`:

```ts
import { DEFAULT_NEW_PER_DAY } from '@/utils/srs/queue'
import { atomWithStorage } from 'jotai/utils'

/** How many new cards a day may be introduced. Always pass the value through `sanitizeNewPerDay` before using it. */
export const newCardsPerDayAtom = atomWithStorage<number>('srsNewPerDay', DEFAULT_NEW_PER_DAY)

/** When true the front of a card shows the meaning and the back shows the word. */
export const studyReverseAtom = atomWithStorage<boolean>('srsReverse', false)
```

- [ ] **Step 2: Create the session screen**

Create `src/pages/Study/StudySession.tsx`:

```tsx
import Layout from '@/components/Layout'
import { WordPronunciationIcon } from '@/components/WordPronunciationIcon'
import { Button } from '@/components/ui/button'
import { reviewCard } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import type { QueueItem } from '@/utils/srs/queue'
import { queueCounts } from '@/utils/srs/queue'
import { GRADES, previewLabels } from '@/utils/srs/scheduler'
import type { Grade } from '@/utils/srs/scheduler'
import { answer, createSession, currentItem, flip } from '@/utils/srs/session'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

export type SessionSummary = { reviewed: number; again: number }

type Props = {
  dictId: string
  queue: QueueItem[]
  progress: ICardProgress[]
  reverse: boolean
  onFinish: (summary: SessionSummary) => void
}

const GRADE_STYLE: Record<Grade, string> = {
  again: 'bg-red-500 text-white hover:bg-red-500/90',
  hard: 'bg-amber-500 text-white hover:bg-amber-500/90',
  good: 'bg-indigo-500 text-white hover:bg-indigo-500/90',
  easy: 'bg-emerald-500 text-white hover:bg-emerald-500/90',
}
const GRADE_NAME: Record<Grade, string> = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }

export default function StudySession({ dictId, queue, progress, reverse, onFinish }: Props) {
  const [session, setSession] = useState(() => createSession(queue))
  const [cards, setCards] = useState(() => new Map(progress.map((card): [string, ICardProgress] => [card.word, card])))
  const [error, setError] = useState('')
  // A ref, not state: two key presses in the same tick must not both pass the guard
  const busy = useRef(false)
  const finished = useRef(false)

  const item = currentItem(session)
  const counts = queueCounts(session.queue)

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onFinish({ reviewed: session.reviewed, again: session.again })
  }, [onFinish, session.again, session.reviewed])

  useEffect(() => {
    if (!item) finish()
  }, [item, finish])

  const onFlip = useCallback(() => setSession((s) => flip(s)), [])

  const onGrade = useCallback(
    async (grade: Grade) => {
      if (busy.current || !item || !session.flipped) return
      busy.current = true
      setError('')
      try {
        const saved = await reviewCard(dictId, item.word.name, grade)
        setCards((prev) => {
          const next = new Map(prev)
          next.set(saved.word, saved)
          return next
        })
        setSession((s) => answer(s, grade))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your answer')
      } finally {
        busy.current = false
      }
    },
    [dictId, item, session.flipped],
  )

  useHotkeys('space', onFlip, { preventDefault: true }, [onFlip])
  useHotkeys('1', () => onGrade('again'), [onGrade])
  useHotkeys('2', () => onGrade('hard'), [onGrade])
  useHotkeys('3', () => onGrade('good'), [onGrade])
  useHotkeys('4', () => onGrade('easy'), [onGrade])

  if (!item) return null

  const { word } = item
  const phonetic = word.usphone || word.ukphone
  const labels = previewLabels(cards.get(word.name), { dict: dictId, word: word.name }, Date.now())

  const wordBlock = (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <span className="text-5xl font-medium text-gray-800 dark:text-gray-100">{word.name}</span>
        <WordPronunciationIcon key={word.name} word={word} lang="en" iconClassName="h-8 w-8" />
      </div>
      {phonetic && <span className="text-gray-500">[{phonetic}]</span>}
    </div>
  )
  const meaningBlock = (
    <ul className="space-y-1 text-center text-xl text-gray-800 dark:text-gray-100">
      {word.trans.map((meaning, i) => (
        <li key={i}>{meaning}</li>
      ))}
    </ul>
  )

  return (
    <Layout>
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            New {counts.new} · Due {counts.due}
          </span>
          <Button size="sm" variant="outline" onClick={finish}>
            Exit
          </Button>
        </div>

        <div className="flex min-h-[18rem] w-full flex-col items-center justify-center gap-6 rounded-xl bg-white p-8 shadow dark:bg-gray-800">
          <span className="text-xs uppercase tracking-wide text-gray-400">{item.kind === 'new' ? 'New' : 'Due'}</span>
          {reverse ? meaningBlock : wordBlock}
          {session.flipped ? (
            <>
              <hr className="w-1/2 border-gray-200 dark:border-gray-700" />
              {reverse ? wordBlock : meaningBlock}
            </>
          ) : (
            <Button variant="outline" onClick={onFlip}>
              Show answer (Space)
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="grid w-full grid-cols-4 gap-3">
          {GRADES.map((grade, index) => (
            <button
              key={grade}
              disabled={!session.flipped}
              onClick={() => onGrade(grade)}
              className={`flex flex-col items-center rounded-lg px-3 py-3 text-sm font-medium transition-opacity disabled:opacity-30 ${GRADE_STYLE[grade]}`}
            >
              <span>
                {GRADE_NAME[grade]} ({index + 1})
              </span>
              <span className="text-xs opacity-80">{labels[grade]}</span>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 3: Create the overview screen**

Create `src/pages/Study/Overview.tsx`:

```tsx
import type { SessionSummary } from './StudySession'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { buildQueue, nextDueTime, queueCounts, sanitizeNewPerDay } from '@/utils/srs/queue'
import type { QueueItem } from '@/utils/srs/queue'
import { useMemo, useState } from 'react'

type Props = {
  dictName: string
  words: Word[]
  progress: ICardProgress[]
  now: number
  newPerDay: number
  onNewPerDayChange: (value: number) => void
  reverse: boolean
  onReverseChange: (value: boolean) => void
  summary: SessionSummary | null
  onStart: (queue: QueueItem[]) => void
  onBack: () => void
}

export default function StudyOverview({
  dictName,
  words,
  progress,
  now,
  newPerDay,
  onNewPerDayChange,
  reverse,
  onReverseChange,
  summary,
  onStart,
  onBack,
}: Props) {
  const [limitText, setLimitText] = useState(String(newPerDay))
  const queue = useMemo(() => buildQueue({ words, progress, now, newPerDay }), [words, progress, now, newPerDay])
  const counts = queueCounts(queue)
  const next = useMemo(() => nextDueTime(words, progress, now), [words, progress, now])

  const commitLimit = () => {
    const value = sanitizeNewPerDay(limitText)
    setLimitText(String(value))
    onNewPerDayChange(value)
  }

  return (
    <Layout>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{dictName}</h1>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>

        {summary && (
          <p className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-700 dark:bg-gray-800 dark:text-indigo-300">
            Session finished: {summary.reviewed} cards reviewed{summary.again > 0 ? `, ${summary.again} marked Again` : ''}.
          </p>
        )}

        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          {words.length === 0 ? (
            <p className="text-gray-500">This set has no words yet.</p>
          ) : queue.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xl text-gray-800 dark:text-gray-100">Done for today</p>
              <p className="text-sm text-gray-500">
                {next === null ? 'Nothing is scheduled.' : `Next review: ${new Date(next).toLocaleString()}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-800 dark:text-gray-100">
                <span className="text-3xl font-medium">{counts.due}</span> due · <span className="text-3xl font-medium">{counts.new}</span>{' '}
                new
              </p>
              <Button onClick={() => onStart(queue)}>Start</Button>
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-lg bg-white p-6 text-sm text-gray-700 shadow dark:bg-gray-800 dark:text-gray-300">
          <label className="flex items-center justify-between gap-4">
            <span>New cards per day</span>
            <input
              type="number"
              min={0}
              max={500}
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              onBlur={commitLimit}
              className="w-24 rounded border border-gray-300 px-2 py-1 dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex items-center justify-between gap-4">
            <span>Show the meaning first</span>
            <input type="checkbox" checked={reverse} onChange={(e) => onReverseChange(e.target.checked)} />
          </label>
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 4: Create the route container**

Create `src/pages/Study/index.tsx`:

```tsx
import StudyOverview from './Overview'
import StudySession from './StudySession'
import type { SessionSummary } from './StudySession'
import Layout from '@/components/Layout'
import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending } from '@/store/customDicts'
import { newCardsPerDayAtom, studyReverseAtom } from '@/store/study'
import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { sanitizeNewPerDay } from '@/utils/srs/queue'
import type { QueueItem } from '@/utils/srs/queue'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

// Keyed by id so moving between two sets in place starts from a clean state
export default function StudyRoute() {
  const { dictId = '' } = useParams()
  const id = decodeURIComponent(dictId)
  return <Study key={id} id={id} />
}

function Study({ id }: { id: string }) {
  const navigate = useNavigate()
  const dictionaryById = useAtomValue(dictionaryByIdAtom)
  const customLoaded = useAtomValue(customDictionariesLoadedAtom)
  const [newPerDayStored, setNewPerDay] = useAtom(newCardsPerDayAtom)
  const [reverse, setReverse] = useAtom(studyReverseAtom)
  const newPerDay = sanitizeNewPerDay(newPerDayStored)

  const dict = dictionaryById[id]
  const pending = isCustomDictPending(id, customLoaded)

  useEffect(() => {
    if (!dict && !pending) navigate('/gallery', { replace: true })
  }, [dict, pending, navigate])

  const { data: words, error: wordsError } = useSWR(dict ? dict.url : null, wordListFetcher)
  const [progress, setProgress] = useState<ICardProgress[] | null>(null)
  const [progressError, setProgressError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)

  const reloadProgress = useCallback(async () => {
    try {
      setProgress(await getDictProgress(id))
      setNow(Date.now())
      setProgressError('')
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : 'Could not read your progress')
    }
  }, [id])

  useEffect(() => {
    reloadProgress()
  }, [reloadProgress])

  const onFinish = useCallback(
    (result: SessionSummary) => {
      setQueue(null)
      setSummary(result)
      reloadProgress()
    },
    [reloadProgress],
  )

  const message = (text: string, tone = 'text-gray-500') => (
    <Layout>
      <p className={`m-auto ${tone}`}>{text}</p>
    </Layout>
  )

  if (!dict) return message('Loading…')
  if (wordsError) return message('Could not load the words of this set.', 'text-red-600')
  if (progressError) return message(progressError, 'text-red-600')
  if (!words || !progress) return message('Loading…')

  if (queue) {
    return <StudySession dictId={id} queue={queue} progress={progress} reverse={reverse} onFinish={onFinish} />
  }

  return (
    <StudyOverview
      dictName={dict.name}
      words={words}
      progress={progress}
      now={now}
      newPerDay={newPerDay}
      onNewPerDayChange={setNewPerDay}
      reverse={reverse}
      onReverseChange={setReverse}
      summary={summary}
      onStart={setQueue}
      onBack={() => navigate('/my-sets')}
    />
  )
}
```

- [ ] **Step 5: Add the route**

In `src/index.tsx` add below the other lazy pages:

```tsx
const StudyPage = lazy(() => import('./pages/Study'))
```

and inside the non-mobile routes, after the `/my-sets/:id` route:

```tsx
<Route path="/study/:dictId" element={<StudyPage />} />
```

- [ ] **Step 6: Verify**

Run: `npx prettier --write src/store/study.ts src/pages/Study src/index.tsx && npx eslint src && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn test`
Expected: no eslint errors; tsc count `4`; all tests PASS. If `tsc` reports a type error in `useHotkeys` calls, keep the call shape `useHotkeys(keys, callback, options?, deps?)` as used in `src/pages/Typing/components/StartButton/index.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/store/study.ts src/pages/Study src/index.tsx
git commit -m "feat: add flashcard study page with spaced-repetition sessions"
```

---

### Task 5: Entry points and end-to-end verification

**Files:**

- Modify: `src/pages/MySets/index.tsx`, `src/pages/Typing/components/DictChapterButton/index.tsx`

**Interfaces:**

- Consumes: route `/study/:dictId` (Task 4); `customIdOf`, `isCustomDictId` from `@/utils/db/custom-dict` (P1).
- Produces: user-visible buttons only.

- [ ] **Step 1: "Study" button in `/my-sets`**

In `src/pages/MySets/index.tsx`, inside each set's button group, add a Study button before the Practice button:

```tsx
<Button size="sm" onClick={() => navigate(`/study/${encodeURIComponent(dict.id)}`)}>
  Study
</Button>
```

(Practice is the existing typing button; keep it after Study.)

- [ ] **Step 2: "Study" link in the typing page's dictionary menu**

In `src/pages/Typing/components/DictChapterButton/index.tsx`, add `import { isCustomDictId } from '@/utils/db/custom-dict'` and, right after the existing `NavLink` to `/gallery` (still inside the wrapping `Tooltip` siblings, before the `!isReviewMode` block), add:

```tsx
{
  isCustomDictId(currentDictInfo.id) && !isReviewMode && (
    <Tooltip content="Study with flashcards">
      <NavLink
        className="block rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
        to={`/study/${encodeURIComponent(currentDictInfo.id)}`}
      >
        Study
      </NavLink>
    </Tooltip>
  )
}
```

- [ ] **Step 3: Static checks**

Run: `npx prettier --write src/pages/MySets/index.tsx src/pages/Typing/components/DictChapterButton/index.tsx && npx eslint src && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn test && yarn build`
Expected: no eslint errors; tsc count `4`; all tests PASS; the production build finishes.

- [ ] **Step 4: Manual pass in the browser (`yarn dev`, http://localhost:5173)**

Prepare data: open `/my-sets`, "Copy a built-in dictionary" → "My Vocabulary" (555 words). Then check each item and fix anything that fails:

1. In `/my-sets` the copy shows a **Study** button; click it → overview shows `0 due · 20 new` and a Start button.
2. **Start** → first card shows the word, phonetic and a speaker icon; pressing **Space** reveals the meanings; the four buttons enable and show `10m`, `1d`, `1d`, `3d`.
3. Press **3** (Good) → next card; header drops to `New 19 · Due 0`. Grade one **1** (Again) → that card comes back at the end of the session.
4. Press **1**–**4** _before_ flipping → nothing happens. Press **3** twice very quickly after a flip → only one card is consumed.
5. **Exit** → overview says "Session finished: N cards reviewed"; counts show the remaining new cards (20 − N introduced today, so the limit is respected).
6. **Reload** the page and reopen Study → graded Good cards are gone from the queue and the new-card limit still counts today's cards (e.g. after studying 20 new cards the overview says "Done for today" with a next-review date).
7. Change "New cards per day" to `5`, blur the field → the count drops accordingly; set it to `abc`/empty → resets to 20; set `0` → only due cards (if any) remain.
8. Tick "Show the meaning first" → the front shows meanings and the word appears after flipping.
9. Open the typing page with the copied set selected → a **Study** link appears next to the dictionary name; it opens the same study page. With a built-in dictionary selected the link is **not** shown.
10. Open `/study/custom%3Anope` → redirects to `/gallery`. Delete the set in `/my-sets` → its `cardProgress` rows are gone (check in DevTools → Application → IndexedDB → RecordDB → cardProgress).
11. Inspect `cardProgress` rows in DevTools after grading: `dict` is `custom:<id>`, `due` is a ms timestamp, `state` is `review`/`learning`.

Console must show no new errors (the Youdao audio CORS error that already existed is expected).

- [ ] **Step 5: Record any deviation and commit**

If the manual pass revealed a deviation from the spec, add a short "Findings from P2 implementation" note at the end of `docs/superpowers/specs/2026-10-12-study-modes-design.md`.

```bash
git add src/pages/MySets/index.tsx src/pages/Typing/components/DictChapterButton/index.tsx docs/superpowers/specs/2026-10-12-study-modes-design.md
git commit -m "feat: add Study entry points in My Sets and the typing page"
```

(`git add` of the spec file is harmless when it did not change.)

---

## Self-review

**Spec coverage (P2 section):**

- Scheduler rules (new / review / learning, ease, interval rounding, start-of-day due) → Task 1 (tests mirror each spec line, plus clamps).
- Queue (due oldest-first, then new in set order, `newPerDay` default 20, introduced-today counts, in-session again at the end) → Task 2.
- UI `/study/:dictId`: word + phonetic + existing pronunciation hook, Space flip, reverse toggle, keys 1–4 and buttons with next interval, header counts, "Done for today" with next due date → Task 4.
- Entry points on each custom set card and the typing page's dictionary menu → Task 5.
- Acceptance (persists, reload keeps queue state, good cards do not reappear until due, new-card limit across reloads) → Task 3 (persistence), Task 2 (limit/boundary tests), Task 5 manual items 5–6.

**Placeholder scan:** none; every code step contains full code. The only conditional is the commit-hook reminder and the optional spec note.

**Type consistency:** `Grade`, `GRADES`, `CardIdentity`, `nextState(card, identity, grade, now)`, `previewLabels(card, identity, now)` (Task 1) are used with the same signatures in Tasks 3–4; `QueueItem`, `buildQueue`, `queueCounts`, `nextDueTime`, `sanitizeNewPerDay`, `DEFAULT_NEW_PER_DAY` (Task 2) are used consistently in Task 4; `getDictProgress`/`reviewCard(dict, word, grade, now?)` (Task 3) match their calls; `SessionSummary` is defined in `StudySession.tsx` and imported by `Overview.tsx` and `index.tsx`.
