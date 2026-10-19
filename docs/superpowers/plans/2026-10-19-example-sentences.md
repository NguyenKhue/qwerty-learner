# Example Sentences Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every word an optional list of example sentences (`examples`) that can be imported, edited, stored, copied and shown, so a later PR can build a "type the whole sentence" mode on top of it.

**Architecture:** `Word.examples?: WordExample[]` is the single source of truth. One module (`src/utils/examples/`) converts between the `English | Tiếng Việt` line syntax and the structured array; everything else (CSV/JSON import, editor, stored data) calls it. Built-in sets get their extras from ONE sidecar file per set (`{ word: string | { detail?, examples? } }`), replacing the detail-only sidecar and staying backward compatible with it. Already-seeded personal sets are backfilled once, without overwriting user edits.

**Tech Stack:** TypeScript, React 18, Dexie (IndexedDB), Vitest (jsdom), Vite, Tailwind/shadcn.

**Out of scope (next PR):** the typing-a-sentence mode itself, per-sentence SRS, `target` (position of the headword in a sentence).

## Design decisions (agreed with the user in chat, 2026-10-19)

- Field names are language-neutral: `WordExample = { text: string; trans?: string }` (not `en`/`vi`).
- Line syntax in editor and CSV cells: one sentence per line, `text | trans`; the separator is the FIRST occurrence of whitespace + `|` + whitespace, so `a || b` inside code sentences is safe. A line without separator is a sentence with no translation.
- JSON import and sidecar files use the array form directly, never the `|` syntax.
- `Câu mẫu:` lines stay inside `detail` untouched (free text, the user keeps writing there). `examples` is what the sentence mode will read; `detail` is for reading.
- One extras sidecar per built-in set replaces the detail-only sidecar; a plain string value still means `detail`.
- Editor uses one textarea (`|` syntax). Upgrading to two inputs per sentence later needs no data change.

## Global Constraints

- Path alias `@/` = `src/`. Tests live next to the code as `*.test.ts`, run by `npx vitest run <file>`; test environment is jsdom, only `src/**/*.test.ts` is collected.
- Existing code style: no semicolons, single quotes, 2-space indent, 140-col lines (prettier via lint-staged). Match the surrounding comment density: short `/** ... */` above exported functions.
- New fields are optional; data stored in IndexedDB before this change must keep working with no Dexie schema change.
- No new dependencies.
- Never overwrite a user's existing `detail` or `examples` from a sidecar.
- Delegated tasks: the worker must NOT run build/test/lint commands and must NOT commit; the main session runs `npx vitest run` after each delegated batch and commits.

## Review Focus

- Sentence containing code operators (`if (a || b)`) or a literal `|` inside the translation: only `|` with surrounding whitespace splits; test pins it.
- CRLF line endings, blank lines, lines with only whitespace, a line that is only ` | trans` (no sentence): blank lines vanish; a translation-only line is dropped AND the editor shows an issue so input is not lost silently.
- The same sentence imported twice or merged from two duplicate rows: deduplicated by trimmed `text`, order preserved.
- Garbage in stored/JSON data (`examples: "x"`, `[null, 5, {}]`, `{text: 3}`): never throws, yields `[]` or the valid subset.
- Legacy sidecar (`{ "word": "long text" }`) and malformed sidecar (array, null, non-JSON): behave as before / yield `{}`.
- Backfill must be idempotent and must not touch words the user already gave examples, nor bump `updatedAt` when nothing changed.
- A set exported or copied (`duplicateDictionaryAsCustom`) must carry `examples` along with `detail`.

## File Structure

