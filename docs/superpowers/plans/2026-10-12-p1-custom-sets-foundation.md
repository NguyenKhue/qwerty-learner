# P1 — Foundation + User-Created Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user create, import, edit, duplicate and delete their own vocabulary sets in the browser, and practise them in the existing typing mode and Gallery, with the data model ready for the later study modes (P2–P4).

**Architecture:** Custom sets live in a new Dexie table `customDicts` (one record per set holding its `Word[]`). A tiny adapter (`idb:<id>` URLs in `wordListFetcher`) lets every existing consumer read a custom set exactly like a built-in dictionary. A jotai atom (`customDictionariesAtom`, kept in sync by a root component with `useLiveQuery`) merges custom sets with the static built-ins, and `currentDictInfoAtom` plus the few places that used the static `idDictionaryMap` resolve through it. New pages `/my-sets` and `/my-sets/:id` manage sets. `cardProgress` is created now (empty) so P2 only adds logic.

**Tech Stack:** React 18, TypeScript (target es5, strict), Vite 4, jotai 2.1, Dexie 3.2 + dexie-react-hooks 1.1, Tailwind + Radix, Vitest 0.34 + fake-indexeddb (added in Task 1), react-router-dom 6.

**Spec:** `docs/superpowers/specs/2026-10-12-study-modes-design.md` (section "P1 — Foundation + user-created sets").

## Global Constraints

Copied from the spec; every task implicitly includes them.

- Personal use only: everything stored in the browser (IndexedDB), no backend, no sharing, no accounts.
- Learning data is keyed by `(dictionary id, word)` — `cardProgress` key is `[dict+word]`.
- Dexie `version(4)`; the three existing tables (`wordRecords`, `chapterRecords`, `reviewRecords`) are unchanged.
- A custom set becomes a `Dictionary` with `id = custom:<id>`, `url = idb:<id>`, `category = 'My Sets'`, `language = 'en'`, `languageCategory = 'en'`, `length = words.length`, `chapterCount` via `calcChapterCount`.
- Word shape is the existing `Word = { name, trans: string[], usphone, ukphone, notation? }`.
- Names are unique within a set (case-sensitive); duplicates merged on import and on save.
- Import: CSV columns `name,trans,usphone,ukphone` (`trans` separated by `;`) or JSON in the existing dictionary-file format (`Word[]`); invalid rows are skipped and listed with line numbers and reasons; the valid rows can still be imported.
- Delete set: confirm dialog; also deletes that set's `cardProgress` rows.
- Unknown set id in a route: redirect (to `/my-sets` for the editor; the typing page falls back to `cet4`).
- Built-in dictionaries cannot be edited; they can be duplicated into a custom set.
- Out of scope: sharing, accounts/sync, mobile layout (the app redirects widths ≤ 600px to `/mobile`), editing built-ins.
- Code style: Prettier (no semicolons, single quotes, width 140, import sorting plugin) — run `npx prettier --write <files>` before every commit. TypeScript target is `es5`: no spreading/iterating `Map`/`Set` iterators (use `Array.from`).
- Branch: `feat/study-modes` (already created; the spec is committed on it).

## Deviations from the spec (decided while planning)

1. **No Playwright smoke test in P1.** `playwright.config.ts` points at the production site (`https://qwerty.kaiyi.cool`) and the existing specs use Chinese labels, so they cannot exercise local pages. P1 is verified with Vitest (logic + Dexie) plus a manual browser pass (Task 7). Adding a local Playwright project is a separate job.
2. **Deleting a set also deletes its typing records** (`wordRecords`, `chapterRecords`, `reviewRecords` with that `dict` id), not only `cardProgress`. Otherwise the Error Book would keep rows for a dictionary that no longer exists.
3. `idb:` loading and the DB layer are tested against `fake-indexeddb` in a Node environment.

## Review Focus

Inputs/conditions the spec implies but does not spell out, most likely to bite first. Each has a test in the owning task.

1. **Excel-style CSV** (UTF-8 BOM, CRLF line endings, quoted fields) must import cleanly — Task 2.
2. **Commas, quotes, `;` and newlines inside quoted cells**, and a bad row _after_ a multi-line cell must report the right line number — Task 2.
3. **Reload while a custom set is selected** must not reset the selection to `cet4` before the sets have loaded; **deleting the selected set** must fall back to `cet4` — Task 4 (`shouldResetDictId`).
4. **Importing a built-in-format JSON** (`notation` present, `trans` containing non-strings or a plain string) must keep what is valid and drop what is not — Task 2.
5. **Deleting a set** must remove only that set's progress and typing records, never another set's; and an **empty file / header-only CSV** must yield zero words (the UI then blocks creation) — Tasks 3 and 2.

## File Structure

Create:

- `vitest.config.ts` — Vitest config (alias `@`, `define`, Node env, setup file).
- `src/test/setup.ts` — loads `fake-indexeddb/auto`.
- `src/utils/custom-dict/parse.ts` — pure parsing/validation (CSV, JSON, editor rows, dedupe).
- `src/utils/custom-dict/parse.test.ts`
- `src/utils/db/database.ts` — the Dexie class + `db` instance (moved out of `index.ts`, adds v4).
- `src/utils/db/custom-dict.ts` — CRUD for `customDicts`, `customDictToDictionary`, id helpers.
- `src/utils/db/custom-dict.test.ts`
- `src/utils/db/copy-dict.ts` — duplicate a built-in/custom `Dictionary` into a new custom set.
- `src/utils/wordListFetcher.test.ts`
- `src/store/customDicts.ts` — atoms + `shouldResetDictId`.
- `src/store/customDicts.test.ts`
- `src/components/CustomDictsSync/index.tsx` — pushes live Dexie data into the atoms.
- `src/pages/MySets/index.tsx` — list page.
- `src/pages/MySets/ImportPanel.tsx`, `src/pages/MySets/CopyBuiltIn.tsx`, `src/pages/MySets/SetEditor.tsx`

Modify:

- `package.json`, `yarn.lock` — Vitest + fake-indexeddb, `test` script.
- `src/utils/db/record.ts` — add `CustomDictRecord`, `ICardProgress`.
- `src/utils/db/index.ts` — re-export `db` from `database.ts`.
- `src/utils/wordListFetcher.ts` — `idb:` branch.
- `src/store/index.ts` — `currentDictInfoAtom` uses `dictionaryByIdAtom`.
- `src/pages/Typing/index.tsx` — reset check uses `shouldResetDictId`.
- `src/pages/ErrorBook/ErrorRow.tsx`, `src/pages/ErrorBook/RowDetail/index.tsx`, `src/pages/ErrorBook/DropdownExport.tsx` — resolve dict via `dictionaryByIdAtom`.
- `src/pages/Gallery-N/index.tsx` — use `allDictionariesAtom`, add "My sets" button.
- `src/index.tsx` — mount `CustomDictsSync`, add routes.

---

### Task 1: Vitest tooling

**Files:**

- Modify: `package.json`, `yarn.lock`
- Create: `vitest.config.ts`, `src/test/setup.ts`, `src/test/smoke.test.ts`

**Interfaces:**

- Produces: `yarn test` runs `vitest run`; test files are `src/**/*.test.ts`; `indexedDB`/`IDBKeyRange` are available globally in tests; alias `@` → `src`; `REACT_APP_DEPLOY_ENV` is defined (empty string).

- [ ] **Step 1: Install dev dependencies**

Run: `yarn add -D vitest@^0.34.6 fake-indexeddb@^5.0.2`
Expected: both appear under `devDependencies` in `package.json`; `yarn.lock` changes. (Vitest 0.34 supports Vite ^3 || ^4; the repo uses Vite 4.)

- [ ] **Step 2: Change the `test` script**

In `package.json`, replace the line

```json
    "test": "echo \"No tests\"",
```

with

```json
    "test": "vitest run",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  define: {
    REACT_APP_DEPLOY_ENV: JSON.stringify(''),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import 'fake-indexeddb/auto'
```

- [ ] **Step 5: Write the smoke test**

Create `src/test/smoke.test.ts`:

```ts
import { CHAPTER_LENGTH } from '@/constants'
import { describe, expect, it } from 'vitest'

describe('test tooling', () => {
  it('resolves the @ alias', () => {
    expect(CHAPTER_LENGTH).toBe(20)
  })

  it('provides a fake IndexedDB', () => {
    expect(typeof indexedDB).toBe('object')
    expect(typeof IDBKeyRange).toBe('function')
  })
})
```

- [ ] **Step 6: Run it**

