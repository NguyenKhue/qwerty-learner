# Sentences Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new mode at `/sentences` where the learner types whole example sentences of the current set, either copying a visible sentence (default) or recalling it from its translation (hide toggle), then sees speed, accuracy and the sentences they struggled with.

**Architecture:** Built like Quiz/Match: a route component that owns the stage (`setup` → `run` → `result`), a Setup, a Run and a Result screen. All rules (what is playable, finding the target word, the per-sentence typing state machine, the session, sampling, the summary) are pure functions in `src/utils/sentences/` with unit tests; React components only render and forward key events. No database access, no SRS writes.

**Tech Stack:** TypeScript, React 18, jotai (`atomWithStorage`), react-router, SWR, `react-hotkeys-hook` (optional), Tailwind/shadcn tokens, Vitest (jsdom, `src/**/*.test.ts` only).

**Spec:** `docs/superpowers/specs/2026-10-19-sentences-mode-design.md` (read it first; it holds every behaviour and the measured data behind the playable-sentence rule).

## Global Constraints

- Path alias `@/` = `src/`. Tests sit next to the code as `*.test.ts`, run with `npx vitest run <path>`; no component tests (UI is verified in the browser).
- Style: no semicolons, single quotes, 2-space indent, 140 columns, short `/** */` comments like `src/utils/quiz/session.ts`. Tailwind/shadcn tokens only, no new colours. No new dependencies.
- Pure logic never imports React, jotai or Dexie. The mode must not import anything from `@/utils/db/*` (no card progress, no review log).
- Reuse, do not copy: `shuffle(items, rng)` and `sanitizeQuizLength`/`QuizLength` from `@/utils/quiz/questions`; `ModeFrame`, `ModePage`, `ScrollCenter`, `Card`, `Button`, `SetProgress` as Quiz does; `useDictionaryWords`, `useCurrentDictId`, `fetchWordExtras`/`attachExtras`/`sidecarUrlOf` from `@/utils/detail/sidecar`; `isActivatableButton` from `@/utils/keyboard`.
- Playable sentence: trimmed `text` non-empty, at most 200 characters, every character printable ASCII (0x20–0x7E) after the equivalences `’ ‘`→`'`, `“ ”`→`"`, `– —`→`-`, non-breaking space→space.
- Run length options `10 | 20 | 'all'`, default 10, remembered; hide toggle remembered; sentence-with-no-`trans` plays in copy mode even when hide is on.
- Peek counts as exactly one mistake. WPM = (typed characters / 5) / typing minutes. Result lists at most 50 sentences, then "and N more".
- Delegated tasks (opencode, `opencode/deepseek-v4.1-flash-free`): the worker must NOT run build/test/lint commands and must NOT commit; the main session runs `npx vitest run` / `npx tsc --noEmit -p .` after each delegated batch and commits. Known pre-existing `tsc` errors only in `src/utils/mixpanel.ts` and `src/utils/trackEvent.ts`.

## Review Focus

