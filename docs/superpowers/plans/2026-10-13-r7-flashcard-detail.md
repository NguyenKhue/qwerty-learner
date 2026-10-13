# R7: Detailed Meanings on Flip Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flashcards flip like a card: the front shows the English word, the back shows a long, detailed meaning (`detail`). Every other mode keeps the short meanings. Existing "My Vocabulary" gets its details from `Vocab.rtf`, and any future set (imported or created) can carry them too.

**Architecture:** `Word` gets an optional `detail` string. Custom sets store it inside the word record (IndexedDB) and read it from a `detail` column (CSV) or field (JSON), and edit it in the set editor. Built-in sets can point at a sidecar file (`detailUrl`, a `{ "word": "text" }` map) that only Flashcards fetch and merge. A pure `parseDetail` splits the text into labelled lines. The study card becomes a CSS 3D flip with the detail on the back, falling back to the short meanings when a word has no detail.

**Tech Stack:** React 18, Tailwind tokens, SWR, Dexie, Vitest.

**Spec:** the chat design agreed on 2026-10-13 (flip card, `detail` field, sidecar for built-ins, import column and editor field for custom sets).

## Global Constraints

- Quiz, Match, Typing and the dashboard keep using `trans` only; `detail` must never change their behavior or bundle size (the sidecar is fetched only by Flashcards).
- A word without `detail` still shows its short meanings on the back: never an empty back.
- Old CSV files (no header, or a header with the first four names) and old JSON files keep importing exactly as before.
- Colors only through tokens; `prefers-reduced-motion` replaces the flip by a fade; touch targets ≥ 44px; the hidden face is not read by assistive tech.
- tsconfig target es5: no iterating Map/Set iterators, no `flatMap`. Tests, tsc (4 baseline errors) and eslint (6 baseline warnings) stay at baseline. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A CSV `detail` cell with commas, quotes and newlines inside quotes survives import; a header in any column order is honored.
- Duplicate words in one import: the first non-empty `detail` wins and meanings still merge.
- A very long detail (5,000+ characters) scrolls inside the card; the Space key still flips.
- Reverse mode ("Show the meaning first") still works and shows the detail with the word.
- Copying "My Vocabulary" into a custom set keeps its details.
- Data from IndexedDB with no `detail` (sets made before this change) opens without errors.

---

### Task 1: `detail` in types, import, normalization and copy

Files: `src/typings/index.ts`, `src/typings/resource.ts`, `src/utils/custom-dict/parse.ts` (+ test), `src/utils/normalizeWordList.ts` (+ test), `src/utils/db/copy-dict.ts`.

- [ ] Failing tests: CSV with a `detail` header in any column order; positional 5th column; multi-line quoted cell; JSON `detail`; duplicates keep the first non-empty detail; `rowsToWords` carries `detail`; `normalizeWordList` keeps a string `detail` and drops a non-string one.
- [ ] Implement, run the tests, commit.

### Task 2: Detail text parsing and sidecar merge

Files: `src/utils/detail/format.ts`, `src/utils/detail/format.test.ts`, `src/utils/detail/sidecar.ts` (+ test).

- [ ] Failing tests for `parseDetail(text)` → `{ label?: string; text: string }[]` (label for `Mẹo nhớ:`, `Câu mẫu:`, `1. Trong IT / Kỹ thuật:` lines; blank lines dropped; plain lines have no label) and `attachDetails(words, map)` (case-insensitive name match, does not mutate input, words without an entry unchanged).
- [ ] Implement, test, commit.

### Task 3: Build `my-vocab.detail.json` from `Vocab.rtf`

Files: `scripts/vocab-detail-from-text.py`, `public/dicts/my-vocab.detail.json`, `src/resources/dictionary.ts` (+ `detailUrl`).

- [ ] The script reads the plain-text export of the RTF (`textutil -convert txt`), splits entries at lines `Word - Loại từ:` and writes `{ "word": "detail" }`; it reports unmatched words. Verify counts against `my-vocab.json` (543 of 555 matched at the first look; investigate the rest).
- [ ] Commit data and script.

### Task 4: Flip card in Flashcards

Files: `src/pages/Study/FlipCard.tsx`, `src/pages/Study/StudySession.tsx`, `src/pages/Study/index.tsx`.

- [ ] `FlipCard({ flipped, front, back })` stacks both faces in one grid cell (height = the taller face), `rotateY` transition, `backface-visibility: hidden`, the hidden face `aria-hidden` and not focusable, reduced motion → fade, the back scrolls when taller than 60vh.
- [ ] Study loads the sidecar with SWR when the set has `detailUrl` and merges it; the back shows `parseDetail` lines (bold labels) or the short meanings.
- [ ] Verify in the browser (light and dark, 375 and 1280, reverse mode, keyboard).

### Task 4b: Copy keeps details

- [ ] `duplicateDictionaryAsCustom` merges the sidecar before copying (test with a stubbed fetcher).

### Task 5: Editor and import help

Files: `src/pages/MySets/SetEditor.tsx`, `ImportPanel.tsx`, `src/utils/custom-dict/parse.ts` (`EditableRow.detail`).

- [ ] Each row gets an optional "Detail" textarea below the fields; rows from stored words include `detail`; the import help mentions the `detail` column. Verify create, edit, import and reload in the browser.

### Task 6: Findings, full checks, commit.

## Delegation (user request: plan, then opencode implements)

Task 1 was done in the main session. For Tasks 2 to 5 the main session writes the failing tests first and opencode (`space-bunny-free`, sequential runs, each with an explicit file list, "no build/test commands", "do not commit") implements until they pass; the main session runs the tests, reviews every diff, and verifies the UI in the browser.

- Run A: `src/utils/detail/format.ts`, `src/utils/detail/sidecar.ts` (tests: `format.test.ts`, `sidecar.test.ts`).
- Run B: `scripts/vocab-detail-from-text.py`, `public/dicts/my-vocab.detail.json`, `src/resources/dictionary.ts`.
- Run C: `src/pages/Study/FlipCard.tsx`, `StudySession.tsx`, `index.tsx` (+ `src/utils/db/copy-dict.ts`, test `copy-dict.test.ts`).
- Run D: `src/pages/MySets/SetEditor.tsx`, `ImportPanel.tsx`.
