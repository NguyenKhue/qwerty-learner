# R2: Dashboard Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home route `/` with a dashboard showing "Due today", "Continue" (current set, progress, change set) and four mode cards, using only data that already exists.

**Architecture:** A pure function `dashboardStats` (built on the existing `buildQueue`/`queueCounts`, `canQuiz`, `canPlay`) turns words + card progress + `now` into the numbers and mode states the page shows, so the logic is unit-tested. The page reads the current set with `useDictionaryWords`, progress with `useLiveQuery`, and keeps `now` fresh with a small hook. The shell's nav links switch to the resolved current set so an invalid stored id cannot produce dead links.

**Tech Stack:** React 18, jotai, dexie-react-hooks (`useLiveQuery`), SWR (through `useDictionaryWords`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md` (sections 6, 5; phase R2). Typing already lives at `/typing` from R1.

## Global Constraints

- Colors only through the R1 tokens (`bg-card`, `text-muted-foreground`, `bg-primary`, `bg-accent`, `border-border`, …); no raw gray/indigo classes in new code.
- Touch targets ≥ 44px, visible focus ring, no emoji as icons (`~icons/tabler/*`).
- tsconfig target es5: no iterating Map/Set iterators, no `flatMap`.
- Existing tests green; eslint warnings stay at 6; tsc errors stay at the baseline of 4.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; stage only the files named in each task.

## Review Focus

- An empty set (0 words): no divide-by-zero in the progress bar, no "Start review" button, a clear message.
- Duplicate words in a set count once; progress rows of words that were removed from the set are not counted as seen.
- Midnight rollover and a tab left open: "Due today" refreshes on focus, on visibility change and at the next due time/local midnight.
- The stored current-set id is invalid or a custom set is still loading: no crash, no links to a dead id.
- Quiz/Match disabled states explain why (needs N distinct meanings) and are not focusable links.

---

### Task 1: `dashboardStats`

**Files:**

- Create: `src/utils/dashboard/stats.ts`, `src/utils/dashboard/stats.test.ts`

**Interfaces:**

- Consumes: `buildQueue`, `queueCounts` (`@/utils/srs/queue`), `canQuiz`, `distinctMeaningCount`, `MIN_DISTINCT_MEANINGS` (`@/utils/quiz/questions`), `canPlay`, `PAIR_COUNT` (`@/utils/match/board`).
- Produces:

```ts
export type ModeState = { enabled: boolean; reason: string | null }
export type DashboardStats = { due: number; newToday: number; seen: number; total: number; quiz: ModeState; match: ModeState }
export function dashboardStats(input: { words: Word[]; progress: ICardProgress[]; now: number; newPerDay: number }): DashboardStats
```

- [ ] **Step 1: Write the failing tests** (`stats.test.ts`)

```ts
import { dashboardStats } from './stats'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { startOfLocalDay } from '@/utils/srs/time'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const TODAY = startOfLocalDay(NOW)
const word = (name: string, meaning = `n. meaning of ${name}`): Word => ({ name, trans: [meaning], usphone: '', ukphone: '' })
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
const stats = (words: Word[], progress: ICardProgress[] = [], newPerDay = 20) => dashboardStats({ words, progress, now: NOW, newPerDay })

describe('dashboardStats counts', () => {
  it('is all zero for an empty set', () => {
    expect(stats([])).toMatchObject({ due: 0, newToday: 0, seen: 0, total: 0 })
  })
  it('counts due, new, seen and total', () => {
    const words = ['a', 'b', 'c'].map((n) => word(n))
    const result = stats(words, [card('a', { due: NOW - 1000 }), card('b')])
    expect(result).toMatchObject({ due: 1, newToday: 1, seen: 2, total: 3 })
  })
  it('counts a duplicated word once', () => {
    expect(stats([word('a'), word('a'), word('b')])).toMatchObject({ total: 2, newToday: 2 })
  })
  it('ignores progress rows of words that are not in the set', () => {
    expect(stats([word('a')], [card('a'), card('gone', { due: NOW - 1 })])).toMatchObject({ due: 0, seen: 1, total: 1 })
  })
  it('caps new cards by the daily limit, minus those first seen today', () => {
    const words = ['a', 'b', 'c', 'd', 'e'].map((n) => word(n))
    expect(stats(words, [], 2).newToday).toBe(2)
    expect(stats(words, [card('a', { firstSeen: TODAY + 1000 })], 1).newToday).toBe(0)
  })
})

describe('dashboardStats mode states', () => {
  const distinct = (count: number) => Array.from({ length: count }, (_, i) => word(`w${i}`, `n. meaning ${i}`))
  it('enables Quiz from 4 distinct meanings and explains why not below', () => {
    expect(stats(distinct(4)).quiz).toEqual({ enabled: true, reason: null })
    expect(stats(distinct(3)).quiz).toEqual({ enabled: false, reason: 'Needs at least 4 words with different meanings' })
  })
  it('enables Match from 6 distinct meanings and explains why not below', () => {
    expect(stats(distinct(6)).match).toEqual({ enabled: true, reason: null })
    expect(stats(distinct(5)).match).toEqual({ enabled: false, reason: 'Needs at least 6 words with different meanings' })
  })
  it('does not count words that share a meaning or have none', () => {
    const words = [word('a', 'same'), word('b', 'same'), word('c', 'same'), word('d', 'same'), { ...word('e'), trans: [] }]
    expect(stats(words).quiz.enabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/utils/dashboard/stats.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `stats.ts`**

```ts
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'
import { PAIR_COUNT, canPlay } from '@/utils/match/board'
import { MIN_DISTINCT_MEANINGS, canQuiz } from '@/utils/quiz/questions'
import { buildQueue, queueCounts } from '@/utils/srs/queue'

export type ModeState = { enabled: boolean; reason: string | null }
export type DashboardStats = { due: number; newToday: number; seen: number; total: number; quiz: ModeState; match: ModeState }

const needs = (count: number): string => `Needs at least ${count} words with different meanings`

export function dashboardStats(input: { words: Word[]; progress: ICardProgress[]; now: number; newPerDay: number }): DashboardStats {
  const names = new Set<string>()
  input.words.forEach((word) => names.add(word.name))
  const seenNames = new Set<string>()
  input.progress.forEach((card) => {
    if (names.has(card.word)) seenNames.add(card.word)
  })
  const counts = queueCounts(buildQueue(input))
  return {
    due: counts.due,
    newToday: counts.new,
    seen: seenNames.size,
    total: names.size,
    quiz: canQuiz(input.words) ? { enabled: true, reason: null } : { enabled: false, reason: needs(MIN_DISTINCT_MEANINGS) },
    match: canPlay(input.words) ? { enabled: true, reason: null } : { enabled: false, reason: needs(PAIR_COUNT) },
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `yarn vitest run src/utils/dashboard/stats.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/dashboard/stats.ts src/utils/dashboard/stats.test.ts
git commit -m "feat: add dashboard statistics"
```

---

### Task 2: Dashboard page, route, and nav fix

**Files:**

- Create: `src/hooks/useNow.ts`, `src/pages/Dashboard/index.tsx`
- Modify: `src/index.tsx` (index route), `src/components/AppShell/index.tsx` (nav uses the resolved set)

**Interfaces:**

- Consumes: `dashboardStats`, `useDictionaryWords(id)`, `getDictProgress(dict)`, `readBest`/`formatDuration` (`@/utils/match/best`), `newCardsPerDayAtom` + `sanitizeNewPerDay`, `nextRefreshDelay`/`nextDueTime`, `currentDictInfoAtom`, `buildNavItems`.
- Produces: `useNow(nextDue: number | null): number` (re-renders with a fresh `Date.now()` on focus, on visibility, and at `nextRefreshDelay`); default export `Dashboard`.

- [ ] **Step 1: `useNow.ts`**

```ts
import { nextRefreshDelay } from '@/utils/srs/queue'
import { useEffect, useState } from 'react'

/** The current time, refreshed when the tab regains focus or visibility and when the next card falls due or the day changes. */
export function useNow(nextDue: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = window.setTimeout(refresh, nextRefreshDelay(Date.now(), nextDue))
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [nextDue, now])
  return now
}
```

- [ ] **Step 2: AppShell uses the resolved set**

In `src/components/AppShell/index.tsx` remove the `currentDictIdAtom` read; compute `const dict = useAtomValue(currentDictInfoAtom)` once in `AppShell` and `const items = useMemo(() => buildNavItems(dict.id), [dict.id])`. (`Sidebar` keeps reading `currentDictInfoAtom` for the name.) Drop the unused `currentDictIdAtom` import.

- [ ] **Step 3: `Dashboard/index.tsx`**

Page structure (inside the shell, so no `Layout`/`Header`): `<div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8">` with:

