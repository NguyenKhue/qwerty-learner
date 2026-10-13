# R6: Weekly Activity and Streak Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "This week" card to the dashboard: a 7-day bar chart of cards reviewed and words typed, and the current day streak.

**Architecture:** A new Dexie table `reviewLog` records one row per graded flashcard or scheduling-relevant quiz answer, written in the same transaction as the card update. Typing activity is read from the existing `wordRecords` (`timeStamp` in epoch seconds). Pure functions (`buildActivity`, `computeStreak`) turn timestamps into per-day counts and a streak; one DB function loads the timestamps; the dashboard renders them.

**Tech Stack:** Dexie 3 (`version(5)`), dexie-react-hooks, Vitest + fake-indexeddb, React, Tailwind tokens.

**Spec:** `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md` (sections 1 and 10: weekly activity and streak, which "need a review-history table")

## Global Constraints

- Local days (`startOfLocalDay`, `addLocalDays`), never UTC days. DST-safe stepping with `addLocalDays`.
- Existing tables and the export/import feature keep working; the new table is additive (schema version 5, no data migration).
- Colors through tokens; bars are decorative (`aria-hidden`), the data is available as text for assistive tech.
- tsconfig target es5: no iterating Map/Set iterators, no `flatMap`.
- Tests, tsc (4 baseline errors) and eslint (6 baseline warnings) stay at baseline. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A review at 23:59 and another at 00:01 count on two different days; the streak survives midnight (today empty, yesterday active is still a live streak).
- A quiz answer that does not change the schedule (`srsEffect` returns null) must not count as a review.
- A failed card write must not leave a log row (same transaction).
- Typing activity from before the table existed is still counted; reviews from before it existed are not (there is no history to recover).
- A clock change (travelling, DST) must not create negative or duplicate days.
- Data export/import (`dexie-export-import`) includes or tolerates the new table.

---

### Task 1: `reviewLog` table, written with every review

**Files:** Modify `src/utils/db/database.ts`, `src/utils/db/record.ts`, `src/utils/db/card-progress.ts`, `src/utils/db/card-progress.test.ts`

**Interfaces:**

- Produces: `interface IReviewLogEntry { id?: number; at: number; dict: string; word: string; kind: 'flashcard' | 'quiz' }`; `db.reviewLog: Table<IReviewLogEntry, number>` with indexes `++id,at,dict`.

- [ ] **Step 1: Failing tests** (append to `card-progress.test.ts`; its `beforeEach` also clears `db.reviewLog`): `reviewCard('d','a','good',NOW)` adds one row `{at: NOW, dict:'d', word:'a', kind:'flashcard'}`; `reviewQuizAnswer` with a wrong answer adds a `quiz` row; a correct answer on a never-studied word (no effect) adds none; a correct answer on a due card adds one; when the transaction throws (stub `db.cardProgress.put` to reject once) no log row remains.
- [ ] **Step 2:** `yarn vitest run src/utils/db/card-progress.test.ts` fails.
- [ ] **Step 3: Implement.** `database.ts`: add `reviewLog!: Table<IReviewLogEntry, number>` and `this.version(5).stores({ ...v4 stores, reviewLog: '++id,at,dict' })`. In `reviewCard` and `reviewQuizAnswer` add `db.reviewLog` to the transaction table list and `await db.reviewLog.add({ at: now, dict, word, kind })` right after the card `put`.
- [ ] **Step 4:** tests pass; `yarn tsc`; commit `feat: log every card review`.

### Task 2: Pure activity functions

**Files:** Create `src/utils/activity/activity.ts`, `src/utils/activity/activity.test.ts`

**Interfaces:**

- Produces:

```ts
export type DayActivity = { start: number; reviews: number; typed: number }
export const ACTIVITY_DAYS = 7
export function buildWeek(input: { reviewTimes: number[]; typedTimes: number[]; now: number }): DayActivity[] // 7 entries, oldest first, last is today
export function computeStreak(activeDayStarts: number[], now: number): number
```

- [ ] **Step 1: Failing tests:** `buildWeek` returns 7 days ending today with zero counts for empty input; counts land on the right local day (23:59 and 00:01 split); timestamps older than 7 days or in the future are ignored; DST-safe (use a date range around a DST change in the test, `new Date(2026, 2, 8)` etc. built from local components). `computeStreak`: 0 for none; counts consecutive days ending today; if today is empty but yesterday active the streak counts back from yesterday; a gap breaks it; duplicates in the input are fine; unsorted input is fine; days after today are ignored.
- [ ] **Step 2:** fail. **Step 3:** implement with `startOfLocalDay`/`addLocalDays`, a `Set` of day starts (lookup with `has`, no iteration). **Step 4:** pass; commit `feat: add weekly activity and streak calculations`.

### Task 3: Load the activity from the database

**Files:** Create `src/utils/db/activity.ts`, `src/utils/db/activity.test.ts`

**Interfaces:**

- Consumes: `buildWeek`, `computeStreak`, `db.reviewLog`, `db.wordRecords`.
- Produces: `loadActivity(now: number): Promise<{ week: DayActivity[]; streak: number }>`; `STREAK_WINDOW_DAYS = 365`.

- [ ] **Step 1: Failing tests (fake-indexeddb):** reviews and word records on several days produce the right week and streak; word `timeStamp` is epoch seconds (a record stamped `Math.floor(ms / 1000)` lands on the right day); activity older than the window is ignored; empty database gives 7 zero days and streak 0.
- [ ] **Step 2:** fail. **Step 3:** implement: `from = addLocalDays(now, -STREAK_WINDOW_DAYS)`; collect `reviewLog.where('at').aboveOrEqual(from)` timestamps and `wordRecords.where('timeStamp').aboveOrEqual(Math.floor(from / 1000))` timestamps (×1000) with `.each`; active day starts = `startOfLocalDay` of each; return `buildWeek` and `computeStreak`. **Step 4:** pass; commit `feat: load weekly activity from the database`.

### Task 4: "This week" card on the dashboard

**Files:** Create `src/pages/Dashboard/WeekCard.tsx`; Modify `src/pages/Dashboard/index.tsx`

- [ ] **Step 1:** `WeekCard({ week, streak })`: a `Panel` with the title "This week", the streak ("N day streak", or "Start a streak today" for 0; singular "1 day streak"), a legend (cards reviewed = `bg-primary`, words typed = `bg-accent`), and 7 columns of stacked bars scaled to the week's maximum (min height 2px when non-zero), weekday labels from `toLocaleDateString(undefined, { weekday: 'short' })`, today highlighted. Bars `aria-hidden`; a `ul.sr-only` lists "Mon: 12 cards reviewed, 30 words typed". An all-zero week shows "No activity yet this week" instead of empty bars.
- [ ] **Step 2:** in `Dashboard`, `const activity = useLiveQuery(() => loadActivity(now), [now])`; render `<WeekCard>` after the Current set card when loaded (skeleton while loading).
- [ ] **Step 3:** `yarn tsc`, `yarn eslint`, `yarn vitest run`; verify in the browser (seed rows through `/src/utils/db/...` imports in the console, check bars, streak, empty state, dark mode, 375px); append "Findings: R6" to the spec; commit `feat: show weekly activity and streak on the dashboard`.