- A sentence typed with the other kind of quote/dash (curly in data, straight typed, and the reverse) must be accepted, never a dead end (Task 1 pool test, Task 2 turn test).
- A headword with regex characters (`c++`, `well-known`, `(a)`, `e.g.`) must never throw while highlighting and must still highlight when it appears literally (Task 1 highlight test).
- Keys that are not characters (Shift, Backspace, Enter, Tab, dead keys), and any key after the sentence is complete, must leave the turn unchanged (Task 2 turn test).
- Advancing twice (timer plus a second trigger) must not skip a sentence or record a result twice (Task 2 session test).
- Run length larger than the pool, `'all'`, an empty pool, and hide-on with a pool that has few translations: no repeats, no crash, empty run for an empty pool (Task 2 run test).
- A held-down key (auto-repeat) must not type or burn through wrong keys (UI rule in Task 5, verified in the browser in Task 6).

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/sentences/types.ts` (create) | `SentenceItem`, `SentenceLength` |
| `src/utils/sentences/pool.ts` (create) | character equivalences, `isPlayable`, `buildPool`, `poolFor` |
| `src/utils/sentences/highlight.ts` (create) | `findTarget` |
| `src/utils/sentences/turn.ts` (create) | per-sentence state machine |
| `src/utils/sentences/session.ts` (create) | run state, advance, summary |
| `src/utils/sentences/run.ts` (create) | `buildRun`, `sanitizeSentenceLength`, `sanitizeHide` |
| `src/store/sentences.ts` (create) | `sentencesLengthAtom`, `sentencesHideAtom` |
| `src/hooks/useExampleWords.ts` (create) | words of a set with sidecar extras attached |
| `src/pages/Sentences/index.tsx`, `Setup.tsx`, `Run.tsx`, `TypingLine.tsx`, `Result.tsx` (create) | the screens |
| `src/components/AppShell/navItems.ts`, `index.tsx`, `navItems.test.ts` (modify) | nav item + More link + icon |
| `src/components/SelectDictRedirect.tsx`, `src/index.tsx` (modify) | `/sentences`, `/sentences/:dictId` |

Order and delegation:

```
T0 (main: types, store) ─┬─ T1 (opencode: pool, highlight) ─┐
                         └─ T2 (opencode: turn, session, run)─┼─ T3 (main: hook, nav, routes) ─ T4 (opencode: Setup, Result, index)
                                                              │                                  T5 (opencode: Run, TypingLine)   ← T4 and T5 in parallel
                                                              └──────────────────────────────────────────── T6 (main: wire-up check, browser verification, review)
```

T1 and T2 run in parallel after T0. T4 and T5 run in parallel after T1–T3 (they only share the prop interfaces fixed below).

---

### Task 0: Shared types and remembered settings (main session)

**Files:**
- Create: `src/utils/sentences/types.ts`, `src/store/sentences.ts`

**Interfaces:**
- Produces:
  - `export type SentenceItem = { word: Word; text: string; trans?: string }` — `text` is already normalised to typeable ASCII (see Task 1).
  - `export type SentenceLength = QuizLength` (`10 | 20 | 'all'`)
  - `sentencesLengthAtom = atomWithStorage<SentenceLength>('sentencesLength', 10)`, `sentencesHideAtom = atomWithStorage<boolean>('sentencesHide', false)`

- [ ] **Step 1:** Create both files with exactly the exports above (types import `Word` from `@/typings`, `QuizLength` from `@/utils/quiz/questions`).
- [ ] **Step 2:** `npx tsc --noEmit -p .` shows no new error.
- [ ] **Step 3: Commit** `feat: sentences mode types and remembered settings`

---

### Task 1: Playable pool and target word (delegate)

**Files:**
- Create: `src/utils/sentences/pool.ts`, `src/utils/sentences/highlight.ts`
- Test: `src/utils/sentences/pool.test.ts`, `src/utils/sentences/highlight.test.ts`

**Interfaces:**
- Consumes: `SentenceItem` (Task 0), `Word.examples` from `@/typings`.
- Produces:
  - `normalizeTypedChar(ch: string): string` — maps one character through the equivalences (`’ ‘`→`'`, `“ ”`→`"`, `– —`→`-`, ` `→` `); any other character is returned unchanged.
  - `normalizeSentence(text: string): string` — `normalizeTypedChar` over every character, after trimming.
  - `isPlayable(text: string): boolean` — the Global Constraints rule, applied to the normalised trimmed text.
  - `buildPool(words: Word[]): SentenceItem[]` — flatten each word's `examples` in order, keep the playable ones, `text` = `normalizeSentence(example.text)`, `trans` only when non-empty after trim; words without `examples` contribute nothing.
  - `poolFor(pool: SentenceItem[], hide: boolean): SentenceItem[]` — the same array when `hide` is false, otherwise only items that have `trans`.
  - `findTarget(text: string, headword: string): { start: number; end: number } | null` — `end` exclusive; case-insensitive whole-word match first; otherwise the first word that starts with the headword, the range covering that whole word; otherwise `null`. "Word" characters are `[A-Za-z0-9]`. Must not use regex lookbehind (older Safari) and must escape the headword.

