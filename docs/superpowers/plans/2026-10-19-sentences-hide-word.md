# Sentences "Hide word" mode and sentence data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make "Hide word" (full sentence shown, target word masked) the default Sentences mode, find target words reliably, and give the words that lack a playable sentence good example sentences.

**Architecture:** `SentenceItem` carries its `target` range, found once when the pool is built. A three-way `SentenceMode` replaces the hide boolean in the store, pool, setup and run. Data fixes go through the existing extras sidecar plus a versioned, merging backfill.

**Tech Stack:** TypeScript, React, jotai, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-sentences-mode-design.md` (section "Revision: Hide word becomes the default mode").

## Global Constraints

Same as `docs/superpowers/plans/2026-10-19-sentences-mode.md` (alias `@/`, style, tokens only, no new dependencies, pure logic tested with Vitest, no `@/utils/db` import from the Sentences mode, delegated workers never run build/test and never commit).

## Review Focus

- A headword with regex characters or a hyphen/phrase must never throw while matching (Task 1).
- Switching mode in a run must not lose the typed progress of the current sentence (Task 3, browser).
- A sentence without a found target is never offered in Hide word mode, but still plays in Copy mode (Task 2).
- The merge backfill must keep the learner's own sentences, never duplicate, and run once per version (Task 5).
- The repaired extractor must not change sentences that were already correct (Task 4).

## Tasks

### Task 1: Better `findTarget` (main) — `src/utils/sentences/highlight.ts`, `highlight.test.ts`

- [ ] Add tests: `findTarget('The team fine-tuned the model.', 'fine-tune')` → covers `fine-tuned`; `'Logging is a cross-cutting concern', 'cross cutting'` → covers `cross-cutting`; `'The committee consists of five', 'consist of'` → `consists of`; `'The design embodies trust', 'embody'` → `embodies`; `'It is evolving fast', 'evolve'` → `evolving`; `'a cat', 'cat'` still whole-word; existing cases keep passing (`unstrict` → null, `enforce`→`enforcement`, whole word beats prefix, `c++`, `(a)`).
- [ ] Implement the three-step rule from the spec; range covers the whole span; never throws.
- [ ] Run `npx vitest run src/utils/sentences/highlight.test.ts`; commit.

### Task 2: Modes in logic and store (main) — `types.ts`, `pool.ts`, `run.ts`, `src/store/sentences.ts` + tests

- Produces: `type SentenceMode = 'word' | 'copy' | 'sentence'`; `SentenceItem.target?: { start: number; end: number }` set by `buildPool`; `poolFor(pool, mode)` (word: items with `target`; sentence: items with `trans`; copy: all); `sanitizeMode(value: unknown): SentenceMode` (default `'word'`); atom `sentencesModeAtom` (key `sentencesMode`, default `'word'`) replacing `sentencesHideAtom`.
- [ ] Tests: `buildPool` sets `target` for found headwords and leaves it undefined otherwise; `poolFor` for the three modes; `sanitizeMode('copy')` → `'copy'`, `'x'`/`undefined` → `'word'`.
- [ ] Implement; remove `sanitizeHide` and `sentencesHideAtom`; commit.

### Task 3: UI (delegate to opencode, main verifies in the browser) — `index.tsx`, `Setup.tsx`, `Run.tsx`, `TypingLine.tsx`

- Setup: a three-option group (Hide word / Copy / Hide sentence) replacing the checkbox; count = `poolFor(pool, mode).length`; empty-state hint mentions "sentences where the word was found" for Hide word.
- Run props: `mode: SentenceMode; onModeChange: (m: SentenceMode) => void` replacing `hide/onHideChange`; a segmented control or three small buttons in the header; effective mode per turn: `sentence` mode falls back to copy for a sentence without translation; `word` mode needs `item.target` (always true by the pool).
- TypingLine props add `maskRange: { start: number; end: number } | null`: letters/digits inside the range show as `_` until typed (or revealed by Peek); `hidden` keeps its meaning for the whole sentence.
- Peek is shown in Hide word and Hide sentence modes, reveals, counts one mistake (existing logic).
- [ ] After the worker: `tsc`, eslint, review diff; browser check: default is Hide word, mask works, mode switch keeps progress, count changes with mode; commit.

### Task 4: Repair the extractor and the data (main) — `fromDetail.ts`, `fromDetail.test.ts`, `public/dicts/my-vocab.extras.json`

- [ ] Test: `Câu mẫu: English. (Vietnamese) — đây chính là câu bạn vừa đọc!` → `{ text: 'English.', trans: 'Vietnamese' }`; sentences without a trailing comment unchanged.
- [ ] Implement (ignore a `— ...` comment that follows the closing parenthesis).
- [ ] Rebuild examples of every word from its `detail`, append the new sentences (Task 4b), dedupe by text; verify counts (previous 1,166 sentences stay, 21 repaired, new sentences added) and that every word now has at least one sentence with a found target, except the four misspelled headwords.
- [ ] Commit data separately.

### Task 4b: New sentences (main) — 33 words × 2 sentences with Vietnamese translations, English in the IT/business register of the existing ones, each containing the headword (or its inflection / exact phrase), 60–140 characters, plain ASCII.

### Task 5: Versioned merging backfill (main) — `personal-seed.ts`, `usePersonalSeeds.ts`, `store/personal.ts` + tests

- Produces: `backfillPersonalExtras(customId, map, options?: { mergeExamples?: boolean })` — with `mergeExamples` it unions the sidecar sentences into each word's (dedupe by text, the word's own first); returns changed word count; no write when 0. `EXTRAS_VERSION = 2`; the done-flag entries become `${builtInId}@${EXTRAS_VERSION}` and the hook uses the merging backfill.
- [ ] Tests: merge adds new sentences and keeps own; idempotent; no `updatedAt` change when nothing new; old flag `myVocab` does not count as done for version 2.
- [ ] Commit.

### Task 6: Verify (main)

- [ ] `vitest`, `tsc`, eslint clean; browser: simulate an existing profile (remove new sentences from the stored set, clear the flag) and see them come back while a user-added sentence stays; Hide word run end to end; report the list of misspelled headwords.
