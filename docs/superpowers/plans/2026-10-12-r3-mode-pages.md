# R3: Mode Pages on the Current Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flashcards, Quiz and Match open the app's current set from `/study`, `/quiz` and `/match`, work on built-in and custom sets, and use the design tokens and the shell instead of their own `Layout`.

**Architecture:** The mode routes lose `:dictId` and read `currentDictInfoAtom`. The old `/:mode/:dictId` URLs stay as a small redirect component that validates the id (pure `classifyDictId`), makes it the current set, and navigates to `/:mode`. A tiny `ModePage`/`Panel`/`PageMessage` kit replaces the repeated page chrome. `Button` moves to tokens.

**Tech Stack:** React 18, react-router 6, jotai, Vitest (fake-indexeddb).

**Spec:** `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md` (sections 5, 7; phase R3)

## Global Constraints

- Colors only through tokens in new/changed code; no raw `gray-*`/`indigo-*` except amber for the "Hard" grade (`amber-700`, white text, 5.0:1).
- Touch targets ≥ 44px on buttons used by these pages; visible focus ring; keyboard shortcuts of the three modes unchanged.
- Reducers, scheduler, quiz and match logic and their tests are untouched.
- tsconfig target es5; existing tests green; eslint warnings stay at 6; tsc errors stay at the baseline of 4.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; stage only the files named in each task.

## Review Focus

- `/study/constructor` (a name that exists on `Object.prototype`) must be treated as an unknown set, not selected.
- `/quiz/custom%3Aabc` while custom sets are still loading must wait, then select it, not bounce to the Library.
- Visiting an old `/study/<id>` link changes the current set; the sidebar switcher and the dashboard must agree afterwards.
- A built-in set (`cet4`) can be graded, quizzed and matched: progress rows are keyed by the built-in id and survive a reload.
- Switching the current set while on `/study` starts a clean session (no state of the previous set).

---

### Task 1: Current-set routes and redirects

**Files:**
- Modify: `src/store/customDicts.ts`, `src/store/customDicts.test.ts`, `src/components/AppShell/navItems.ts`, `src/components/AppShell/navItems.test.ts`, `src/index.tsx`, `src/pages/Study/index.tsx`, `src/pages/Quiz/index.tsx`, `src/pages/Match/index.tsx`, `src/pages/Typing/components/DictChapterButton/index.tsx`
- Create: `src/components/SelectDictRedirect.tsx`

**Interfaces:**
- Produces: `classifyDictId(id: string, customLoaded: boolean, byId: Record<string, Dictionary>): 'valid' | 'pending' | 'unknown'`; `SelectDictRedirect({ mode }: { mode: 'study' | 'quiz' | 'match' })`; nav items whose `to` is `/study`, `/quiz`, `/match`.

- [ ] **Step 1: Failing tests.** In `customDicts.test.ts` add: `classifyDictId('cet4', false, byId)` is `'valid'`; `classifyDictId('custom:abc', false, byId)` is `'pending'`, and `'unknown'` once `customLoaded` is true; `classifyDictId('nope', true, byId)` is `'unknown'`; `classifyDictId('constructor', true, byId)` and `'toString'` are `'unknown'`; `shouldResetDictId('constructor', true, byId)` is `true`. In `navItems.test.ts` replace the encoding test with: the mode items point at `/study`, `/quiz`, `/match` for any dict id, and `isNavActive` matches `/study` and `/study/anything` for the Flashcards item.
- [ ] **Step 2: Run, expect FAIL** (`yarn vitest run src/store src/components/AppShell`).
- [ ] **Step 3: Implement.** `classifyDictId` uses `lookupDictionary`; `shouldResetDictId` returns `classifyDictId(...) === 'unknown'`. `buildNavItems()` takes no argument and returns fixed `to` values (callers drop the argument).
- [ ] **Step 4: `SelectDictRedirect`.** Reads `useParams().dictId`, `dictionaryByIdAtom`, `customDictionariesLoadedAtom`, `currentDictIdAtom`, `currentChapterAtom`. `valid`: in an effect set the current dict id (and chapter to 0 when it changed) then render `<Navigate to={'/' + mode} replace />`; `pending`: render `Loading`; `unknown`: `<Navigate to="/gallery" replace />`.
- [ ] **Step 5: Routes.** In `src/index.tsx`: `/study`, `/quiz`, `/match` render the pages; `/study/:dictId`, `/quiz/:dictId`, `/match/:dictId` render `SelectDictRedirect`.
- [ ] **Step 6: Pages read the current set.** The three `XRoute` wrappers become `const dict = useAtomValue(currentDictInfoAtom); return <X key={dict.id} id={dict.id} />`. Their `onBack` fallback for `location.key === 'default'` becomes `navigate('/')`.
- [ ] **Step 7: Remove the custom-only Study/Quiz/Match links from `DictChapterButton`** (the shell navigation replaces them) and drop the now unused imports. `Dashboard`, `KeyboardNotice` and `AppShell` stop passing a dict id to `buildNavItems`.
- [ ] **Step 8: Run `yarn vitest run`, `yarn tsc --noEmit | grep -c "error TS"` (4), `yarn eslint src --max-warnings 6`; commit** `src/store src/components/AppShell src/components/SelectDictRedirect.tsx src/index.tsx src/pages/Study/index.tsx src/pages/Quiz/index.tsx src/pages/Match/index.tsx src/pages/Typing/components/DictChapterButton src/pages/Dashboard src/pages/Typing/KeyboardNotice.tsx` with `feat: open Flashcards, Quiz and Match on the current set`.