| File                                                                                                                  | Responsibility                                                                                             |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/typings/index.ts` (modify)                                                                                       | `WordExample`, `Word.examples?`                                                                            |
| `src/typings/resource.ts` (modify)                                                                                    | `extrasUrl?` next to the legacy `detailUrl?`                                                               |
| `src/utils/examples/format.ts` (create)                                                                               | `parseExamples`, `formatExamples`, `normalizeExamples`, `mergeExamples`                                    |
| `src/utils/examples/fromDetail.ts` (create)                                                                           | `extractExamplesFromDetail` (used by the migration script only)                                            |
| `src/utils/custom-dict/parse.ts` (modify)                                                                             | `examples` column / field in CSV, JSON, editor rows, merge on duplicates                                   |
| `src/utils/custom-dict/issues.ts`, `search.ts` (modify)                                                               | row issue for lost lines; search over sentences                                                            |
| `src/utils/normalizeWordList.ts` (modify)                                                                             | repair bad `examples` in built-in word files                                                               |
| `src/utils/detail/sidecar.ts` (modify)                                                                                | `WordExtras`, `fetchWordExtras`, `attachExtras`, `sidecarUrlOf` (replace `attachDetails`/`fetchDetailMap`) |
| `src/utils/db/personal-seed.ts` (modify)                                                                              | `backfillPersonalExtras`                                                                                   |
| `src/hooks/usePersonalSeeds.ts`, `src/utils/db/copy-dict.ts`, `src/pages/Study/*` (modify)                            | switch callers to extras                                                                                   |
| `src/store/personal.ts` (modify)                                                                                      | `backfilledPersonalExtrasAtom`                                                                             |
| `src/pages/MySets/WordEditorCard.tsx`, `SetEditor.tsx`, `ImportPanel.tsx`, `SetDetail/WordCard.tsx` (modify)          | editor field, help text, display                                                                           |
| `scripts/build-word-extras.ts` (create)                                                                               | one-off: `my-vocab.detail.json` → `my-vocab.extras.json`                                                   |
| `public/dicts/my-vocab.extras.json` (create), `my-vocab.detail.json` (delete), `src/resources/dictionary.ts` (modify) | the migrated data                                                                                          |
| `docs/toBuildDict.md` (modify)                                                                                        | document `examples` and the extras sidecar                                                                 |

Execution order and delegation (opencode = `opencode/deepseek-v4.1-flash-free`, `-v high` only for Task 3b):

```
T1 (opencode) ─┬─ T2 (opencode) ─┐
               ├─ T3a (opencode) ─┼─ T3b (main) ─ T4 (opencode, main verifies in browser)
               └─ T5 (opencode) ──┘                         └─ T6 (main: full verify, review, docs)
```

T2, T3a and T5 touch different files and may run in parallel after T1; T3b needs T3a; T4 needs T2 and T3b; T5's run (producing data) needs T1 only.

---

### Task 1: Example type and the format module (delegate)

**Files:**

- Modify: `src/typings/index.ts` (the `Word` type, ~line 22)
- Create: `src/utils/examples/format.ts`, `src/utils/examples/fromDetail.ts`
- Test: `src/utils/examples/format.test.ts`, `src/utils/examples/fromDetail.test.ts`

**Interfaces:**

- Produces:

  - `export type WordExample = { text: string; trans?: string }` and `Word.examples?: WordExample[]` in `@/typings`
  - `parseExamples(text: string): WordExample[]`
  - `formatExamples(examples: WordExample[] | undefined): string`
  - `normalizeExamples(value: unknown): WordExample[]`
  - `mergeExamples(a: WordExample[] | undefined, b: WordExample[] | undefined): WordExample[] | undefined`
  - `extractExamplesFromDetail(detail: string): WordExample[]`

- [ ] **Step 1: Write the failing tests** in `format.test.ts`
  - `parseExamples('A b. | Một hai.')` → `[{ text: 'A b.', trans: 'Một hai.' }]`
  - no separator → `[{ text: 'Only english' }]` (no `trans` key at all)
  - `parseExamples('if (a || b) run | Chạy')` → text `'if (a || b) run'`, trans `'Chạy'`; `parseExamples('x | y | z')` → text `'x'`, trans `'y | z'`
  - CRLF input with blank lines → blank lines dropped, 2 items
  - `parseExamples(' | only trans')` → `[]`; `parseExamples('')` → `[]`
  - `formatExamples([{text:'A', trans:'B'}, {text:'C'}])` → `'A | B\nC'`; `formatExamples(undefined)` → `''`
  - round trip: `parseExamples(formatExamples(list))` equals `list` for a list of 3 mixed items
  - `normalizeExamples('x')` → `[]`; `normalizeExamples([null, 5, {}, {text: 3}, 'plain', {text: ' ok ', trans: ' t '}, {text: 'ok'}])` → `[{text:'plain'},{text:'ok',trans:'t'}]` (strings become text, trimmed, empty text dropped, duplicates by text dropped keeping first)
  - `mergeExamples(undefined, undefined)` → `undefined`; merge keeps order a-then-b and dedupes by `text`; returns `undefined` when result is empty
- [ ] **Step 1b: Write the failing tests** in `fromDetail.test.ts`
  - detail text with two `Câu mẫu: English sentence. (Bản dịch).` lines among other lines → two items `{text:'English sentence.', trans:'Bản dịch'}` (trailing `.` after `)` ignored; sentence keeps its own final period)
  - nested parentheses in the translation `(… (JSON) …)` → balanced from the end, whole inner text is `trans`
  - a `Câu mẫu:` line with no trailing parenthesised translation → `{ text: <whole line after label> }`
  - only the label `Câu mẫu` counts (case-insensitive); lines labelled `Ví dụ`/`Example` are Vietnamese explanations in the real data and are ignored; no label at all → `[]`
- [ ] **Step 2: Run** `npx vitest run src/utils/examples` → FAIL (modules missing)
- [ ] **Step 3: Implement** the signatures above. `parseExamples`: split on `/\r?\n/`, trim, skip empty; find the first match of `/\s\|\s/`; omit `trans` when empty. `normalizeExamples` never throws and returns new objects. `extractExamplesFromDetail`: line label regex `^câu mẫu\s*:\s*` (measured on the real file: 525 words, 1166 sentences; adding `Ví dụ`/`Example` wrongly pulls in 97 explanation lines), translation found by scanning backwards from the last `)` (after stripping one trailing `.`) to its balanced `(`.
- [ ] **Step 4: Run** the same command → PASS
- [ ] **Step 5: Commit** `feat: example sentence type and the line format`

---

### Task 2: Import, editor rows, merge, validation (delegate, parallel with T3a/T5)

**Files:**

- Modify: `src/utils/custom-dict/parse.ts`, `issues.ts`, `search.ts`, `src/utils/normalizeWordList.ts`
- Test: `parse.test.ts`, `issues.test.ts`, `search.test.ts` (same folder), `src/utils/normalizeWordList.test.ts`

**Interfaces:**

- Consumes: Task 1 `parseExamples`, `formatExamples`, `normalizeExamples`, `mergeExamples`.
- Produces: `EditableRow.examples?: string`; CSV/JSON/editor all fill `Word.examples`; `rowIssues` row type gains `examples?: string`.

- [ ] **Step 1: Write the failing tests**
  - `parseWordsCsv` with header `name,trans,examples` and a quoted multi-line cell `"A b. | Một\nC d."` → `examples` `[{text:'A b.',trans:'Một'},{text:'C d.'}]`; header aliases `example` and `sentences` work; headerless CSV: examples is column index 5 (after `detail`); rows without the column have no `examples` key.
  - `parseWordsJson` with `examples: [{text:'A', trans:'B'}, 'plain', null]` → `[{text:'A',trans:'B'},{text:'plain'}]`; `examples: 'bad'` → no key; JSON word without examples unchanged.
  - `rowsToWords([{..., examples: 'A | B\nA | other\nC'}])` → two examples (`A` deduped by text, first wins) ; empty/whitespace `examples` → no key.
  - `wordsToRows` ↔ `rowsToWords` round trip keeps examples; a word without examples gives `examples: ''`.
  - `normalizeWords` merges `examples` of duplicate words (union, dedupe by text) and does not mutate inputs.
  - `rowIssues`: a row whose only content is `examples: 'x | y'` counts as non-blank (no issue null→"Add the word"); a row with word+meaning and an examples line ` | only trans` returns `Example line 1 has no sentence before "|"`; valid rows still null.
  - `searchWords`-style helper in `search.ts` matches a term that appears only in a sentence's `text` or `trans` (extend `Searchable` with `examples?: WordExample[]`).
  - `normalizeWordList` repairs `examples: 'x'` / `[1, {text: 2}]` (drops/repairs via `normalizeExamples`), keeps a valid array as the very same word object, and leaves words without the key untouched (same object).
- [ ] **Step 2: Run** `npx vitest run src/utils/custom-dict src/utils/normalizeWordList.test.ts` → FAIL
- [ ] **Step 3: Implement.** In `parse.ts` add `'examples'` to `Field`, `FIELDS`, `FIELD_ALIASES` (`['examples','example','sentences']`) and to both positional default maps (`examples: 5`). Use `parseExamples` for CSV cells and editor rows, `normalizeExamples` for JSON. Set `word.examples` only when non-empty. `wordsToRows` uses `formatExamples`. `normalizeWords`: `existing.examples = mergeExamples(existing.examples, word.examples)` (delete key if undefined). `normalizeWordList`: treat `examples` like `detail` (valid → same object; invalid → repaired copy).
- [ ] **Step 4: Run** the same command → PASS; also `npx vitest run` whole suite stays green
- [ ] **Step 5: Commit** `feat: import and edit example sentences of a word`

---

### Task 3a: Unified extras sidecar functions (delegate, parallel)

**Files:**

- Modify: `src/utils/detail/sidecar.ts`, `src/typings/resource.ts`
- Test: `src/utils/detail/sidecar.test.ts` (rewrite the `attachDetails` cases for `attachExtras`; keep the same behaviours)

**Interfaces:**

- Consumes: Task 1 `normalizeExamples`, `WordExample`.
- Produces:

  - `export type WordExtras = { detail?: string; examples?: WordExample[] }`
  - `attachExtras(words: Word[], map: Record<string, WordExtras> | undefined): Word[]` — same matching/immutability rules as the old `attachDetails` (case-insensitive name and key, own properties only, same object when nothing is added, never overwrites an existing `detail` or non-empty `examples`)
  - `fetchWordExtras(url: string): Promise<Record<string, WordExtras>>` — value string ⇒ `{ detail }`; value object ⇒ `{ detail?, examples: normalizeExamples(...) }` with empty parts omitted; anything else skipped; non-object/array/non-ok/throw ⇒ `{}`
  - `sidecarUrlOf(dict: { extrasUrl?: string; detailUrl?: string }): string | undefined` — `extrasUrl ?? detailUrl`
  - `extrasUrl?: string` on `DictionaryResource` and `Dictionary` (comment: JSON map `{ word: string | { detail?, examples? } }`; `detailUrl` is the legacy name for the same loader)
  - `attachDetails`/`fetchDetailMap` are removed (callers move in Task 3b).

- [ ] **Step 1: Write the failing tests**: `attachExtras` ports every existing `attachDetails` test (adds detail case-insensitively; unchanged words are the same object and input is not mutated; keeps own detail; ignores empty/non-string; `undefined`/`{}` map returns the same array; `constructor`/`toString` names never match), plus: examples are attached; a word with its own non-empty `examples` keeps them while still receiving a missing `detail`; both fields in one entry; an entry with empty examples and no detail is ignored. `fetchWordExtras` (stub `globalThis.fetch`): legacy string value, object value, mixed map, bad entries skipped, `ok:false`, rejected fetch, array body → `{}`. `sidecarUrlOf` prefers `extrasUrl`.
- [ ] **Step 2: Run** `npx vitest run src/utils/detail` → FAIL
- [ ] **Step 3: Implement** the signatures above in `sidecar.ts`; keep the `REACT_APP_DEPLOY_ENV === 'pages'` URL prefix logic of the old fetcher.
- [ ] **Step 4: Run** the same command → PASS (the app will not type-check until Task 3b; expected)
- [ ] **Step 5: Commit** deferred to Task 3b (shared compile state)

---

### Task 3b: Callers, backfill, store (main session)

**Files:**

- Modify: `src/pages/Study/index.tsx` (+ `StudySession.tsx` prop `details`→`extras`), `src/utils/db/copy-dict.ts`, `src/hooks/usePersonalSeeds.ts`, `src/utils/db/personal-seed.ts`, `src/store/personal.ts`
- Test: `src/utils/db/personal-seed.test.ts` (extend), `src/utils/db/copy-dict.test.ts` if present else create

**Interfaces:**

- Consumes: Task 3a functions.
- Produces:

  - `backfillPersonalExtras(customId: string, map: Record<string, WordExtras>): Promise<number>` in `personal-seed.ts` — one Dexie transaction on `db.customDicts`; applies `attachExtras` to the record's words; writes (and bumps `updatedAt`) only if at least one word changed; returns the number of changed words; missing record ⇒ `0`.
  - `backfilledPersonalExtrasAtom = atomWithStorage<string[]>('backfilledPersonalExtras', [])` in `store/personal.ts` (built-in ids already backfilled).

- [ ] **Step 1: Write the failing tests**: backfill adds `examples` to words lacking them, returns the count; second run returns 0 and leaves `updatedAt` unchanged; a word that already has `examples` is not overwritten; missing record returns 0; `duplicateDictionaryAsCustom` of a dict with `extrasUrl` produces words with both `detail` and `examples` (stub `fetch`).
- [ ] **Step 2: Run** `npx vitest run src/utils/db` → FAIL
- [ ] **Step 3: Implement.** Replace `attachDetails(fetchDetailMap(...))` by `attachExtras(fetchWordExtras(sidecarUrlOf(dict)))` in all three callers. `usePersonalSeeds`: after the seed loop, for every `builtInId` that is in `seeded` but not in `backfilledPersonalExtrasAtom`, fetch extras and call `backfillPersonalExtras(seed.customId, map)`; mark it backfilled on success (also mark freshly created sets, whose words already carry extras); a failure only `console.warn`s and is retried next start.
- [ ] **Step 4: Run** `npx vitest run` (whole suite) and `npx tsc --noEmit -p .` → PASS, no type errors
- [ ] **Step 5: Commit** (together with Task 3a) `feat: one extras sidecar per built-in set, carry examples when copying and seeding`

---

### Task 4: Editor field, help text, display (delegate, main verifies in browser)

**Files:**

- Modify: `src/pages/MySets/WordEditorCard.tsx`, `SetEditor.tsx` (`emptyRow`, help text near line 288), `ImportPanel.tsx` (format help), `SetDetail/WordCard.tsx`

**Interfaces:**

- Consumes: Task 2 `EditableRow.examples`, `rowIssues`; Task 1 types.

- [ ] **Step 1: Implement.**
  - `emptyRow()` adds `examples: ''`.
  - `WordEditorCard`: a second collapsible button below the detail one, same visual pattern (label `Add examples` / `Edit examples` / `Hide examples`, badge `N examples` when non-empty; count = non-blank lines), its own `open` state and ids `examples-${index}` / `examples-text-${index}`; inside, a `Textarea` rows 4, label `Example sentences (one per line: sentence | translation)`, placeholder `Enabling strict mode helps catch mistakes. | Bật chế độ nghiêm ngặt giúp phát hiện lỗi.`, `onChange` patches `{ examples }`.
  - `ImportPanel` help: mention the optional `examples` column (one `sentence | translation` per line inside the cell) and the `examples` array in JSON.
  - `SetEditor` help sentence: mention example sentences.
  - `WordCard` (set detail page): when `word.examples?.length`, render a list under the meanings (sentence text, translation muted), independent of the detail toggle.
- [ ] **Step 2: Main session verifies in the browser** (`preview_start`, Browser pane): open a set → editor → add examples → save → reopen: persisted; import a CSV with an `examples` column; set detail page shows sentences; the issue message for a ` | trans`-only line appears on the card; mobile width layout does not overflow.
- [ ] **Step 3: Commit** `feat: edit and show example sentences in My Sets`

---

### Task 5: Migrate My Vocabulary to the extras sidecar (delegate script, main runs and checks)

**Files:**

- Create: `scripts/build-word-extras.ts`, `public/dicts/my-vocab.extras.json`
- Delete: `public/dicts/my-vocab.detail.json`
- Modify: `src/resources/dictionary.ts` (the `myVocab` entry: `detailUrl` → `extrasUrl: '/dicts/my-vocab.extras.json'`)

**Interfaces:**

- Consumes: Task 1 `extractExamplesFromDetail`.

- [ ] **Step 1: Implement the script** `scripts/build-word-extras.ts <in.detail.json> <out.extras.json>`: for each `{ word: detail }` write `{ detail, examples? }` (examples only when non-empty; `detail` unchanged byte for byte, including its `Câu mẫu:` lines); keys keep their original order; pretty print with 2 spaces. Run with `npx vite-node -c vitest.config.ts scripts/build-word-extras.ts ...` (so the `@/` alias resolves).
- [ ] **Step 2: Main session runs it and checks** the result with a throwaway script: 555 keys, exactly the same keys as the input, 525 words with `examples`, 1166 examples in total, every `detail` identical to the old file, no example with empty `text`, every example's `text` appears inside its word's `detail`.
- [ ] **Step 3: Switch the dictionary entry, delete the old file** (`git rm`), run `npx vitest run` + `npx tsc --noEmit -p .`
- [ ] **Step 4: Commit** `feat: My Vocabulary example sentences as structured data`

---

### Task 6: Verification, review, docs (main session)

- [ ] **Step 1:** `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint src --ext .ts,.tsx` — all green.
- [ ] **Step 2: End-to-end in the browser** with the dev server: (a) existing profile that already has the `myvocab` custom set: after reload the set gains examples (backfill) and the user's edited words are untouched; (b) fresh profile (clear IndexedDB + `seededPersonalSets`): seed creates the set with examples; (c) copy a built-in set → copy carries detail; (d) import CSV and JSON with examples; (e) flashcards still show `detail` including the `Câu mẫu:` lines.
- [ ] **Step 3: Review the whole diff** against the Review Focus list; confirm each line has a test or a manual check; fix findings.
- [ ] **Step 4: Update `docs/toBuildDict.md`** with the `examples` field, the `text | trans` syntax, and the extras sidecar format (legacy string value still valid).
- [ ] **Step 5: Commit** `docs: describe example sentences and the extras sidecar`