Run: `yarn test`
Expected: 2 tests PASS. If the run fails with a message about `window`/`document` being undefined, install `jsdom` (`yarn add -D jsdom`) and set `environment: 'jsdom'` in `vitest.config.ts`, then rerun.

- [ ] **Step 7: Make sure the app type-check is unaffected**

Run: `npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: `4` (the four errors that exist before this work: `isWordVisible` ×2, `gtag` ×2). Any other count means the new test files introduced an error — fix it before continuing.

- [ ] **Step 8: Commit**

```bash
npx prettier --write vitest.config.ts src/test/setup.ts src/test/smoke.test.ts package.json
git add package.json yarn.lock vitest.config.ts src/test
git commit -m "chore: add Vitest and fake-indexeddb for unit tests"
```

---

### Task 2: Parsing and validation module (`parse.ts`)

**Files:**

- Create: `src/utils/custom-dict/parse.ts`
- Test: `src/utils/custom-dict/parse.test.ts`

**Interfaces:**

- Consumes: `Word` from `@/typings`.
- Produces (exact signatures used by later tasks):

  - `type ParseError = { line: number; message: string }`
  - `type ParseResult = { words: Word[]; errors: ParseError[]; duplicates: string[] }`
  - `type EditableRow = { name: string; trans: string; usphone: string; ukphone: string }`
  - `splitTrans(value: string): string[]`
  - `normalizeWords(words: Word[]): { words: Word[]; duplicates: string[] }`
  - `parseCsvRows(input: string): { cells: string[]; line: number }[]`
  - `parseWordsCsv(text: string): ParseResult`
  - `parseWordsJson(text: string): ParseResult`
  - `parseWordsFile(fileName: string, text: string): ParseResult` (`.json` → JSON, anything else → CSV)
  - `rowsToWords(rows: EditableRow[]): ParseResult` (error `line` = 1-based row number in the editor)

- [ ] **Step 1: Write the failing tests**

Create `src/utils/custom-dict/parse.test.ts`:

```ts
import { normalizeWords, parseCsvRows, parseWordsCsv, parseWordsFile, parseWordsJson, rowsToWords, splitTrans } from './parse'
import { describe, expect, it } from 'vitest'