---

### Task 2: Built-in sets keep progress

**Files:** Modify `src/utils/db/card-progress.test.ts`.

- [ ] **Step 1:** Add tests: `reviewCard('cet4', 'abandon', 'good')` then `getDictProgress('cet4')` returns that row and `getDictProgress('cet6')` is empty; `reviewQuizAnswer('cet4', 'abandon', false)` on an unseen built-in word creates an `again`-graded row (decided by `srsEffect`), and a correct answer on a card that is not due leaves it unchanged.
- [ ] **Step 2:** Run `yarn vitest run src/utils/db/card-progress.test.ts`; fix only if they fail (the code is keyed by plain strings, so they should pass immediately: say so in the ledger, a test that cannot fail first documents existing behavior).
- [ ] **Step 3:** Commit `test: built-in sets keep card progress`.

---

### Task 3: Tokens for `Button`, mode page kit, restyle the three modes

**Files:**
- Create: `src/components/ModePage.tsx`
- Modify: `src/components/ui/button.tsx`, `src/pages/Study/{index,Overview,StudySession}.tsx`, `src/pages/Quiz/{index,Setup,QuizRun}.tsx`, `src/pages/Match/{index,MatchBoard}.tsx`

**Interfaces:**
- Produces from `ModePage.tsx`: `ModePage({ title, onBack, children })` (centered column `max-w-xl`, `h1`, outline "Back" button, children), `Panel({ className?, children })` (`rounded-xl border border-border bg-card p-6 text-card-foreground`), `PageMessage({ text, tone? })` (`'muted' | 'error'`, centered in the available space).

- [ ] **Step 1: `Button` variants on tokens.** `default`: `bg-primary text-primary-foreground hover:bg-primary/90`; `destructive`: `bg-destructive text-destructive-foreground hover:bg-destructive/90`; `outline`: `border border-border bg-card text-foreground hover:bg-muted`; `secondary`: `bg-muted text-foreground hover:bg-muted/80`; `ghost`: `hover:bg-muted`; `link`: `text-primary underline-offset-4 hover:underline`. Base: focus ring `focus-visible:ring-ring focus-visible:ring-offset-background`. Sizes: `default: 'h-11 px-4 py-2'`, `sm: 'h-10 rounded-md px-3'`.
- [ ] **Step 2: Write `ModePage.tsx`.**
- [ ] **Step 3: Study.** Replace `Layout` with the kit: `message()` becomes `PageMessage`; `StudyOverview` uses `ModePage` + `Panel`s (summary banner `bg-primary/10 text-primary`, inputs `border border-border bg-background`); `StudySession` replaces `Layout` with a plain fragment inside `ScrollCenter`, card `Panel`-style with `p-8`, text colors `text-foreground`/`text-muted-foreground`, grade buttons: again `bg-destructive text-destructive-foreground`, hard `bg-amber-700 text-white`, good `bg-primary text-primary-foreground`, easy `bg-accent text-accent-foreground`, each `min-h-[56px]`; errors `text-destructive`.
- [ ] **Step 4: Quiz.** Same treatment: `QuizSetup` with `ModePage`/`Panel`; `QuizRun` options `border border-border bg-card hover:bg-muted`, answered states `bg-accent text-accent-foreground` (correct), `bg-destructive text-destructive-foreground` (wrong chosen), others `text-muted-foreground`; options `min-h-[48px]`.
- [ ] **Step 5: Match.** `MatchBoard` tiles: idle `border border-border bg-card hover:bg-muted`, selected `bg-primary text-primary-foreground`, wrong `bg-destructive text-destructive-foreground`; result panel with `Panel`; the intro screen with `ModePage`/`Panel`.
- [ ] **Step 6:** `yarn tsc`, `yarn eslint src --max-warnings 6`, `yarn vitest run`; commit `src/components/ModePage.tsx src/components/ui/button.tsx src/pages/Study src/pages/Quiz src/pages/Match` with `feat: restyle Flashcards, Quiz and Match with the design tokens`.

---

### Task 4: Browser verification

- [ ] Run each mode end to end on `cet4` and on a custom set at 1280, 900 and 375 in light and dark: Study (flip, grade with keys 1–4 and with taps, finish), Quiz (answer with keys 1–4, Enter for next, finish), Match (play to the end, best time shown on the dashboard afterwards).
- [ ] Old links: `/study/custom%3A<id>` selects that set and lands on `/study`; `/quiz/nope` and `/study/constructor` go to `/gallery`; the current set persists after reload.
- [ ] Switching the current set from the Library while on a mode page shows the new set with a fresh session.
- [ ] No horizontal scroll at 375; tab bar visible; contrast of the grade buttons and answer states looks right; console has no new errors.
- [ ] Fix findings, append "Findings: R3" to the spec, run the full suite and commit.