1. `<h1 className="text-2xl font-semibold">` "Today".
2. **Due card** (`rounded-xl border border-border bg-card p-6`): big numbers `stats.due` "due" and `stats.newToday` "new". Primary `Link` to `/study/<encoded id>` labelled "Start review" when `due + newToday > 0`; otherwise text "All caught up" (when `total > 0`) with, if `newPerDay` allows nothing more today, "Come back tomorrow"; when `total === 0` the text "This set has no words yet" and a link "Manage my sets" to `/my-sets`.
3. **Continue card**: set name, `seen / total words` and a progress bar (`role="progressbar"` with `aria-valuenow/min/max`, width `total === 0 ? 0 : seen/total` clamped, `bg-accent` fill on a `bg-muted` track), and a "Change set" `Link` to `/gallery`.
4. **Mode grid** (`grid gap-4 sm:grid-cols-2`): Typing (`/typing`), Flashcards (`/study/<id>`), Quiz (`/quiz/<id>`), Match (`/match/<id>`). Each card is a `Link` with icon, title, one-line description. Disabled modes render a `div` with `aria-disabled="true"` and the `reason` text, no link. Match shows "Best time m:ss.t" when `readBest(dict.id)` is not null.
5. States: while words or progress are loading render skeleton blocks (`animate-pulse bg-muted`); if `error` render "Could not load this set" with a "Change set" link.