describe('splitTrans', () => {
  it('splits on ; ； and newlines, trims, drops empties', () => {
    expect(splitTrans(' a ; b；c\n\n d ;')).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('normalizeWords', () => {
  it('merges duplicate names, unions meanings and reports them', () => {
    const { words, duplicates } = normalizeWords([
      { name: 'run', trans: ['v. chạy'], usphone: 'a', ukphone: 'b' },
      { name: ' run ', trans: ['v. chạy', 'n. cuộc chạy'], usphone: '', ukphone: '' },
      { name: 'Run', trans: ['x'], usphone: '', ukphone: '' },
    ])
    expect(words.map((w) => w.name)).toEqual(['run', 'Run'])
    expect(words[0].trans).toEqual(['v. chạy', 'n. cuộc chạy'])
    expect(words[0].usphone).toBe('a')
    expect(duplicates).toEqual(['run'])
  })
})

describe('parseCsvRows', () => {
  it('handles quotes, commas, newlines inside quotes, CRLF and a BOM', () => {
    const rows = parseCsvRows('﻿a,"b\nc"\r\nd,"e ""x"", f"')
    expect(rows).toEqual([
      { cells: ['a', 'b\nc'], line: 1 },
      { cells: ['d', 'e "x", f'], line: 3 },
    ])
  })

  it('returns no rows for an empty string and ignores a trailing newline', () => {
    expect(parseCsvRows('')).toEqual([])
    expect(parseCsvRows('a,b\n')).toEqual([{ cells: ['a', 'b'], line: 1 }])
  })
})

describe('parseWordsCsv', () => {
  it('parses a header row and splits meanings on ;', () => {
    const r = parseWordsCsv('name,trans,usphone,ukphone\nstrict,adj. nghiêm ngặt; adj. khắt khe,strɪkt,strɪkt\n')
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([{ name: 'strict', trans: ['adj. nghiêm ngặt', 'adj. khắt khe'], usphone: 'strɪkt', ukphone: 'strɪkt' }])
  })

  it('works without a header and with only name and trans columns', () => {
    const r = parseWordsCsv('cat,con mèo\ndog,con chó')
    expect(r.words.map((w) => [w.name, w.trans, w.usphone, w.ukphone])).toEqual([
      ['cat', ['con mèo'], '', ''],
      ['dog', ['con chó'], '', ''],
    ])
  })

  it('imports an Excel-style file (BOM, CRLF, quoted commas)', () => {
    const r = parseWordsCsv('﻿name,trans\r\n"hello, world","xin chào; chào"\r\n')
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([{ name: 'hello, world', trans: ['xin chào', 'chào'], usphone: '', ukphone: '' }])
  })

  it('reports bad rows with the correct line, even after a multi-line cell', () => {
    const r = parseWordsCsv('name,trans\n"a\nb",x\nbad,\n,orphan\nok,fine')
    expect(r.words.map((w) => w.name)).toEqual(['a\nb', 'ok'])
    expect(r.errors).toEqual([
      { line: 4, message: '"bad" has no meaning' },
      { line: 5, message: 'Missing word' },
    ])
  })

  it('merges duplicates and reports them', () => {
    const r = parseWordsCsv('a,x\na,y')
    expect(r.words).toEqual([{ name: 'a', trans: ['x', 'y'], usphone: '', ukphone: '' }])
    expect(r.duplicates).toEqual(['a'])
  })

  it('yields no words and no errors for a header-only or empty file', () => {
    expect(parseWordsCsv('name,trans,usphone,ukphone\n')).toEqual({ words: [], errors: [], duplicates: [] })
    expect(parseWordsCsv('')).toEqual({ words: [], errors: [], duplicates: [] })
  })
})

describe('parseWordsJson', () => {
  it('accepts the built-in dictionary format and keeps notation', () => {
    const r = parseWordsJson(JSON.stringify([{ name: 'cancel', trans: ['huỷ'], usphone: "'kænsl", ukphone: "'kænsl", notation: 'x' }]))
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([{ name: 'cancel', trans: ['huỷ'], usphone: "'kænsl", ukphone: "'kænsl", notation: 'x' }])
  })

  it('keeps valid meanings, accepts a plain string trans, and rejects the rest per item', () => {
    const r = parseWordsJson(
      JSON.stringify([
        { name: 'a', trans: ['ok', 5, null, '  '], usphone: 1 },
        { name: 'b', trans: 'single' },
        { name: 'c', trans: [] },
        { trans: ['no name'] },
        'junk',
      ]),
    )
    expect(r.words).toEqual([
      { name: 'a', trans: ['ok'], usphone: '', ukphone: '' },
      { name: 'b', trans: ['single'], usphone: '', ukphone: '' },
    ])
    expect(r.errors).toEqual([
      { line: 3, message: '"c" has no meaning' },
      { line: 4, message: 'Missing word' },
      { line: 5, message: 'Not an object' },
    ])
  })

  it('reports invalid JSON and non-array JSON', () => {
    expect(parseWordsJson('{nope').errors).toEqual([{ line: 1, message: 'Invalid JSON' }])
    expect(parseWordsJson('{"a":1}').errors).toEqual([{ line: 1, message: 'JSON must be an array of words' }])
  })
})

describe('parseWordsFile', () => {
  it('chooses the parser by extension', () => {
    expect(parseWordsFile('x.JSON', '[{"name":"a","trans":["b"]}]').words).toHaveLength(1)
    expect(parseWordsFile('x.csv', 'a,b').words).toHaveLength(1)
    expect(parseWordsFile('x.txt', 'a,b').words).toHaveLength(1)
  })
})

describe('rowsToWords', () => {
  it('skips blank rows, numbers rows from 1 and reports problems', () => {
    const r = rowsToWords([
      { name: 'a', trans: 'x\ny', usphone: '', ukphone: '' },
      { name: '', trans: '', usphone: '', ukphone: '' },
      { name: 'b', trans: '', usphone: '', ukphone: '' },
      { name: '', trans: 'orphan', usphone: '', ukphone: '' },
    ])
    expect(r.words).toEqual([{ name: 'a', trans: ['x', 'y'], usphone: '', ukphone: '' }])
    expect(r.errors).toEqual([
      { line: 3, message: '"b" has no meaning' },
      { line: 4, message: 'Missing word' },
    ])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `yarn test src/utils/custom-dict/parse.test.ts`
Expected: FAIL — cannot find module `./parse`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/custom-dict/parse.ts`:

```ts
import type { Word } from '@/typings'

export type ParseError = { line: number; message: string }
export type ParseResult = { words: Word[]; errors: ParseError[]; duplicates: string[] }
export type EditableRow = { name: string; trans: string; usphone: string; ukphone: string }

const MISSING_WORD = 'Missing word'
const noMeaning = (name: string) => `"${name}" has no meaning`

export function splitTrans(value: string): string[] {
  return value
    .split(/[;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function normalizeWords(words: Word[]): { words: Word[]; duplicates: string[] } {
  const byName = new Map<string, Word>()
  const duplicates: string[] = []
  words.forEach((word) => {
    const name = word.name.trim()
    const existing = byName.get(name)
    if (existing) {
      if (duplicates.indexOf(name) === -1) duplicates.push(name)
      word.trans.forEach((t) => {
        if (existing.trans.indexOf(t) === -1) existing.trans.push(t)
      })
      return
    }
    byName.set(name, { ...word, name, trans: word.trans.slice() })
  })
  return { words: Array.from(byName.values()), duplicates }
}

export function parseCsvRows(input: string): { cells: string[]; line: number }[] {
  const text = input.replace(/^﻿/, '')
  const rows: { cells: string[]; line: number }[] = []
  let cells: string[] = []
  let cell = ''
  let inQuotes = false
  let line = 1
  let rowLine = 1
  let i = 0

  const pushRow = () => {
    cells.push(cell)
    rows.push({ cells, line: rowLine })
    cells = []
    cell = ''
  }

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      if (ch === '\n') line++
      cell += ch
      i++
      continue
    }
    if (ch === '"' && cell === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === ',') {
      cells.push(cell)
      cell = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      pushRow()
      line++
      rowLine = line
      i++
      continue
    }
    cell += ch
    i++
  }
  if (cell !== '' || cells.length > 0) pushRow()
  return rows
}

export function parseWordsCsv(text: string): ParseResult {
  const rows = parseCsvRows(text).filter((row) => row.cells.some((c) => c.trim() !== ''))
  const start = rows.length > 0 && rows[0].cells[0].trim().toLowerCase() === 'name' ? 1 : 0
  const words: Word[] = []
  const errors: ParseError[] = []

  rows.slice(start).forEach(({ cells, line }) => {
    const [name = '', trans = '', usphone = '', ukphone = ''] = cells.map((c) => c.trim())
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    const meanings = splitTrans(trans)
    if (meanings.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    words.push({ name, trans: meanings, usphone, ukphone })
  })

  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}

export function parseWordsJson(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return { words: [], errors: [{ line: 1, message: 'Invalid JSON' }], duplicates: [] }
  }
  if (!Array.isArray(data)) {
    return { words: [], errors: [{ line: 1, message: 'JSON must be an array of words' }], duplicates: [] }
  }

  const words: Word[] = []
  const errors: ParseError[] = []
  data.forEach((item: unknown, index: number) => {
    const line = index + 1
    if (!item || typeof item !== 'object') {
      errors.push({ line, message: 'Not an object' })
      return
    }
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    const rawTrans: unknown[] = Array.isArray(o.trans) ? o.trans : typeof o.trans === 'string' ? [o.trans] : []
    const trans = rawTrans
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
    if (trans.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    const word: Word = {
      name,
      trans,
      usphone: typeof o.usphone === 'string' ? o.usphone.trim() : '',
      ukphone: typeof o.ukphone === 'string' ? o.ukphone.trim() : '',
    }
    if (typeof o.notation === 'string' && o.notation) word.notation = o.notation
    words.push(word)
  })

  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}

export function parseWordsFile(fileName: string, text: string): ParseResult {
  return fileName.toLowerCase().endsWith('.json') ? parseWordsJson(text) : parseWordsCsv(text)
}

export function rowsToWords(rows: EditableRow[]): ParseResult {
  const words: Word[] = []
  const errors: ParseError[] = []
  rows.forEach((row, index) => {
    const line = index + 1
    const name = row.name.trim()
    const meanings = splitTrans(row.trans)
    const phones = row.usphone.trim() + row.ukphone.trim()
    if (!name && meanings.length === 0 && !phones) return
    if (!name) {
      errors.push({ line, message: MISSING_WORD })
      return
    }
    if (meanings.length === 0) {
      errors.push({ line, message: noMeaning(name) })
      return
    }
    words.push({ name, trans: meanings, usphone: row.usphone.trim(), ukphone: row.ukphone.trim() })
  })
  const normalized = normalizeWords(words)
  return { words: normalized.words, errors, duplicates: normalized.duplicates }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `yarn test src/utils/custom-dict/parse.test.ts`
Expected: all tests PASS. If the multi-line line-number test fails, re-check that `line++` happens both inside quotes on `\n` and when a row ends.

- [ ] **Step 5: Lint and type-check**

Run: `npx eslint src/utils/custom-dict && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: eslint prints nothing (no errors); tsc count `4`.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/utils/custom-dict
git add src/utils/custom-dict
git commit -m "feat: add CSV/JSON/editor-row parsing for custom sets"
```

---

### Task 3: Database v4, custom-set CRUD, `idb:` loading

**Files:**

- Create: `src/utils/db/database.ts`, `src/utils/db/custom-dict.ts`, `src/utils/db/copy-dict.ts`
- Test: `src/utils/db/custom-dict.test.ts`, `src/utils/wordListFetcher.test.ts`
- Modify: `src/utils/db/record.ts`, `src/utils/db/index.ts:1-41`, `src/utils/wordListFetcher.ts`

**Interfaces:**

- Consumes: `normalizeWords` (Task 2), `Word`, `Dictionary` from `@/typings`, `calcChapterCount` from `@/utils`.
- Produces:

  - `db` (same export as before, now also from `@/utils/db/database`) with new tables `db.customDicts: Table<CustomDictRecord, string>` and `db.cardProgress: Table<ICardProgress, [string, string]>`.
  - `CUSTOM_DICT_PREFIX = 'custom:'`, `CUSTOM_URL_PREFIX = 'idb:'`
  - `type CustomDictInput = { name: string; description?: string; words: Word[] }`
  - `createCustomDict(input): Promise<CustomDictRecord>`
  - `updateCustomDict(id: string, input): Promise<void>` (throws if the id does not exist)
  - `deleteCustomDict(id: string): Promise<void>` (id is the bare record id, no prefix)
  - `getCustomDict(id): Promise<CustomDictRecord | undefined>`
  - `listCustomDicts(): Promise<CustomDictRecord[]>` (ordered by `createdAt` ascending)
  - `getCustomDictWords(id): Promise<Word[]>` (throws if missing)
  - `customDictToDictionary(rec: CustomDictRecord): Dictionary`
  - `customIdOf(dictId: string): string` (strips `custom:`)
  - `duplicateDictionaryAsCustom(dict: Dictionary, name?: string): Promise<CustomDictRecord>`
  - `wordListFetcher('idb:<id>')` resolves the custom set's words.

- [ ] **Step 1: Add the record types**

Append to `src/utils/db/record.ts`:

```ts
export interface CustomDictRecord {
  // Bare id; the Dictionary id is `custom:<id>`
  id: string
  name: string
  description: string
  words: Word[]
  createdAt: number
  updatedAt: number
}

// Spaced-repetition state of one word in one dictionary (used by the study modes)
export interface ICardProgress {
  dict: string
  word: string
  state: 'learning' | 'review'
  // Next review time in ms since epoch
  due: number
  // Days
  interval: number
  ease: number
  reps: number
  lapses: number
  firstSeen: number
  lastReviewed: number
}
```

(`Word` is already imported at the top of `record.ts`.)

- [ ] **Step 2: Move the Dexie class into `database.ts` and add version 4**

Create `src/utils/db/database.ts`:

```ts
import type { CustomDictRecord, IChapterRecord, ICardProgress, IReviewRecord, IRevisionDictRecord, IWordRecord } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'
import type { Table } from 'dexie'
import Dexie from 'dexie'

class RecordDB extends Dexie {
  wordRecords!: Table<IWordRecord, number>
  chapterRecords!: Table<IChapterRecord, number>
  reviewRecords!: Table<IReviewRecord, number>

  revisionDictRecords!: Table<IRevisionDictRecord, number>
  revisionWordRecords!: Table<IWordRecord, number>

  customDicts!: Table<CustomDictRecord, string>
  cardProgress!: Table<ICardProgress, [string, string]>

  constructor() {
    super('RecordDB')
    this.version(1).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,errorCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(2).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
    })
    this.version(3).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
    })
    this.version(4).stores({
      wordRecords: '++id,word,timeStamp,dict,chapter,wrongCount,[dict+chapter]',
      chapterRecords: '++id,timeStamp,dict,chapter,time,[dict+chapter]',
      reviewRecords: '++id,dict,createTime,isFinished',
      customDicts: 'id,name,updatedAt,createdAt',
      cardProgress: '[dict+word],dict,due',
    })
  }
}

export const db = new RecordDB()

db.wordRecords.mapToClass(WordRecord)
db.chapterRecords.mapToClass(ChapterRecord)
db.reviewRecords.mapToClass(ReviewRecord)
```

Note: `IRevisionDictRecord` is imported from `./record` exactly as `src/utils/db/index.ts` does today — confirm it exists there (`rg "IRevisionDictRecord" src/utils/db/record.ts`); keep the import list identical to the one being removed from `index.ts` plus the two new types.

- [ ] **Step 3: Make `index.ts` use and re-export `db`**

In `src/utils/db/index.ts`, replace lines 1–41 (the imports through `db.reviewRecords.mapToClass(ReviewRecord)`) so the head of the file becomes:

```ts
import { db } from './database'
import type { IChapterRecord, IReviewRecord, IRevisionDictRecord, IWordRecord, LetterMistakes } from './record'
import { ChapterRecord, ReviewRecord, WordRecord } from './record'
import { TypingContext, TypingStateActionType } from '@/pages/Typing/store'
import type { TypingState } from '@/pages/Typing/store/type'
import { currentChapterAtom, currentDictIdAtom, isReviewModeAtom } from '@/store'
import { useAtomValue } from 'jotai'
import { useCallback, useContext } from 'react'

export { db }
```

Delete the `class RecordDB extends Dexie { ... }` block, `export const db = new RecordDB()` and the three `mapToClass` lines. Then run `npx eslint src/utils/db/index.ts`: remove any import it reports as unused (for example `IChapterRecord`, `IReviewRecord`, `IRevisionDictRecord`, `IWordRecord`, `ReviewRecord`, `WordRecord` if the rest of the file no longer uses them) and keep the ones it still needs. Behaviour must be identical to before.

- [ ] **Step 4: Write the failing DB tests**

Create `src/utils/db/custom-dict.test.ts`:

```ts
import {
  CUSTOM_DICT_PREFIX,
  createCustomDict,
  customDictToDictionary,
  customIdOf,
  deleteCustomDict,
  getCustomDict,
  getCustomDictWords,
  listCustomDicts,
  updateCustomDict,
} from './custom-dict'
import { db } from './database'
import type { ICardProgress, IWordRecord } from './record'
import { beforeEach, describe, expect, it } from 'vitest'

const word = (name: string) => ({ name, trans: [`n. ${name}`], usphone: '', ukphone: '' })
const progress = (dict: string, w: string): ICardProgress => ({
  dict,
  word: w,
  state: 'review',
  due: 0,
  interval: 1,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: 0,
  lastReviewed: 0,
})
const typingRecord = (dict: string) =>
  ({ word: 'x', timeStamp: 1, dict, chapter: 0, timing: [], wrongCount: 0, mistakes: {} } as unknown as IWordRecord)

beforeEach(async () => {
  await Promise.all([
    db.customDicts.clear(),
    db.cardProgress.clear(),
    db.wordRecords.clear(),
    db.chapterRecords.clear(),
    db.reviewRecords.clear(),
  ])
})

describe('custom dictionaries', () => {
  it('creates, reads and lists sets; ids are unique and words are de-duplicated', async () => {
    const a = await createCustomDict({ name: ' Set A ', description: 'd', words: [word('x'), word('x'), word('y')] })
    // createdAt is the list order; make sure the second set gets a later timestamp
    await new Promise((resolve) => setTimeout(resolve, 5))
    const b = await createCustomDict({ name: 'Set B', words: [word('z')] })
    expect(a.id).not.toBe(b.id)
    expect(a.name).toBe('Set A')
    expect(a.words.map((w) => w.name)).toEqual(['x', 'y'])
    expect((await getCustomDict(a.id))?.words).toHaveLength(2)
    expect((await listCustomDicts()).map((r) => r.name)).toEqual(['Set A', 'Set B'])
    expect(b.description).toBe('')
  })

  it('updates a set and throws for an unknown id', async () => {
    const a = await createCustomDict({ name: 'A', words: [word('x')] })
    await updateCustomDict(a.id, { name: 'A2', description: 'new', words: [word('y'), word('z')] })
    const updated = await getCustomDict(a.id)
    expect(updated?.name).toBe('A2')
    expect(updated?.words.map((w) => w.name)).toEqual(['y', 'z'])
    expect(updated?.createdAt).toBe(a.createdAt)
    expect((updated?.updatedAt ?? 0) >= a.updatedAt).toBe(true)
    await expect(updateCustomDict('missing', { name: 'x', words: [] })).rejects.toThrow()
  })

  it('deleting a set removes only its own progress and typing records', async () => {
    const a = await createCustomDict({ name: 'A', words: [word('x')] })
    const b = await createCustomDict({ name: 'B', words: [word('x')] })
    const dictA = CUSTOM_DICT_PREFIX + a.id
    const dictB = CUSTOM_DICT_PREFIX + b.id
    await db.cardProgress.bulkPut([progress(dictA, 'x'), progress(dictB, 'x')])
    await db.wordRecords.bulkAdd([typingRecord(dictA), typingRecord(dictB), typingRecord('cet4')])

    await deleteCustomDict(a.id)

    expect(await getCustomDict(a.id)).toBeUndefined()
    expect(await db.cardProgress.where('dict').equals(dictA).count()).toBe(0)
    expect(await db.wordRecords.where('dict').equals(dictA).count()).toBe(0)
    expect(await db.cardProgress.where('dict').equals(dictB).count()).toBe(1)
    expect(await db.wordRecords.where('dict').equals(dictB).count()).toBe(1)
    expect(await db.wordRecords.where('dict').equals('cet4').count()).toBe(1)
    expect(await getCustomDict(b.id)).toBeDefined()
  })

  it('getCustomDictWords returns the words and throws for an unknown id', async () => {
    const a = await createCustomDict({ name: 'A', words: [word('x')] })
    expect((await getCustomDictWords(a.id)).map((w) => w.name)).toEqual(['x'])
    await expect(getCustomDictWords('missing')).rejects.toThrow()
  })

  it('maps a record to a Dictionary', () => {
    const dict = customDictToDictionary({
      id: 'abc',
      name: 'My set',
      description: 'desc',
      words: Array.from({ length: 41 }, (_, i) => word(`w${i}`)),
      createdAt: 1,
      updatedAt: 2,
    })
    expect(dict).toEqual({
      id: 'custom:abc',
      name: 'My set',
      description: 'desc',
      category: 'My Sets',
      tags: ['Custom'],
      url: 'idb:abc',
      length: 41,
      language: 'en',
      languageCategory: 'en',
      chapterCount: 3,
    })
    expect(customIdOf(dict.id)).toBe('abc')
    expect(customIdOf('cet4')).toBe('cet4')
  })
})
```

Create `src/utils/wordListFetcher.test.ts`:

```ts
import { createCustomDict } from './db/custom-dict'
import { wordListFetcher } from './wordListFetcher'
import { describe, expect, it } from 'vitest'

describe('wordListFetcher', () => {
  it('reads a custom set through an idb: url', async () => {
    const rec = await createCustomDict({ name: 'S', words: [{ name: 'a', trans: ['b'], usphone: '', ukphone: '' }] })
    const words = await wordListFetcher(`idb:${rec.id}`)
    expect(words).toEqual([{ name: 'a', trans: ['b'], usphone: '', ukphone: '' }])
  })

  it('rejects for an unknown custom set', async () => {
    await expect(wordListFetcher('idb:missing')).rejects.toThrow()
  })
})
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `yarn test src/utils/db src/utils/wordListFetcher.test.ts`
Expected: FAIL — cannot find module `./custom-dict`.

- [ ] **Step 6: Implement `custom-dict.ts`**

Create `src/utils/db/custom-dict.ts`:

```ts
import { db } from './database'
import type { CustomDictRecord } from './record'
import type { Dictionary, Word } from '@/typings'
import { calcChapterCount } from '@/utils'
import { normalizeWords } from '@/utils/custom-dict/parse'

export const CUSTOM_DICT_PREFIX = 'custom:'
export const CUSTOM_URL_PREFIX = 'idb:'

export type CustomDictInput = { name: string; description?: string; words: Word[] }

function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function customIdOf(dictId: string): string {
  return dictId.indexOf(CUSTOM_DICT_PREFIX) === 0 ? dictId.slice(CUSTOM_DICT_PREFIX.length) : dictId
}

export function customDictToDictionary(rec: CustomDictRecord): Dictionary {
  return {
    id: CUSTOM_DICT_PREFIX + rec.id,
    name: rec.name,
    description: rec.description,
    category: 'My Sets',
    tags: ['Custom'],
    url: CUSTOM_URL_PREFIX + rec.id,
    length: rec.words.length,
    language: 'en',
    languageCategory: 'en',
    chapterCount: calcChapterCount(rec.words.length),
  }
}

export async function createCustomDict(input: CustomDictInput): Promise<CustomDictRecord> {
  const now = Date.now()
  const record: CustomDictRecord = {
    id: newId(),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    words: normalizeWords(input.words).words,
    createdAt: now,
    updatedAt: now,
  }
  await db.customDicts.add(record)
  return record
}

export async function updateCustomDict(id: string, input: CustomDictInput): Promise<void> {
  const existing = await db.customDicts.get(id)
  if (!existing) throw new Error(`Custom dictionary ${id} not found`)
  await db.customDicts.put({
    ...existing,
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    words: normalizeWords(input.words).words,
    updatedAt: Date.now(),
  })
}

export async function deleteCustomDict(id: string): Promise<void> {
  const dictId = CUSTOM_DICT_PREFIX + id
  await db.transaction('rw', [db.customDicts, db.cardProgress, db.wordRecords, db.chapterRecords, db.reviewRecords], async () => {
    await db.cardProgress.where('dict').equals(dictId).delete()
    await db.wordRecords.where('dict').equals(dictId).delete()
    await db.chapterRecords.where('dict').equals(dictId).delete()
    await db.reviewRecords.where('dict').equals(dictId).delete()
    await db.customDicts.delete(id)
  })
}

export async function getCustomDict(id: string): Promise<CustomDictRecord | undefined> {
  return db.customDicts.get(id)
}

export async function listCustomDicts(): Promise<CustomDictRecord[]> {
  return db.customDicts.orderBy('createdAt').toArray()
}

export async function getCustomDictWords(id: string): Promise<Word[]> {
  const record = await db.customDicts.get(id)
  if (!record) throw new Error(`Custom dictionary ${id} not found`)
  return record.words
}
```

- [ ] **Step 7: Add the `idb:` branch to `wordListFetcher.ts`**

Replace the whole file `src/utils/wordListFetcher.ts` with:

```ts
import { CUSTOM_URL_PREFIX, getCustomDictWords } from './db/custom-dict'
import type { Word } from '@/typings'

export async function wordListFetcher(url: string): Promise<Word[]> {
  if (url.indexOf(CUSTOM_URL_PREFIX) === 0) {
    return getCustomDictWords(url.slice(CUSTOM_URL_PREFIX.length))
  }

  const URL_PREFIX: string = REACT_APP_DEPLOY_ENV === 'pages' ? '/qwerty-learner' : ''

  const response = await fetch(URL_PREFIX + url)
  const words: Word[] = await response.json()
  return words
}
```

- [ ] **Step 8: Implement `copy-dict.ts`**

Create `src/utils/db/copy-dict.ts`:

```ts
import { createCustomDict } from './custom-dict'
import type { CustomDictRecord } from './record'
import type { Dictionary } from '@/typings'
import { wordListFetcher } from '@/utils/wordListFetcher'

export async function duplicateDictionaryAsCustom(dict: Dictionary, name?: string): Promise<CustomDictRecord> {
  const words = await wordListFetcher(dict.url)
  return createCustomDict({
    name: name?.trim() || `${dict.name} (copy)`,
    description: dict.description,
    words: words
      .filter((w) => typeof w.name === 'string' && w.name.trim() !== '')
      .map((w) => ({ ...w, trans: Array.isArray(w.trans) ? w.trans.filter((t) => typeof t === 'string') : [] })),
  })
}
```

- [ ] **Step 9: Run the tests**

Run: `yarn test`
Expected: all test files PASS (smoke, parse, custom-dict, wordListFetcher). If importing `./database` fails in Node with a message about `window`/`document`, apply the jsdom fallback from Task 1 Step 6.

- [ ] **Step 10: Lint, type-check, make sure existing DB users still compile**

Run: `npx eslint src/utils && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: no eslint errors; tsc count `4`.

- [ ] **Step 11: Commit**

```bash
npx prettier --write src/utils
git add src/utils
git commit -m "feat: add customDicts/cardProgress tables, CRUD and idb: word loading"
```

---

### Task 4: Store, root sync and consumers of the dictionary map

**Files:**

- Create: `src/store/customDicts.ts`, `src/components/CustomDictsSync/index.tsx`
- Test: `src/store/customDicts.test.ts`
- Modify: `src/store/index.ts`, `src/pages/Typing/index.tsx`, `src/pages/ErrorBook/ErrorRow.tsx`, `src/pages/ErrorBook/RowDetail/index.tsx`, `src/pages/ErrorBook/DropdownExport.tsx`, `src/index.tsx`

**Interfaces:**

- Consumes: `customDictToDictionary`, `listCustomDicts`, `CUSTOM_DICT_PREFIX` (Task 3); `dictionaries`, `idDictionaryMap` from `@/resources/dictionary`.
- Produces:
  - `customDictionariesAtom: PrimitiveAtom<Dictionary[]>`
  - `customDictionariesLoadedAtom: PrimitiveAtom<boolean>`
  - `allDictionariesAtom: Atom<Dictionary[]>` (custom sets first, then built-ins)
  - `dictionaryByIdAtom: Atom<Record<string, Dictionary>>`
  - `shouldResetDictId(id: string, loaded: boolean, byId: Record<string, Dictionary>): boolean`
  - `<CustomDictsSync />` component (renders `null`)

Note on imports: `@/utils` → `mixpanel` → `@/store` → `store/customDicts` → `db/custom-dict` → `@/utils` is an import cycle, like the one the app already has through `@/resources/dictionary` → `@/utils`. It is safe because every cross-use (`CUSTOM_DICT_PREFIX`, `calcChapterCount`, atoms) happens inside functions at call time, never at module-evaluation time. Keep it that way: do not add top-level code in these modules that reads another module's exports while loading.

- [ ] **Step 1: Write the failing store tests**

Create `src/store/customDicts.test.ts`:

```ts
import {
  allDictionariesAtom,
  customDictionariesAtom,
  customDictionariesLoadedAtom,
  dictionaryByIdAtom,
  shouldResetDictId,
} from './customDicts'
import { dictionaries } from '@/resources/dictionary'
import type { Dictionary } from '@/typings'
import { createStore } from 'jotai'
import { describe, expect, it } from 'vitest'

const custom: Dictionary = {
  id: 'custom:abc',
  name: 'Mine',
  description: '',
  category: 'My Sets',
  tags: ['Custom'],
  url: 'idb:abc',
  length: 3,
  language: 'en',
  languageCategory: 'en',
  chapterCount: 1,
}

describe('dictionary atoms', () => {
  it('merges custom sets (first) with built-ins and resolves ids', () => {
    const store = createStore()
    expect(store.get(allDictionariesAtom)).toHaveLength(dictionaries.length)
    store.set(customDictionariesAtom, [custom])
    const all = store.get(allDictionariesAtom)
    expect(all[0].id).toBe('custom:abc')
    expect(all).toHaveLength(dictionaries.length + 1)
    const byId = store.get(dictionaryByIdAtom)
    expect(byId['custom:abc']).toBe(custom)
    expect(byId.cet4.id).toBe('cet4')
  })

  it('starts with loaded = false', () => {
    expect(createStore().get(customDictionariesLoadedAtom)).toBe(false)
  })
})

describe('shouldResetDictId', () => {
  const byId = { cet4: dictionaries.find((d) => d.id === 'cet4') as Dictionary, 'custom:abc': custom }

  it('keeps known dictionaries', () => {
    expect(shouldResetDictId('cet4', false, byId)).toBe(false)
    expect(shouldResetDictId('custom:abc', true, byId)).toBe(false)
  })

  it('does not reset a custom id before the custom sets have loaded (reload case)', () => {
    expect(shouldResetDictId('custom:gone', false, { cet4: byId.cet4 })).toBe(false)
  })

  it('resets a custom id that is missing after loading (deleted set)', () => {
    expect(shouldResetDictId('custom:gone', true, { cet4: byId.cet4 })).toBe(true)
  })

  it('resets an unknown built-in id regardless of loading', () => {
    expect(shouldResetDictId('nope', false, byId)).toBe(true)
    expect(shouldResetDictId('nope', true, byId)).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/store`
Expected: FAIL — cannot find module `./customDicts`.

- [ ] **Step 3: Implement `src/store/customDicts.ts`**

```ts
import { dictionaries, idDictionaryMap } from '@/resources/dictionary'
import type { Dictionary } from '@/typings'
import { CUSTOM_DICT_PREFIX } from '@/utils/db/custom-dict'
import { atom } from 'jotai'

export const customDictionariesAtom = atom<Dictionary[]>([])
export const customDictionariesLoadedAtom = atom(false)

export const allDictionariesAtom = atom<Dictionary[]>((get) => get(customDictionariesAtom).concat(dictionaries))

export const dictionaryByIdAtom = atom<Record<string, Dictionary>>((get) => {
  const byId: Record<string, Dictionary> = { ...idDictionaryMap }
  get(customDictionariesAtom).forEach((dict) => {
    byId[dict.id] = dict
  })
  return byId
})

/**
 * Whether the persisted current-dictionary id should be reset to the default.
 * A custom id is kept until the custom sets have been loaded from IndexedDB, so a page reload does not lose the selection.
 */
export function shouldResetDictId(id: string, customLoaded: boolean, byId: Record<string, Dictionary>): boolean {
  if (id in byId) return false
  if (id.indexOf(CUSTOM_DICT_PREFIX) === 0 && !customLoaded) return false
  return true
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test src/store`
Expected: PASS.

- [ ] **Step 5: Make `currentDictInfoAtom` resolve through the new atom**

In `src/store/index.ts`:

1. Remove the line `import { idDictionaryMap } from '@/resources/dictionary'` and add `import { dictionaryByIdAtom } from './customDicts'`.
2. Replace the `currentDictInfoAtom` definition

```ts
export const currentDictInfoAtom = atom<Dictionary>((get) => {
  const id = get(currentDictIdAtom)
  let dict = idDictionaryMap[id]
  // If dict does not exist, return cet4. Typing checks whether DictId exists, and resets it to cet4 if it does not
  if (!dict) {
    dict = idDictionaryMap.cet4
  }
  return dict
})
```

with

```ts
export const currentDictInfoAtom = atom<Dictionary>((get) => {
  const id = get(currentDictIdAtom)
  const byId = get(dictionaryByIdAtom)
  // If dict does not exist (or a custom set has not loaded yet), return cet4. Typing checks whether DictId exists, and resets it to cet4 if it does not
  return byId[id] ?? byId.cet4
})
```

- [ ] **Step 6: Typing page reset check**

In `src/pages/Typing/index.tsx`: remove the line `import { idDictionaryMap } from '@/resources/dictionary'`; add

```ts
import { customDictionariesLoadedAtom, dictionaryByIdAtom, shouldResetDictId } from '@/store/customDicts'
```

and replace the effect

```tsx
useEffect(() => {
  const id = currentDictId
  if (!(id in idDictionaryMap)) {
    setCurrentDictId('cet4')
    setCurrentChapter(0)
    return
  }
}, [currentDictId, setCurrentChapter, setCurrentDictId])
```

with

```tsx
const dictionaryById = useAtomValue(dictionaryByIdAtom)
const customLoaded = useAtomValue(customDictionariesLoadedAtom)
useEffect(() => {
  if (shouldResetDictId(currentDictId, customLoaded, dictionaryById)) {
    setCurrentDictId('cet4')
    setCurrentChapter(0)
  }
}, [currentDictId, customLoaded, dictionaryById, setCurrentChapter, setCurrentDictId])
```

(`useAtomValue` is already imported there.)

- [ ] **Step 7: Error Book consumers**

`src/pages/ErrorBook/ErrorRow.tsx`: remove `import { idDictionaryMap } from '@/resources/dictionary'`; change `import { useSetAtom } from 'jotai'` to `import { useAtomValue, useSetAtom } from 'jotai'`; add `import { dictionaryByIdAtom } from '@/store/customDicts'`; replace `const dictInfo = idDictionaryMap[record.dict]` with

```tsx
const dictionaryById = useAtomValue(dictionaryByIdAtom)
const dictInfo = dictionaryById[record.dict]
```

`src/pages/ErrorBook/RowDetail/index.tsx`: same two import changes (`useAtomValue` + `dictionaryByIdAtom`, drop `idDictionaryMap`); replace `const dictInfo = idDictionaryMap[currentRowDetail.dict]` with

```tsx
const dictionaryById = useAtomValue(dictionaryByIdAtom)
const dictInfo = dictionaryById[currentRowDetail.dict]
```

`src/pages/ErrorBook/DropdownExport.tsx`: remove `import { idDictionaryMap } from '@/resources/dictionary'`; add `import { dictionaryByIdAtom } from '@/store/customDicts'` and `import { useAtomValue } from 'jotai'`; inside the component, right after `const [isExporting, setIsExporting] = useState(false)` add `const dictionaryById = useAtomValue(dictionaryByIdAtom)`; replace both occurrences of `idDictionaryMap[item.dict]` with `dictionaryById[item.dict]`.

- [ ] **Step 8: Create the sync component**

Create `src/components/CustomDictsSync/index.tsx`:

```tsx
import { customDictionariesAtom, customDictionariesLoadedAtom } from '@/store/customDicts'
import { customDictToDictionary, listCustomDicts } from '@/utils/db/custom-dict'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSetAtom } from 'jotai'
import { useEffect } from 'react'

/** Keeps the custom-set atoms in sync with IndexedDB (live: edits elsewhere in the app show up immediately). */
export default function CustomDictsSync() {
  const records = useLiveQuery(() => listCustomDicts(), [])
  const setDictionaries = useSetAtom(customDictionariesAtom)
  const setLoaded = useSetAtom(customDictionariesLoadedAtom)

  useEffect(() => {
    if (!records) return
    setDictionaries(records.map(customDictToDictionary))
    setLoaded(true)
  }, [records, setDictionaries, setLoaded])

  return null
}
```

- [ ] **Step 9: Mount it in the app root**

In `src/index.tsx` add `import CustomDictsSync from './components/CustomDictsSync'` next to the other component imports, and render `<CustomDictsSync />` immediately before `<Analytics />`:

```tsx
      <CustomDictsSync />
      <Analytics />
```

- [ ] **Step 10: Verify**

Run: `yarn test && npx eslint src && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: all tests PASS; no eslint errors (6 pre-existing warnings are fine); tsc count `4`.

Then start the dev server (`yarn dev`) and confirm in the browser that the typing page and `/error-book` still render with no console errors.

- [ ] **Step 11: Commit**

```bash
npx prettier --write src/store src/components/CustomDictsSync src/pages/Typing/index.tsx src/pages/ErrorBook src/index.tsx
git add src
git commit -m "feat: resolve dictionaries through a store that includes custom sets"
```

---

### Task 5: My Sets page (list, import, copy built-in) and Gallery wiring

**Files:**

- Create: `src/pages/MySets/index.tsx`, `src/pages/MySets/ImportPanel.tsx`, `src/pages/MySets/CopyBuiltIn.tsx`
- Modify: `src/pages/Gallery-N/index.tsx`, `src/index.tsx`

**Interfaces:**

- Consumes: `customDictionariesAtom`, `allDictionariesAtom` (Task 4); `deleteCustomDict`, `createCustomDict`, `customIdOf` (Task 3); `duplicateDictionaryAsCustom` (Task 3); `parseWordsFile`, `ParseResult` (Task 2); `currentDictIdAtom`, `currentChapterAtom` from `@/store`.
- Produces: route `/my-sets` (list), route `/my-sets/:id` is added in Task 6; this task links to `/my-sets/new` and `/my-sets/<bare id>`.

- [ ] **Step 1: Create `ImportPanel.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { parseWordsFile } from '@/utils/custom-dict/parse'
import type { ParseResult } from '@/utils/custom-dict/parse'
import { createCustomDict } from '@/utils/db/custom-dict'
import { useState } from 'react'

const MAX_LISTED_ERRORS = 20

export default function ImportPanel() {
  const [name, setName] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setName(file.name.replace(/\.[^.]+$/, ''))
    setResult(parseWordsFile(file.name, text))
    setMessage('')
  }

  const onCreate = async () => {
    if (!result || result.words.length === 0 || !name.trim()) return
    setBusy(true)
    try {
      await createCustomDict({ name, words: result.words })
      setMessage(`Created "${name.trim()}" with ${result.words.length} words`)
      setResult(null)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-medium text-gray-800 dark:text-gray-200">Import a set</h2>
      <p className="mb-4 text-sm text-gray-500">
        CSV with columns <code>name,trans,usphone,ukphone</code> (separate meanings with <code>;</code>), or a JSON file in the same format
        as the built-in dictionaries.
      </p>
      <input
        type="file"
        accept=".csv,.json,text/csv,application/json"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
        className="text-sm text-gray-700 dark:text-gray-300"
      />

      {result && (
        <div className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
          <p>
            {result.words.length} valid words, {result.errors.length} skipped rows
            {result.duplicates.length > 0 && `, ${result.duplicates.length} duplicate words merged`}.
          </p>
          {result.errors.length > 0 && (
            <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-red-600">
              {result.errors.slice(0, MAX_LISTED_ERRORS).map((error, i) => (
                <li key={i}>
                  Row {error.line}: {error.message}
                </li>
              ))}
              {result.errors.length > MAX_LISTED_ERRORS && <li>…and {result.errors.length - MAX_LISTED_ERRORS} more</li>}
            </ul>
          )}
          <div className="flex items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Set name"
              className="w-64 rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
            />
            <Button disabled={busy || result.words.length === 0 || !name.trim()} onClick={onCreate}>
              Create set
            </Button>
          </div>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-indigo-600">{message}</p>}
    </section>
  )
}
```

- [ ] **Step 2: Create `CopyBuiltIn.tsx`**

```tsx
import { Button } from '@/components/ui/button'
import { dictionaries } from '@/resources/dictionary'
import { duplicateDictionaryAsCustom } from '@/utils/db/copy-dict'
import groupBy from '@/utils/groupBy'
import { useMemo, useState } from 'react'

export default function CopyBuiltIn() {
  const englishDicts = useMemo(() => dictionaries.filter((dict) => dict.language === 'en'), [])
  const groups = useMemo(() => Object.entries(groupBy(englishDicts, (dict) => dict.category)), [englishDicts])
  const [selectedId, setSelectedId] = useState(englishDicts[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const onCopy = async () => {
    const dict = englishDicts.find((d) => d.id === selectedId)
    if (!dict) return
    setBusy(true)
    setMessage('')
    try {
      const record = await duplicateDictionaryAsCustom(dict)
      setMessage(`Copied "${dict.name}" into "${record.name}" (${record.words.length} words)`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Copy failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
      <h2 className="mb-1 text-lg font-medium text-gray-800 dark:text-gray-200">Copy a built-in dictionary</h2>
      <p className="mb-4 text-sm text-gray-500">Built-in dictionaries cannot be edited. Copy one into your sets to edit it.</p>
      <div className="flex items-center gap-3">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-80 rounded border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
        >
          {groups.map(([category, dicts]) => (
            <optgroup key={category} label={category}>
              {dicts.map((dict) => (
                <option key={dict.id} value={dict.id}>
                  {dict.name} ({dict.length})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Button disabled={busy || !selectedId} onClick={onCopy}>
          {busy ? 'Copying…' : 'Copy'}
        </Button>
      </div>
      {message && <p className="mt-3 text-sm text-indigo-600">{message}</p>}
    </section>
  )
}
```

- [ ] **Step 3: Create the list page `src/pages/MySets/index.tsx`**

```tsx
import CopyBuiltIn from './CopyBuiltIn'
import ImportPanel from './ImportPanel'
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { currentChapterAtom, currentDictIdAtom } from '@/store'
import { customDictionariesAtom } from '@/store/customDicts'
import type { Dictionary } from '@/typings'
import { customIdOf, deleteCustomDict } from '@/utils/db/custom-dict'
import { useAtomValue, useSetAtom } from 'jotai'
import { useNavigate } from 'react-router-dom'
import IconX from '~icons/tabler/x'

export default function MySetsPage() {
  const navigate = useNavigate()
  const sets = useAtomValue(customDictionariesAtom)
  const setCurrentDictId = useSetAtom(currentDictIdAtom)
  const setCurrentChapter = useSetAtom(currentChapterAtom)

  const onPractice = (dict: Dictionary) => {
    setCurrentDictId(dict.id)
    setCurrentChapter(0)
    navigate('/')
  }

  const onDelete = async (dict: Dictionary) => {
    if (!window.confirm(`Delete "${dict.name}"? Its study progress and typing records will be deleted too.`)) return
    await deleteCustomDict(customIdOf(dict.id))
  }

  return (
    <Layout>
      <div className="relative flex w-full flex-1 flex-col items-center overflow-y-auto px-20 pb-10 pt-16">
        <IconX className="absolute right-20 top-10 h-7 w-7 cursor-pointer text-gray-400" onClick={() => navigate('/gallery')} />
        <div className="flex w-full max-w-4xl flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">My sets</h1>
            <Button onClick={() => navigate('/my-sets/new')}>New set</Button>
          </div>

          <section className="w-full rounded-lg bg-white shadow dark:bg-gray-800">
            {sets.length === 0 ? (
              <p className="p-6 text-sm text-gray-500">
                You have no sets yet. Create one, import a file, or copy a built-in dictionary below.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {sets.map((dict) => (
                  <li key={dict.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-lg text-gray-800 dark:text-gray-200">{dict.name}</p>
                      <p className="truncate text-sm text-gray-500">
                        {dict.length} words{dict.description ? ` · ${dict.description}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" onClick={() => onPractice(dict)}>
                        Practice
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/my-sets/${customIdOf(dict.id)}`)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(dict)}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ImportPanel />
          <CopyBuiltIn />
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 4: Add the route and the Gallery button**

In `src/index.tsx` add below the other lazy pages:

```tsx
const MySetsPage = lazy(() => import('./pages/MySets'))
```

and inside the non-mobile `<>` routes, after the `/error-book` route:

```tsx
<Route path="/my-sets" element={<MySetsPage />} />
```

In `src/pages/Gallery-N/index.tsx` add `import { Button } from '@/components/ui/button'` and replace

```tsx
                <LanguageTabSwitcher />
                <DictRequest />
```

with

```tsx
                <LanguageTabSwitcher />
                <div className="flex items-center gap-4">
                  <Button variant="outline" onClick={() => navigate('/my-sets')}>
                    Manage my sets
                  </Button>
                  <DictRequest />
                </div>
```

Also in the same file replace `import { dictionaries } from '@/resources/dictionary'` with `import { allDictionariesAtom } from '@/store/customDicts'`, add `const allDictionaries = useAtomValue(allDictionariesAtom)` right after `const currentDictInfo = useAtomValue(currentDictInfoAtom)`, and change the memo to read from it:

```tsx
const currentLanguageCategoryDicts = allDictionaries.filter((dict) => dict.languageCategory === galleryState.currentLanguageTab)
```

with the dependency array `[allDictionaries, galleryState.currentLanguageTab]`.

- [ ] **Step 5: Verify**

Run: `yarn test && npx eslint src && npx tsc --noEmit 2>&1 | grep -c "error TS"` → tests PASS, no eslint errors, tsc count `4`.

In the browser (`yarn dev`, http://localhost:5173): open `/gallery` → the "Manage my sets" button is visible; click it → the empty "My sets" page appears; use "Copy a built-in dictionary" on a small dictionary → the new set appears in the list immediately; go back to `/gallery` → the English tab shows a "My Sets" group containing it; click "Practice" on it → the typing page opens on that set and the header shows its name.

- [ ] **Step 6: Commit**

```bash
npx prettier --write src/pages/MySets src/pages/Gallery-N/index.tsx src/index.tsx
git add src
git commit -m "feat: add My Sets page with import, copy and delete"
```

---

### Task 6: Set editor page

**Files:**

- Create: `src/pages/MySets/SetEditor.tsx`
- Modify: `src/index.tsx`

**Interfaces:**

- Consumes: `rowsToWords`, `EditableRow` (Task 2); `getCustomDict`, `createCustomDict`, `updateCustomDict` (Task 3).
- Produces: routes `/my-sets/new` and `/my-sets/:id` (`id` is the bare record id).

- [ ] **Step 1: Create `SetEditor.tsx`**

```tsx
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { rowsToWords } from '@/utils/custom-dict/parse'
import type { EditableRow } from '@/utils/custom-dict/parse'
import { createCustomDict, getCustomDict, updateCustomDict } from '@/utils/db/custom-dict'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const emptyRow = (): EditableRow => ({ name: '', trans: '', usphone: '', ukphone: '' })
const inputClass = 'w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900'

export default function SetEditorPage() {
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<EditableRow[]>([emptyRow()])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isNew) return
    let cancelled = false
    getCustomDict(id).then((record) => {
      if (cancelled) return
      if (!record) {
        navigate('/my-sets', { replace: true })
        return
      }
      setName(record.name)
      setDescription(record.description)
      setRows(record.words.map((w) => ({ name: w.name, trans: w.trans.join('\n'), usphone: w.usphone, ukphone: w.ukphone })))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate])

  const updateRow = (index: number, patch: Partial<EditableRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const removeRow = (index: number) => setRows((prev) => (prev.length === 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)))

  const moveRow = (index: number, delta: number) =>
    setRows((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })

  const onSave = async () => {
    const problems: string[] = []
    if (!name.trim()) problems.push('Set name is required')
    const result = rowsToWords(rows)
    result.errors.forEach((error) => problems.push(`Row ${error.line}: ${error.message}`))
    if (result.words.length === 0 && result.errors.length === 0) problems.push('Add at least one word')
    setErrors(problems)
    if (problems.length > 0) return

    setSaving(true)
    try {
      if (isNew) await createCustomDict({ name, description, words: result.words })
      else await updateCustomDict(id, { name, description, words: result.words })
      navigate('/my-sets')
    } catch (e) {
      setErrors([e instanceof Error ? e.message : 'Failed to save'])
      setSaving(false)
    }
  }

  return (
    <Layout>
      <div className="flex w-full flex-1 flex-col items-center overflow-y-auto px-20 pb-10 pt-16">
        <div className="flex w-full max-w-5xl flex-col gap-4">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{isNew ? 'New set' : 'Edit set'}</h1>
          {loading ? (
            <p className="text-gray-500">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Set name" className={inputClass} />
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className={inputClass}
                />
              </div>

              <p className="text-sm text-gray-500">Put one meaning per line (or separate with ;). Phonetics are optional.</p>
              <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
                <div className="mb-2 grid grid-cols-[2fr_4fr_1.5fr_1.5fr_auto] gap-2 text-xs font-medium uppercase text-gray-500">
                  <span>Word</span>
                  <span>Meanings</span>
                  <span>US phonetic</span>
                  <span>UK phonetic</span>
                  <span />
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map((row, index) => (
                    <div key={index} className="grid grid-cols-[2fr_4fr_1.5fr_1.5fr_auto] items-start gap-2">
                      <input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} className={inputClass} />
                      <textarea
                        value={row.trans}
                        rows={2}
                        onChange={(e) => updateRow(index, { trans: e.target.value })}
                        className={inputClass}
                      />
                      <input value={row.usphone} onChange={(e) => updateRow(index, { usphone: e.target.value })} className={inputClass} />
                      <input value={row.ukphone} onChange={(e) => updateRow(index, { ukphone: e.target.value })} className={inputClass} />
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => moveRow(index, -1)} title="Move up">
                          ↑
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => moveRow(index, 1)} title="Move down">
                          ↓
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => removeRow(index)} title="Remove row">
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <Button variant="outline" onClick={() => setRows((prev) => prev.concat(emptyRow()))}>
                    Add word
                  </Button>
                </div>
              </div>

              {errors.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-red-600">
                  {errors.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              )}

              <div className="flex gap-3">
                <Button disabled={saving} onClick={onSave}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => navigate('/my-sets')}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 2: Add the routes**

In `src/index.tsx` add `const SetEditorPage = lazy(() => import('./pages/MySets/SetEditor'))` and, after the `/my-sets` route:

```tsx
<Route path="/my-sets/:id" element={<SetEditorPage />} />
```

(`/my-sets/new` is handled by the same route with `id === 'new'`.)

- [ ] **Step 3: Verify**

Run: `yarn test && npx eslint src && npx tsc --noEmit 2>&1 | grep -c "error TS"` → tests PASS, no eslint errors, tsc count `4`.

In the browser: `/my-sets/new` → enter name "Test", add two words with meanings on separate lines → Save → returns to `/my-sets` with the set listed (2 words); Edit → values are pre-filled, change a meaning, Save → persists after reload; try saving with a word that has no meaning → red "Row N: "x" has no meaning" and nothing saved; `/my-sets/does-not-exist` → redirects to `/my-sets`.

- [ ] **Step 4: Commit**

```bash
npx prettier --write src/pages/MySets src/index.tsx
git add src
git commit -m "feat: add custom set editor page"
```

---

### Task 7: End-to-end verification and cleanup

**Files:** none new (fix whatever the checks reveal).

- [ ] **Step 1: Full automated check**

Run: `yarn test && npx eslint . && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn build`
Expected: all tests PASS; eslint 0 errors; tsc count `4`; the production build finishes (a chunk-size warning is fine).

- [ ] **Step 2: Manual pass in the browser (`yarn dev`)**

Check each item and fix anything that fails:

1. Create a set by hand with 3 words → practise it from "Practice": typing page shows its name and chapter 1, words and meanings are the ones entered.
2. **Reload the page while that set is selected** → it stays selected (does not jump to CET-4).
3. Import: paste the three-line CSV `name,trans` / `cat,con mèo` / `dog,con chó` into a file `t.csv` on disk, choose it in the Import panel → "2 valid words", name defaults to `t`, "Create set" works. (Also import `public/dicts/my-vocab.json` if the user has it: expect 555 valid words.)
4. Copy a built-in dictionary (e.g. a small one) → it appears in My sets and in `/gallery` under the English tab "My Sets" group; open its card → the chapter dialog works.
5. **Delete the currently selected set** (confirm dialog) → the typing page falls back to CET-4 and chapter 1.
6. Settings → Data → export user data, then import it back → the custom sets are still listed (verifies the export/import carries the new tables; if they are missing, report it — do not paper over it).
7. `/error-book` renders and shows rows for custom sets by name after typing a few wrong letters in a custom set.

- [ ] **Step 3: Update docs/notes if behaviour differs from the spec**

If step 2 revealed a deviation (for example export/import does not carry the new tables), add a short "Known issues" note at the end of the spec file `docs/superpowers/specs/2026-10-12-study-modes-design.md` and commit it: `git commit -am "docs: note P1 findings"`.

- [ ] **Step 4: Final status**

Run: `git log --oneline -8 && git status --short`
Expected: the seven task commits on `feat/study-modes`; the working tree contains only the unrelated untracked items (`.claude/launch.json`, `.tmp-trans/`) and any in-progress dictionary translation changes under `public/dicts/` that are not part of this work (do not commit those on this branch).

---

## Self-review

**Spec coverage (P1 section):**

- `customDicts` / `cardProgress` tables, Dexie v4, existing tables unchanged → Task 3 (Steps 1–3).
- `custom:` ids, `idb:` URLs, category/language fields, `chapterCount` → Task 3 (`customDictToDictionary`, test "maps a record to a Dictionary").
- Loader adapter → Task 3 (`wordListFetcher`) + tests.
- Merge built-in + custom, resolve current dict, fallback to `cet4` → Task 4.
- Gallery "My Sets" group + manage entry → Task 5 (group appears via category; button in header).
- Set editor (name, description, table, add/remove/reorder, save) → Task 6.
- Import CSV/JSON with line-numbered errors and partial import → Tasks 2 and 5.
- Duplicate built-in into custom set → Tasks 3 and 5.
- Duplicate names merged with warning → Task 2 (`duplicates`) + Task 5 UI message; editor saves merged words silently (the editor result also merges; acceptable, the spec says "merged on import and on save").
- Delete with confirm + progress cleanup → Tasks 3 and 5.
- Unknown id redirects → Tasks 4 (typing fallback) and 6 (editor redirect).
- Acceptance (create, import 555-word JSON, see in Gallery, practise, export/import) → Task 7 Step 2.
- Risk "verify export/import with new tables" → Task 7 Step 2 item 6.

**Placeholder scan:** no TBD/TODO; every code step shows the code. The only conditional is the jsdom fallback in Task 1 with exact commands.

**Type consistency:** `CustomDictRecord`/`ICardProgress` defined in Task 3 Step 1 and used by `database.ts`, `custom-dict.ts`, tests; `ParseResult`/`EditableRow`/`rowsToWords` defined in Task 2 and used in Tasks 5–6 with the same names; `customIdOf` (Task 3) used in Tasks 5–6; `dictionaryByIdAtom`, `allDictionariesAtom`, `customDictionariesAtom`, `customDictionariesLoadedAtom`, `shouldResetDictId` (Task 4) used consistently in Tasks 4–5.