- [ ] **Step 1: Write the failing tests**
  - `pool.test.ts`: `normalizeTypedChar('’')` → `"'"`, `'“'` → `'"'`, `'—'` → `'-'`, `' '` → `' '`, `'a'` → `'a'`; `normalizeSentence('  It’s “fine” — really  ')` → `` `It's "fine" - really` ``; `isPlayable` true for `'Enable strict mode.'`, false for `''`, `'   '`, a 201-character string, true for exactly 200; false for `'Xin chào'` and for text containing `\t` or `\n`; true for a text with only an em dash as non-ASCII. `buildPool`: words `[{name:'strict', examples:[{text:'Be strict.', trans:'Hãy nghiêm.'},{text:'Xin chào',trans:'x'},{text:'  '}]}, {name:'plain'}]` → exactly one item `{ word: <strict>, text:'Be strict.', trans:'Hãy nghiêm.' }`; an example without `trans` gives an item with no `trans` key; order of words and examples is kept. `poolFor(pool, false)` returns the same array instance; `poolFor(pool, true)` keeps only items with `trans`.
  - `highlight.test.ts`: `findTarget('Enable strict mode.', 'strict')` → `{start:7,end:13}`; case-insensitive (`'Strict mode', 'STRICT'` → `{0,6}`); `findTarget('The enforcement is on.', 'enforce')` → the whole word `{start:4,end:15}`; whole-word wins over prefix when both exist (`'enforcement and enforce it', 'enforce'` → the second one, `{start:16,end:23}`); `findTarget('nothing here', 'strict')` → `null`; `findTarget('Use C++ here', 'c++')` → `{start:4,end:7}`; `findTarget('a well-known fact', 'well-known')` → `{2,12}`; `findTarget('use (a) here', '(a)')` → `{4,7}`; `findTarget('unstrict', 'strict')` → `null` (a word that merely contains it does not count); empty headword → `null`, never throws for any of these inputs.
- [ ] **Step 2: Run** `npx vitest run src/utils/sentences` → FAIL (modules missing)
- [ ] **Step 3: Implement** the signatures above in `pool.ts` and `highlight.ts`.
- [ ] **Step 4: Run** the same command → PASS (main session)
- [ ] **Step 5: Commit** `feat: playable sentence pool and target word highlight`

---

### Task 2: Typing turn, session, run (delegate, parallel with Task 1)

**Files:**
- Create: `src/utils/sentences/turn.ts`, `session.ts`, `run.ts`
- Test: `src/utils/sentences/turn.test.ts`, `session.test.ts`, `run.test.ts`

**Interfaces:**
- Consumes: `SentenceItem`, `SentenceLength` (Task 0); `normalizeTypedChar` from `./pool` (Task 1: if it does not exist yet when this task runs, import it anyway; the main session runs the tests after both tasks are done); `shuffle(items, rng)` and `sanitizeQuizLength` from `@/utils/quiz/questions`.
- Produces in `turn.ts`:
  - `type Turn = { expected: string; typed: number; wrong: number; peeked: boolean; lastWrong: boolean; startedAt: number | null; endedAt: number | null }`
  - `createTurn(expected: string): Turn` (`expected` is already normalised)
  - `isDone(turn: Turn): boolean` — `typed === expected.length`
  - `pressKey(turn: Turn, key: string, now: number): Turn` — `key` is `KeyboardEvent.key`. A key whose normalised value is not exactly one character, or any key when the turn is done, returns the same turn instance. Correct character: `typed + 1`, `lastWrong` false, `startedAt` set on the first accepted key (correct or wrong), `endedAt = now` when it completes the sentence. Wrong character: `wrong + 1`, `lastWrong` true, `typed` unchanged.
  - `peek(turn: Turn): Turn` — sets `peeked` true and is a no-op (same instance) if already peeked or done.
  - `turnMistakes(turn: Turn): number` — `wrong + (peeked ? 1 : 0)`