Data wiring:

```tsx
const dict = useAtomValue(currentDictInfoAtom)
const { words, error } = useDictionaryWords(dict.id)
const progress = useLiveQuery(() => getDictProgress(dict.id), [dict.id])
const newPerDay = sanitizeNewPerDay(useAtomValue(newCardsPerDayAtom))
const nextDue = useMemo(() => (words && progress ? nextDueTime(words, progress, Date.now()) : null), [words, progress])
const now = useNow(nextDue)
const stats = useMemo(
  () => (words && progress ? dashboardStats({ words, progress, now, newPerDay }) : null),
  [words, progress, now, newPerDay],
)
const items = useMemo(() => buildNavItems(dict.id), [dict.id])
const link = (id: NavItem['id']) => items.find((i) => i.id === id)?.to ?? '/'
```

- [ ] **Step 4: Route** — in `src/index.tsx` add `const DashboardPage = lazy(() => import('./pages/Dashboard'))` and change `<Route index element={<TypingGate />} />` to `<Route index element={<DashboardPage />} />`.

- [ ] **Step 5: Typecheck, lint, suite**

Run: `yarn tsc --noEmit 2>&1 | grep -c "error TS"` (expect 4), `yarn eslint src --max-warnings 6`, `yarn vitest run`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useNow.ts src/pages/Dashboard src/index.tsx src/components/AppShell/index.tsx
git commit -m "feat: add dashboard home"
```

---

### Task 3: Browser verification

- [ ] **Step 1:** Start the dev server; open `/` at 1280 and 375 (light and dark). Check each Review Focus item: an empty custom set (create one on `/my-sets`), a 3-word set (Quiz disabled with reason, Match disabled), a built-in set (all enabled, numbers plausible), an invalid stored id (`localStorage.currentDict = '"nope"'` → falls back to CET-4, links point to `/study/cet4`), and tab refocus after changing the system clock is not required.
- [ ] **Step 2:** Run one Flashcards review from the dashboard link, return to `/`, and confirm "due/new" changed (live query).
- [ ] **Step 3:** Fix findings (tests for pure-function bugs), run the full suite, append "Findings: R2" to the spec and commit.