- Produces in `session.ts`:
  - `type SentenceResult = { item: SentenceItem; typed: number; wrong: number; peeked: boolean; ms: number }` (`ms` = `endedAt - startedAt`)
  - `type SentenceSession = { items: SentenceItem[]; index: number; turn: Turn; results: SentenceResult[] }`
  - `createSession(items: SentenceItem[]): SentenceSession` (requires at least one item)
  - `currentItem(s: SentenceSession): SentenceItem | undefined`, `isComplete(s): boolean` (`index >= items.length`)
  - `typeKey(s: SentenceSession, key: string, now: number): SentenceSession`, `peekSentence(s): SentenceSession` — delegate to the turn; the session is the same instance when nothing changed or when complete.
  - `advance(s: SentenceSession): SentenceSession` — only when the current turn is done: records a `SentenceResult`, moves `index` on and creates the next turn; otherwise returns the same instance (so a double call is harmless).
  - `type SentenceSummary = { completed: number; typed: number; wrong: number; accuracy: number; wpm: number; ms: number; missed: SentenceResult[]; missedMore: number }` where `accuracy = typed / (typed + wrong)` (1 when both are 0), `wpm = (typed / 5) / (ms / 60000)` (0 when `ms` is 0), `ms` is the sum of result `ms`, `missed` = results with mistakes (`wrong` + peek) sorted by mistakes descending then by original order, at most 50, `missedMore` = how many more there were.
  - `summarize(s: SentenceSession): SentenceSummary`, `retryItems(s: SentenceSession): SentenceItem[]` (items of every result with mistakes, in run order)
- Produces in `run.ts`:
  - `buildRun(pool: SentenceItem[], length: SentenceLength, rng: () => number): SentenceItem[]` — `pool` is already filtered by the caller with `poolFor`; returns a shuffled copy cut to `length` (`'all'` = everything), no repeats, `[]` for an empty pool, input not mutated.
  - `sanitizeSentenceLength = sanitizeQuizLength` (re-export with that name), `sanitizeHide(value: unknown): boolean` (`true` only for `true`).

- [ ] **Step 1: Write the failing tests**
  - `turn.test.ts` (expected `'Hi, it\'s ok.'` unless stated): correct keys advance `typed` and set `startedAt` to the first key's time; a wrong key increments `wrong`, sets `lastWrong`, keeps `typed`, and the next correct key clears `lastWrong`; `' '` is a valid key; `'Shift'`, `'Backspace'`, `'Enter'`, `'Tab'`, `'Dead'`, `'ArrowLeft'`, `''` return the same instance; typing a curly `'’'` when `'`' is expected is accepted, and typing `'\''` when expected is `'-'` is wrong but typing `'—'` when `'-'` is expected is accepted; completing the last character sets `endedAt` and `isDone`; any key after done returns the same instance; `peek` marks `peeked` once (second call same instance) and `turnMistakes` is `wrong + 1`; a wrong key before any correct key still sets `startedAt`.
  - `session.test.ts` (two items `'ab'`, `'c'`): typing through the first item then `advance` records one result `{typed:2, wrong:0, peeked:false, ms}` and starts the second turn; `advance` before the turn is done returns the same instance; calling `advance` twice after done does not skip an item or duplicate a result; after the last item `isComplete` is true and `typeKey`/`peekSentence`/`advance` return the same instance; `summarize` for results (typed 2/wrong 1/ms 6000) and (typed 3/wrong 0/ms 6000): `completed 2`, `typed 5`, `wrong 1`, `accuracy 5/6`, `ms 12000`, `wpm` = `(5/5)/(12000/60000)` = `5`; a peeked sentence with no wrong keys appears in `missed` with one mistake; `missed` is sorted by mistakes descending and capped at 50 with `missedMore` the remainder (build 52 results with mistakes); `retryItems` returns the items with mistakes in run order, `[]` when none; empty results → `accuracy 1`, `wpm 0`.
  - `run.test.ts`: deterministic `rng` (e.g. a seeded counter): `buildRun(pool of 5, 3, rng)` has 3 distinct items from the pool; length `'all'` returns all 5 as a permutation; length 20 with a pool of 5 returns 5; empty pool returns `[]`; the input array is not mutated; `sanitizeSentenceLength('20')` → `20`, `'all'` → `'all'`, `7` → `10`, `undefined` → `10`; `sanitizeHide(true)` true, `'true'`/`1`/`undefined` false.
- [ ] **Step 2: Run** `npx vitest run src/utils/sentences` → FAIL
- [ ] **Step 3: Implement** the signatures above. Turn and session are immutable (return new objects, same instance for no-ops).
- [ ] **Step 4: Run** the same command → PASS (main session, after Task 1 too)
- [ ] **Step 5: Commit** `feat: sentence typing turn, session and run`

---

### Task 3: Loading, nav and routes (main session)

**Files:**
- Create: `src/hooks/useExampleWords.ts`
- Modify: `src/components/AppShell/navItems.ts`, `src/components/AppShell/index.tsx`, `src/components/AppShell/navItems.test.ts`, `src/components/SelectDictRedirect.tsx`, `src/index.tsx`
- Test: `src/components/AppShell/navItems.test.ts`

**Interfaces:**
- Produces:
  - `useExampleWords(id: string): { dict: Dictionary | undefined; words: Word[] | undefined; error: unknown }` — `useDictionaryWords(id)` plus the extras sidecar of the dictionary (`sidecarUrlOf(dict)`, fetched with SWR + `fetchWordExtras`) attached with `attachExtras`. `words` stays `undefined` until both the words and (when the dictionary has a sidecar) the extras have loaded; a failed extras load must not block (`fetchWordExtras` already returns `{}`).
  - `NavItem.id` gains `'sentences'`, `NavItem.icon` gains `'sentences'` (`IconAlignLeft` from `~icons/tabler/align-left` in `ICONS`).
  - `SelectDictRedirect` accepts `mode: 'study' | 'quiz' | 'match' | 'sentences'`.
  - Routes `/sentences` → lazy `SentencesPage` (`./pages/Sentences`), `/sentences/:dictId` → `<SelectDictRedirect mode="sentences" />`.

- [ ] **Step 1: Write the failing test** — update `navItems.test.ts`: item ids in order `['home','typing','study','quiz','match','sentences','my-sets','library']`; tab ids still `['home','typing','study','quiz','match']`; `byId('sentences').to` is `'/sentences'`; `isNavActive(byId('sentences'), '/sentences/custom%3A1')` true and `'/sentencesx'` false; `MORE_LINKS` `to` list `['/my-sets','/gallery','/sentences','/error-book','/analysis','/about']`.
- [ ] **Step 2: Run** `npx vitest run src/components/AppShell` → FAIL
- [ ] **Step 3: Implement** the nav item (`label: 'Sentences', to: '/sentences', base: '/sentences', tab: false`), the More link, the icon, the redirect mode, the routes and the hook. `src/pages/Sentences/index.tsx` does not exist yet: create a placeholder default export returning `null` so the lazy import compiles (Task 4 replaces it).
- [ ] **Step 4: Run** `npx vitest run` and `npx tsc --noEmit -p .` → PASS, no new type errors
- [ ] **Step 5: Commit** `feat: sentences route, nav item and example loading`

---

### Task 4: Setup, Result and the stage owner (delegate, parallel with Task 5)

**Files:**
- Create/replace: `src/pages/Sentences/index.tsx`, `src/pages/Sentences/Setup.tsx`, `src/pages/Sentences/Result.tsx`

**Interfaces:**
- Consumes: `useCurrentDictId`, `useExampleWords` (Task 3), atoms (Task 0), `buildPool`, `poolFor` (Task 1), `buildRun`, `sanitizeSentenceLength`, `sanitizeHide` (Task 2), `SentenceSession`, `summarize`, `retryItems` (Task 2), `useSetProgress` as `Quiz/index.tsx` does. `Run` and its props are produced by Task 5 and must be used exactly as defined below.
- Props fixed for the parallel tasks:
  - `Run`: `{ items: SentenceItem[]; hide: boolean; onHideChange: (hide: boolean) => void; onExit: () => void; onFinish: (session: SentenceSession) => void }` (default export of `./Run`)
  - `Setup`: `{ dictName: string; playable: number /* poolFor(pool, hide).length, computed by index.tsx */; length: SentenceLength; onLengthChange: (v: SentenceLength) => void; hide: boolean; onHideChange: (v: boolean) => void; onStart: () => void; onBack: () => void; progress?: ProgressSummary | null }`
  - `Result`: `{ summary: SentenceSummary; canPractiseMistakes: boolean; onPractiseMistakes: () => void; onTryAgain: () => void; onBack: () => void }`

- [ ] **Step 1: Implement `index.tsx`** following `src/pages/Quiz/index.tsx`: keyed route component by current id; `useExampleWords`; loading and error messages as Quiz; `pool = useMemo(buildPool(words))`; `filtered = poolFor(pool, hide)`; stage state `'setup' | 'run' | 'result'`, the run's `items` and a `round` counter (remount `Run` on every start); Start builds `buildRun(poolFor(pool, hide), length, Math.random)`; `onFinish(session)` stores `summarize(session)` and `retryItems(session)` and goes to `result`; "Practise mistakes" starts a run with those items (copy of them, `hide` unchanged); "Try again" builds a new run; "Back to setup" returns to `setup`. Length and hide come from the atoms through `sanitizeSentenceLength`/`sanitizeHide`. The Run's `onHideChange` writes the same atom.
- [ ] **Step 2: Implement `Setup.tsx`** like `src/pages/Quiz/Setup.tsx`: when `playable` is 0 show a Card "This set has no example sentences you can type yet." (with a hint that sentences with characters outside the English keyboard or longer than 200 characters are skipped, and, when hide is on, that only sentences with a translation count) and no Start button; otherwise the length buttons (10/20/All), the checkbox "Hide the sentence (type it from its translation)", the line "`N` sentences can be played" and Start. Include the set progress card as Quiz does.
- [ ] **Step 3: Implement `Result.tsx`**: stats row (WPM rounded, accuracy as a percentage with no decimals, time as `m:ss`, `completed` sentences), then the `missed` list (sentence text, its translation muted, mistakes count) and, when `missedMore > 0`, the line `and N more`; the three actions (Practise mistakes only when `canPractiseMistakes`). Tokens only.
- [ ] **Step 4:** the main session runs `npx tsc --noEmit -p .` after Task 5 is in as well.
- [ ] **Step 5: Commit** (main session) `feat: sentences setup and result screens`

---

### Task 5: Run screen and typing line (delegate, parallel with Task 4)

**Files:**
- Create: `src/pages/Sentences/Run.tsx`, `src/pages/Sentences/TypingLine.tsx`

**Interfaces:**
- Consumes: `createSession`, `currentItem`, `isComplete`, `typeKey`, `peekSentence`, `advance`, `SentenceSession` (Task 2), `findTarget` (Task 1), `isDone`, `Turn` (Task 2).
- Produces: `Run` (props above) and `TypingLine` with props `{ text: string; typed: number; hidden: boolean; lastWrong: boolean; target: { start: number; end: number } | null }` rendering one `<span>` per character: typed characters in the "correct" token colour, the next character underlined/marked as the cursor and with a visible mark plus the red token when `lastWrong`, the rest muted; the target range gets an emphasised weight/underline; when `hidden`, untyped characters show as `_` (letters/digits) while spaces and punctuation are shown, typed ones show as themselves. Colour is never the only signal (use underline/weight/`_`).

- [ ] **Step 1: Implement `Run.tsx`:**
  - State: `useState(() => createSession(items))` plus a ref updated synchronously, like `StudySession.tsx`/`QuizRun.tsx`; pass `onFinish(session)` once when the session completes.
  - Effective hide per turn = `hide && Boolean(item.trans)`; a "Hide sentence" toggle button (ordinary focusable `Button`, `aria-pressed`) calls `onHideChange`; a "Peek" button shown only while effectively hidden, calling `peekSentence`; an Exit button and the Esc key call `onExit` after `window.confirm('Leave this run?')` when at least one key has been typed (no confirm otherwise).
  - Keyboard: one `keydown` listener on `window` (added in an effect): ignore events with Ctrl/Cmd/Alt held, with `e.repeat`, or whose target is an enabled button/input (use `isActivatableButton` plus inputs/textareas) when the key is Space or Enter; for single-character keys call `typeKey(sessionRef.current, e.key, Date.now())` and `preventDefault()` for the keys that would otherwise act on the page (Space, `'`, `/`); Tab and every other non-character key are left alone.
  - After a turn is done, `setTimeout(advance, 400)` (cleared on unmount); `advance` is the guarded function from Task 2.
  - Touch devices (`window.matchMedia('(pointer: coarse)').matches`): render a text input (`autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`, visible, labelled "Type here") whose `onInput` feeds each new character to `typeKey` and then clears the input; best effort only.
  - Layout: header with `n / total`, running accuracy and WPM (from `summarize`), Exit and toggle; the sentence via `TypingLine` (`hidden` = effective hide and not peeked); the translation under it (when present); `sr-only` live text of the sentence so screen readers have it; use `ModeFrame` and `ScrollCenter` like `StudySession.tsx`.
- [ ] **Step 2: Implement `TypingLine.tsx`** as specified in Interfaces.
- [ ] **Step 3:** the main session runs `npx tsc --noEmit -p .` and eslint after Task 4 is in as well.
- [ ] **Step 4: Commit** (main session) `feat: sentences run screen`

---

### Task 6: Wire-up check, browser verification, review (main session)

- [ ] **Step 1:** `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint src --ext .ts,.tsx` all clean (only the known pre-existing `mixpanel`/`trackEvent` type errors). Confirm no import of `@/utils/db` from `src/pages/Sentences` or `src/utils/sentences` (`grep`).
- [ ] **Step 2: Browser verification** (`preview_start dev`): (a) `/sentences` with My Vocabulary: setup shows the playable count (expected about 1,100 of 1,166; with hide on, fewer); (b) copy mode: correct keys colour, wrong key flashes and is rejected, last character advances after a short pause, curly-vs-straight quotes accepted both ways; (c) hide mode: blanks, Peek reveals and counts one mistake, a sentence without translation shows in copy mode; (d) a held key does not type repeatedly; (e) Esc/Exit confirm only after typing; (f) result screen numbers match what was typed, "Practise mistakes" and "Try again" work and "Practise mistakes" is absent after a flawless run; (g) a set with no sentences shows the empty message; (h) a built-in set with no extras does not crash; (i) mobile width: no horizontal scroll, input shown; (j) flashcard progress is untouched after a run (query `cardProgress`/`reviewLog` counts before and after).
- [ ] **Step 3: Review the whole diff** against the spec and the Review Focus list; fix findings.
- [ ] **Step 4: Commit** fixes `fix: sentences mode review findings` (only if there are any).
