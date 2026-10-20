# File Storage (data folder as source of truth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all of the learner's data out of the browser into one SQLite file in a folder on their machine, served by a small local Node server, so that nothing is lost when browser data is cleared, a second address starts with the same data, and a stable build can run next to the dev build.

**Architecture:** A Node 22 server (`server/`, `node:sqlite`, no native add-ons) owns the database and exposes named domain operations over `POST /api/rpc/<name>` plus a server-sent-event stream for live updates. The browser keeps no copy: `src/utils/db/*` and the few direct callers become thin clients of that contract (`src/data/`), live queries become topic-driven refreshes, and a boot gate checks the server, loads the data-describing flags, and offers a verified, non-destructive migration of the existing IndexedDB data. Business logic that exists today as pure TypeScript is shared with the server by import.

**Tech Stack:** Node 22 (`node:sqlite`, `node:http`), esbuild (already a dependency of Vite) for the server bundle, TypeScript, React 18, jotai, Vitest, Vite proxy for dev.

**Spec:** `docs/superpowers/specs/2026-10-20-file-storage-design.md` (read it first; it holds every decision, including the section "Settled after the builder check").

## Global Constraints

- **Data safety is the product.** No task may write the learner's real data folder: tests use in-memory or temp folders; manual checks use `./.dev-data`; the real folder is touched only in Task 16, with the learner present and a backup taken first.
- Worktree: all work is in `/Users/khue/VSCodeProjects/qwerty-learner-file-storage` on `feat/file-storage`. The folder `/Users/khue/VSCodeProjects/qwerty-learner` (branch `feat/study-modes`) and the learner's dev server on port 5173 are not touched. `node_modules` in the worktree is a symlink to the main folder's.
- Git hooks: the worktree has its own `.husky/_` (created with `node_modules/.bin/husky install`); the commit hook reformats the whole repository, so after each commit run `git checkout -- .claude` and re-add formatting-only changes of files you own.
- Node `>=22.13` (`engines` in `package.json`, `.nvmrc` with `22`). No new runtime dependency; no new dev dependency unless a task says so (none planned). SQLite only through `server/adapter.ts`.
- Server bundle: `esbuild server/main.ts --bundle --platform=node --format=esm --target=node22 --alias:@=./src --outfile=dist-server/server.mjs` (the explicit `--target` is mandatory: `tsconfig.json` says `es5`). Run it with `node --disable-warning=ExperimentalWarning dist-server/server.mjs`.
- Shared pure modules (imported by server and client) import nothing from React, jotai, Dexie or browser APIs: `src/utils/srs/*`, `src/utils/quiz/effect.ts`, `src/utils/custom-dict/parse.ts`, `src/utils/detail/sidecar.ts` (only the pure functions), `src/utils/examples/*`, `src/data/contract.ts`. If a pure function currently lives in a file that also imports Dexie or the browser, split the pure part out first.
- Time: the browser sends `now` or day boundaries; the server never computes a local day or a time zone. An omitted `now` means the server's own `Date.now()`.
- Tests: Vitest. Server tests start with `// @vitest-environment node` and use `openDb(':memory:')` or a temp folder; client data-layer tests run against the real server logic through the in-process harness (Task 7). Keep every existing data-layer assertion (the 5 files `activity`, `card-progress`, `copy-dict`, `custom-dict`, `personal-seed` tests, 50 tests today); only the arrange code changes.
- Code style: no semicolons, single quotes, 2-space indent, 140 columns, short `/** */` comments. UI uses existing components and tokens, no new colours.
- Delegated work (opencode, `opencode/deepseek-v4.1-flash-free`; `-v high` for tasks marked so): the worker must NOT run any build/test/lint command and must NOT commit; the main session runs the tests and commits. Sequential, not parallel, when two tasks touch the same file.
- Errors from the server are `{ "error": { "code": "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "INTERNAL", "message": string } }` with HTTP 400 / 404 / 409 / 500; the client throws `DataError` with the same `code`.

## The contract (the one thing every task must agree on)

`src/data/contract.ts` is written in Task 0 and is the single list of operations. Server handlers and client callers are typed from it. (`Stored…` types are the record plus its numeric `id`.)

```ts
export type Procedures = {
  'cards.byDict': { args: [dict: string]; result: ICardProgress[] }
  'cards.review': { args: [dict: string, word: string, grade: Grade, now?: number]; result: ICardProgress }
  'cards.reviewQuiz': { args: [dict: string, word: string, correct: boolean, now?: number]; result: ICardProgress | null }
  'log.hardWordsSince': { args: [dict: string, sinceMs: number]; result: string[] }
  'activity.times': { args: [fromMs: number]; result: { reviewTimes: number[]; typedSeconds: number[] } }
  'sets.list': { args: []; result: CustomDictRecord[] }
  'sets.get': { args: [id: string]; result: CustomDictRecord | null }
  'sets.create': { args: [input: CustomDictInput]; result: CustomDictRecord }
  'sets.update': { args: [id: string, input: CustomDictInput]; result: null }
  'sets.delete': { args: [id: string]; result: null }
  'personal.migrate': { args: [input: PersonalSeedInput]; result: PersonalSeedResult }
  'personal.backfill': { args: [customId: string, extras: Record<string, WordExtras>]; result: number }
  'personal.fixNames': { args: [customId: string, renames: { from: string; to: string }[]]; result: number }
  'words.add': { args: [record: IWordRecord]; result: number }
  'words.deleteByWord': { args: [word: string, dict: string]; result: number }
  'words.between': { args: [startTs: number, endTs: number]; result: StoredWordRecord[] }
  'words.wrong': { args: []; result: StoredWordRecord[] }
  'words.wrongByDict': { args: [dict: string]; result: StoredWordRecord[] }
  'words.revisionCount': { args: [dict: string]; result: number }
  'chapters.add': { args: [record: IChapterRecord]; result: number }
  'chapters.byDict': { args: [dict: string]; result: StoredChapterRecord[] }
  'chapters.byDictChapter': { args: [dict: string, chapter: number]; result: StoredChapterRecord[] }
  'stats.summary': { args: []; result: { chapterCount: number; wordCount: number; firstWordTimestamp: number | null; sumWrongCount: number } }
  'reviews.latestUnfinished': { args: [dict: string]; result: StoredReviewRecord | null }
  'reviews.put': { args: [record: IReviewRecord]; result: number }
  'meta.getAll': { args: []; result: Record<string, string> }
  'meta.set': { args: [key: string, value: string]; result: null }
}
export type ProcedureName = keyof Procedures
/** The live-update topics a call changes; the server publishes them after the write commits. */
export function topicsOf(name: ProcedureName, args: unknown[]): string[]
```

Topics: `customDicts`, `cards:<dict>`, `reviewLog`, `wordRecords`, `chapterRecords`, `reviewRecords`, `meta`. Examples: `cards.review(dict,…)` → `cards:<dict>`, `reviewLog`; `sets.delete(id)` → `customDicts`, `cards:custom:<id>`, `wordRecords`, `chapterRecords`, `reviewRecords`; `personal.migrate` → every topic.

HTTP surface (besides `POST /api/rpc/<name>` with body `{ "args": [...] }`, answer `{ "result": … }`): `GET /api/health` → `{ ok, schemaVersion, role, dataDir, dbBytes, empty, migrated }`; `GET /api/events` (SSE, one `event: change` per topic set); `GET /api/export/db` (VACUUM INTO copy as a download); `GET /api/export/json` (gzip of the Dexie-format JSON); `POST /api/import` (legacy `.gz`, replaces all after a backup); `POST /api/migrate/begin | batch | commit | abort` (browser migration, Task 12); static files + fallback to `index.html` for non-`/api` GETs when started with `--static <dir>`.

## Review Focus

- **Atomicity:** `cards.review` writes the card and the log entry or neither; `sets.delete` removes the set and everything that belongs to it or nothing. A test makes the second write throw and asserts the first is rolled back.
- **Ids and references:** `chapter_records.word_record_ids` point at `word_records.id`. Migration, import and export must preserve ids, and the autoincrement counter must continue after the highest id. A test migrates records whose chapter points at word 7 and 9 and asserts both survive and the next insert is 10.
- **Migration honesty:** success is reported only when the server's counts equal what the browser read; an interrupted or failed upload leaves the main database untouched and the browser data intact; running it twice cannot duplicate rows.
- **Wrong folder or role:** a server started as `dev` refuses a folder created as `stable` (and the reverse); stable refuses to start without an explicit folder; a second server on the same folder refuses to start; a folder written by a newer schema refuses to open; a failed `quick_check` refuses to serve.
- **Time zones:** no server code calls `new Date().getHours()` or similar; `log.hardWordsSince` and `activity.times` take absolute millisecond values.
- **Hot path and failure:** typing a word waits for `words.add` (loopback) and shows an error when it fails instead of silently losing the record; killing the server mid-session turns the banner on within a few seconds.

## File Structure

```
server/
  main.ts config.ts adapter.ts folder.ts schema.ts http.ts events.ts exchange.ts migration.ts
  repo/       wordRecords.ts chapterRecords.ts reviewRecords.ts customDicts.ts cardProgress.ts reviewLog.ts meta.ts
  procedures/ index.ts cards.ts sets.ts personal.ts typing.ts reviews.ts meta.ts
  *.test.ts, repo/*.test.ts, procedures/*.test.ts   (next to the code)
src/data/
  contract.ts rpc.ts events.ts useLive.ts hydrate.ts gate.ts DataGate.tsx meta.ts
  legacy/ detect.ts read.ts migrate.ts
src/test/serverHarness.ts          in-process server behind fetch, plus a small arrange/assert table facade
scripts/dev-full.mjs scripts/data-copy-to-dev.mjs scripts/stable-build.mjs scripts/stable-start.mjs
docs/stable-deploy.md              the guide (launchd file, config, restore, rollout)
```

Modified: `src/utils/db/*` (clients), `src/store/personal.ts` and its 5 consumers, the direct callers (`DonateCard`, `Analysis`, `ErrorBook`, `Gallery-N` hooks, `Dashboard`, `SetDetail`, `CustomDictsSync`, `DataSetting`), `src/index.tsx` (gate), `vite.config.ts` (proxy), `vitest.config.ts` (also `server/**`), `package.json` (engines, scripts, finally dropping Dexie), `.gitignore` (`.dev-data/`, `dist-server/`).

## Order, sizes and who does what

```
T0 scaffold+contract (main, S) ─┬─ T1 adapter+folder (opencode, M) ───────────┐
                                ├─ T2 schema+repos (opencode, M) ─┬─ T3a typing/stats/reviews/meta procedures (opencode, M)
                                │                                  ├─ T3b cards/sets/personal procedures (main, L)
                                │                                  └─ T5 exchange formats (opencode high, M)
                                └─ T7 client layer + harness (main, M)
T1+T3a+T3b+T5 ─ T4 http+events+static (opencode high, M) ─ T6 entry+config+scripts (main, M)
T7 ─ T8 port src/utils/db (opencode high, M, main reviews) ─ T9 port direct callers (opencode, M) ─ T10 flags (main, M) ─ T11 gate (main, M)
T4+T11 ─ T12 browser migration, both sides (main, L) ─ T13 remove Dexie (opencode, S) ─ T14 stable deploy (main, M) ─ T15 verification (main, M) ─ T16 rollout (main + learner)
```

T1, T2 and T7 run in parallel after T0. T3a, T3b and T5 run in parallel after T2. Every delegated batch is followed by the main session running the new tests and `tsc`.

---

### Task 0: Scaffold and contract (main)

**Files:** Create `src/data/contract.ts`, `server/tsconfig.json`, `.nvmrc`; Modify `package.json` (`engines`, scripts `server:build`, `server:dev`), `vitest.config.ts` (`include` adds `server/**/*.test.ts`), `.gitignore`.

**Interfaces:** Produces `Procedures`, `ProcedureName`, `topicsOf`, `DataErrorCode`, and the `Stored…` types, exactly as in "The contract".

- [ ] **Step 1: Write the failing test** `src/data/contract.test.ts`: `topicsOf('cards.review', ['custom:a','w','good'])` equals `['cards:custom:a','reviewLog']`; `topicsOf('sets.delete', ['a'])` contains `customDicts`, `cards:custom:a`, `wordRecords`, `chapterRecords`, `reviewRecords`; `topicsOf('words.between', [1,2])` is `[]` (reads publish nothing); `topicsOf('personal.migrate', [{...}])` contains every topic; an unknown name is not representable (type-level, checked with `// @ts-expect-error`).
- [ ] **Step 2: Run** `npx vitest run src/data/contract.test.ts` → FAIL.
- [ ] **Step 3: Implement** `contract.ts` (types + `topicsOf`), then the scaffolding files. `server:build` runs the esbuild command from Global Constraints on a placeholder `server/main.ts` that prints `ok`.
- [ ] **Step 4: Run** the test → PASS; `yarn server:build && node dist-server/server.mjs` prints `ok`; `npx tsc --noEmit -p .` shows no new error.
- [ ] **Step 5: Commit** `feat: data contract and server scaffolding`

---

### Task 1: SQLite adapter and data-folder lifecycle (delegate)

**Files:** Create `server/adapter.ts`, `server/folder.ts`; Test `server/adapter.test.ts`, `server/folder.test.ts`.

**Interfaces:**
- Produces in `adapter.ts`:
  ```ts
  export type Db = {
    exec(sql: string): void
    run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number }
    get<T>(sql: string, params?: unknown[]): T | undefined
    all<T>(sql: string, params?: unknown[]): T[]
    /** Runs fn inside BEGIN/COMMIT; any throw rolls back and rethrows. Not re-entrant: a nested call joins the outer transaction. */
    transaction<T>(fn: () => T): T
    backupTo(path: string): void   // VACUUM INTO, refuses an existing path
    close(): void
  }
  export function openDb(file: string | ':memory:'): Db   // WAL + synchronous=FULL + foreign_keys=ON for files
  ```
- Produces in `folder.ts`:
  ```ts
  export type Role = 'dev' | 'stable'
  export type OpenedFolder = { db: Db; dir: string; role: Role; close(): void }
  export function openFolder(opts: { dir: string; role: Role; now?: () => number }): OpenedFolder
  export function runBackups(folder: OpenedFolder, now: number): { created: string | null; removed: string[] }
  export class FolderError extends Error { code: 'LOCKED' | 'ROLE_MISMATCH' | 'NEWER_SCHEMA' | 'CORRUPT' | 'NOT_WRITABLE' }
  ```
  `openFolder` creates the folder, `README.txt` and `.role`; takes `server.lock` (`wx`, writes the pid; a lock whose pid is dead is taken over, a live one throws `LOCKED`); refuses a different recorded role (`ROLE_MISMATCH`); runs `PRAGMA quick_check` (`CORRUPT`); schema work is not here (Task 2) but `openFolder` accepts an `ensureSchema(db)` hook passed in tests and by `main`, so this task stays independent. `runBackups` writes `backups/qwerty-YYYY-MM-DD.db` (local date of `now`) when today's file is missing, keeps the last 14 daily files and, from the Sunday files, the last 8, and returns what it created and removed.

- [ ] **Step 1: Write the failing tests.** `adapter`: insert/select round trip with params, `lastInsertRowid`, `transaction` commits, a throw inside rolls back and rethrows, nested `transaction` joins the outer one (outer throw rolls back both), `backupTo` produces a file that opens and has the rows and refuses an existing path, `openDb(':memory:')` isolation between two instances. `folder` (temp dirs via `fs.mkdtempSync`): creates the layout; second `openFolder` on the same dir while the first is open throws `LOCKED`; after `close()` it opens; a lock file with a dead pid is taken over; role `stable` on a `dev` folder throws `ROLE_MISMATCH`; a garbage `qwerty.db` throws `CORRUPT`; `runBackups` with a fake clock: first call creates today's file, second call the same day creates nothing, 20 consecutive days leave 14 daily files, and Sunday files beyond 8 weeks are removed while non-matching files in the folder are never deleted.
- [ ] **Step 2: Run** `npx vitest run server/adapter.test.ts server/folder.test.ts` → FAIL.
- [ ] **Step 3: Implement** both files (`node:sqlite`'s `DatabaseSync`; manual `BEGIN`/`COMMIT`/`ROLLBACK`; convert `bigint` row ids to `number`).
- [ ] **Step 4: Run** → PASS (main session).
- [ ] **Step 5: Commit** `feat: sqlite adapter and data folder lifecycle`

---

### Task 2: Schema, migrations and repositories (delegate)

**Files:** Create `server/schema.ts`, `server/repo/*.ts` (7 files); Test next to each.

**Interfaces:**
- Consumes `Db` (Task 1), record types from `src/utils/db/record.ts`.
- Produces `ensureSchema(db: Db): void` (forward-only by `PRAGMA user_version`; version 1 creates everything; a database with a higher version throws `FolderError`-like `NEWER_SCHEMA` by throwing `Error('NEWER_SCHEMA')` that Task 1's wrapper maps).
- Tables (names fixed; columns are snake_case of the record fields; booleans as 0/1; JSON columns hold the arrays/objects as text): `word_records(id INTEGER PRIMARY KEY AUTOINCREMENT, word, timestamp, dict, chapter NULL, wrong_count, timing, mistakes)` with indexes `(timestamp)`, `(dict, word)`, `(wrong_count)`, `(dict, chapter)`; `chapter_records(id INTEGER PRIMARY KEY AUTOINCREMENT, dict, chapter NULL, timestamp, time, correct_count, wrong_count, word_count, correct_word_indexes, word_number, word_record_ids)` with `(dict, chapter)`, `(timestamp)`; `review_records(id INTEGER PRIMARY KEY AUTOINCREMENT, dict, position, create_time, is_finished, words)` with `(dict)`; `custom_dicts(id TEXT PRIMARY KEY, name, description, words, created_at, updated_at)` with `(created_at)`; `card_progress(dict, word, state, due, interval, ease, reps, lapses, first_seen, last_reviewed, PRIMARY KEY (dict, word))` with `(dict, due)`; `review_log(id INTEGER PRIMARY KEY AUTOINCREMENT, at, dict, word, kind, grade NULL)` with `(at)`, `(dict)`; `meta(key TEXT PRIMARY KEY, value)`.
- Each repo exports plain functions taking `db: Db` first, and mapping rows ↔ the existing interfaces (`rowToWordRecord`, …), always returning `id` for tables that have one. Required functions: word_records `insert`, `deleteByWordDict`, `between`, `wrong`, `wrongByDict`, `revisionCount`, `count`, `firstByTimestamp`, `typedSeconds(from)`, `deleteByDict`, `renameWord(dict, from, to)`; chapter_records `insert`, `byDict`, `byDictChapter`, `count`, `sumWrong`, `deleteByDict`; review_records `latestUnfinished`, `put` (insert when no id, replace when id exists), `deleteByDict`; custom_dicts `list` (ordered by `created_at`, then `id`), `get`, `insert`, `replace`, `delete`; card_progress `byDict`, `get`, `put`, `delete`, `deleteByDict`, `moveDict(from, to)`; review_log `insert`, `since(at)`, `hardWordsSince(dict, since)` (grade `again` or `hard`), `times(from)`, `renameWord`, `moveDict`; meta `getAll`, `set`.

- [ ] **Step 1: Write the failing tests** (in-memory db). Schema: fresh db gets version 1 and all tables; running `ensureSchema` twice is a no-op; a db with `user_version = 99` throws `NEWER_SCHEMA`. Per repo, the behaviours the old Dexie calls had: `word_records.insert` returns increasing ids and the next id after an explicit high id is higher; `wrong` returns only `wrong_count > 0`; `between` is inclusive and ordered by timestamp then id; `revisionCount('d')` counts distinct words that have a wrong record in that dict; `custom_dicts.list` orders by `created_at` then `id`; `card_progress.byDict` ignores other dicts and `put` replaces a row with the same key; `review_log.hardWordsSince` returns distinct words graded again/hard at or after `since` for that dict only; JSON columns round trip nested arrays and the sparse `mistakes` object (numeric keys) unchanged; `review_records.put` inserts without id and replaces with id.
- [ ] **Step 2: Run** `npx vitest run server/schema.test.ts server/repo` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS (main session).
- [ ] **Step 5: Commit** `feat: sqlite schema and repositories`

---

### Task 3a: Typing, statistics, error-book and meta procedures (delegate)

**Files:** Create `server/procedures/index.ts` (registry type `Handler = (ctx: { db: Db; now: () => number }, args: unknown[]) => unknown`, `registry: Record<ProcedureName, Handler>` filled by the modules), `typing.ts`, `reviews.ts`, `meta.ts`; Test `server/procedures/typing.test.ts`, `reviews.test.ts`, `meta.test.ts`.

**Interfaces:** Consumes the repos (Task 2) and the contract. Produces handlers for `words.add`, `words.deleteByWord`, `words.between`, `words.wrong`, `words.wrongByDict`, `words.revisionCount`, `chapters.add`, `chapters.byDict`, `chapters.byDictChapter`, `stats.summary`, `activity.times`, `log.hardWordsSince`, `reviews.latestUnfinished`, `reviews.put`, `meta.getAll`, `meta.set`. Argument validation: wrong count/type of arguments → `BAD_REQUEST` (a `ProcedureError` class with `code`). `words.add` rejects a record without a string `word`/`dict` and numeric `timeStamp`.

- [ ] **Step 1: Write the failing tests** that mirror today's behaviour: ids returned by `words.add`/`chapters.add` are positive and increasing; `words.deleteByWord` returns the deleted count and only matches both word and dict; `stats.summary` on an empty database is `{0, 0, null, 0}` and on data returns the first timestamp and the summed wrong counts; `activity.times(from)` returns review times `>= from` in ms and typed times in seconds `>= floor(from/1000)`; `log.hardWordsSince` as in Task 2; `reviews.latestUnfinished` returns the newest record by `createTime` for the dict only when it is not finished, otherwise `null`; `meta.set` then `meta.getAll`; wrong argument shapes throw `BAD_REQUEST`.
- [ ] **Step 2: Run** `npx vitest run server/procedures` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS (main session).
- [ ] **Step 5: Commit** `feat: typing, statistics and review-record procedures`

---

### Task 3b: Cards, sets and personal-set procedures (main)

**Files:** Create `server/procedures/cards.ts`, `sets.ts`, `personal.ts`; Test `server/procedures/cards.test.ts`, `sets.test.ts`, `personal.test.ts`.

**Interfaces:** Consumes repos and the shared pure modules (`nextState`, `srsEffect`, `normalizeWords`, `mergeExtras`, `mergeExamples`, the respell helper). Produces `cards.byDict`, `cards.review`, `cards.reviewQuiz`, `sets.*`, `personal.migrate`, `personal.backfill`, `personal.fixNames`. These are line-for-line ports of `reviewCard`, `reviewQuizAnswer`, `createCustomDict` (id from `Date.now().toString(36)` plus six random base-36 characters, as today), `updateCustomDict` (`NOT_FOUND` when missing), `deleteCustomDict` (cascade in one transaction), `migratePersonalSet`, `backfillPersonalExtras`, `fixWordNames`. Each runs inside `db.transaction`. `fixWordNames`' `respell` moves to a shared pure file `src/utils/detail/respell.ts` first.

- [ ] **Step 1: Port the tests.** Take every `it` of `card-progress.test.ts`, `custom-dict.test.ts`, `personal-seed.test.ts` (and the card/log parts of `activity.test.ts` in Task 3a) and rewrite them against the procedures with `openDb(':memory:')` + `ensureSchema`; assertions are unchanged. Add the Review Focus atomicity tests: `cards.review` with a log insert that throws (spy on the repo) leaves the card unchanged; `sets.delete` with a failing last step leaves the set, cards and records in place; `personal.migrate` keeps ids when moving card/log/word rows and a second run changes nothing.
- [ ] **Step 2: Run** `npx vitest run server/procedures/cards.test.ts server/procedures/sets.test.ts server/procedures/personal.test.ts` → FAIL.
- [ ] **Step 3: Implement** the three files and extract `respell`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: card, set and personal-set procedures`

---

### Task 4: HTTP, events and static serving (delegate, high effort)

**Files:** Create `server/http.ts`, `server/events.ts`; Test `server/http.test.ts`, `server/events.test.ts`.

**Interfaces:**
- Produces `createApp(deps: { db: Db; role: Role; dir: string; staticDir?: string; now?: () => number }): { handle(req, res): void; close(): void; publish(topics: string[]): void }` over `node:http` types, and `startServer(opts): Promise<{ port: number; close(): Promise<void> }>` (`port: 0` allowed, binds `127.0.0.1` only).
- Behaviour: `POST /api/rpc/<name>` (unknown name → 404 `NOT_FOUND`, bad JSON or args → 400, handler `ProcedureError` → its code, anything else → 500 `INTERNAL` with the message and no stack in the body); after a successful call the app publishes `topicsOf(name, args)` (when not empty) to every SSE client; `GET /api/events` keeps the connection open, sends a comment heartbeat every 15 s and `event: change\ndata: {"topics":[...]}\n\n` per publish; `GET /api/health` as in the contract; request bodies over 64 MB → 413; any other method/path under `/api` → 404; with `staticDir`, files are served with correct content types and any non-`/api` GET that is not a file returns `index.html`; a `Host` header that is not `localhost`, `127.0.0.1` or `[::1]` (any port) → 403 (guards against DNS rebinding).

- [ ] **Step 1: Write the failing tests** by starting `startServer({ port: 0 })` on an in-memory db and using `fetch`: a round trip `meta.set` then `meta.getAll`; unknown procedure 404; malformed JSON 400; a handler error maps to its code; an SSE client receives `change` with `topics` after `cards.review` and not after `cards.byDict`; two clients both receive; a client that disconnects is dropped (publish does not throw); heartbeat uses a fake interval hook; health reports `empty: true` on a fresh database and `false` after `words.add`; static: `index.html` for `/`, the same for `/my-sets/abc`, the real file for `/assets/x.js` with a JavaScript content type, 404 for `/api/nothing`; forged `Host: evil.example` → 403; `server.close()` ends open SSE connections.
- [ ] **Step 2: Run** `npx vitest run server/http.test.ts server/events.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS (main session).
- [ ] **Step 5: Commit** `feat: http api, live events and static serving`

---

### Task 5: Export and import formats (delegate, high effort)

**Files:** Create `server/exchange.ts`; Test `server/exchange.test.ts`.

**Interfaces:** Consumes repos. Produces `exportDexieJson(db: Db): Uint8Array` (gzip of the documented Dexie export format, `formatName: 'dexie'`, `formatVersion: 1`, `databaseName: 'RecordDB'`, `databaseVersion: 5`, tables `wordRecords`, `chapterRecords`, `reviewRecords`, `customDicts`, `cardProgress`, `reviewLog` with the same schema strings as `database.ts` version 5), `importDexieJson(db: Db, bytes: Uint8Array, backup: () => void): ImportCounts` (gunzips, validates, calls `backup()` first, then in one transaction clears the tables and inserts every row preserving ids, resets the autoincrement counters to the highest id, and returns the counts; rejects other `databaseName`s, unknown tables are ignored with a warning list, a malformed file changes nothing), `snapshotDb(db: Db, destDir: string): string` (VACUUM INTO a timestamped file and returns its path).

- [ ] **Step 1: Write the failing tests.** A fixture produced by the real exporter: a test running in the jsdom environment with `fake-indexeddb` and the existing `db.export` (from `dexie-export-import`) writes a small populated database (words with sparse `mistakes`, chapters pointing at word ids 7 and 9, a custom set, a card, a log row) to `server/fixtures/dexie-export.json.gz` the first time (committed afterwards); the exchange tests import that fixture into `:memory:` and assert counts, ids (7 and 9 survive, next `words.add` returns 10), and that a re-export imports back to the same data (round trip); malformed gzip, wrong `databaseName` and a row of the wrong shape each leave the database unchanged and `backup` not called (validation runs before the backup); `snapshotDb` output opens and has the rows.
- [ ] **Step 2: Run** `npx vitest run server/exchange.test.ts` → FAIL.
- [ ] **Step 3: Implement** (hand-written; `node:zlib` for gzip; no Dexie in `server/`).
- [ ] **Step 4: Run** → PASS (main session).
- [ ] **Step 5: Commit** `feat: dexie-compatible export and import`

---

### Task 6: Entry point, configuration and scripts (main)

**Files:** Create `server/main.ts`, `server/config.ts`, `scripts/dev-full.mjs`, `scripts/data-copy-to-dev.mjs`, `scripts/stable-build.mjs`, `scripts/stable-start.mjs`; Modify `package.json` scripts (`server:dev`, `dev:full`, `stable:build`, `stable:start`, `data:copy-to-dev`), `vite.config.ts` (`server.proxy['/api']` to `http://127.0.0.1:5180`, no buffering for SSE).

**Interfaces:** `parseConfig(argv: string[], env: Record<string, string | undefined>): Config` with `Config = { role: Role; dir: string; port: number; staticDir?: string }`: `--role dev|stable`, `--data <dir>`, `--port <n>`, `--static <dir>`; role `dev` defaults `dir` to `./.dev-data` and port 5180; role `stable` **requires** `--data` (or `QWERTY_DATA_DIR`) and defaults to port 4173; a `stable` role with a data dir inside the project working tree is refused; relative dirs are resolved; invalid port is an error. `main` wires `openFolder` → `ensureSchema` → backups at start and every hour → `startServer`, logs one line with role, folder and URL, and shuts down on SIGINT/SIGTERM (closes SSE, the db and the lock).

- [ ] **Step 1: Write the failing tests** for `parseConfig` (defaults per role; stable without data dir errors; stable inside the working tree errors; env `QWERTY_DATA_DIR`; bad port; unknown flag errors) and an end-to-end test that runs `main` in-process against a temp folder with `port: 0`, calls `meta.set` over HTTP, stops it, starts it again on the same folder and reads the value back (persisted), and a third start while the second is running fails with `LOCKED`.
- [ ] **Step 2: Run** `npx vitest run server/config.test.ts server/main.test.ts` → FAIL.
- [ ] **Step 3: Implement** the files; `dev-full.mjs` spawns `server:dev` and `vite` (no new dependency), forwards signals and exits when either dies; `data-copy-to-dev.mjs <stableDir>` takes a backup copy of the stable database with `VACUUM INTO` and replaces `./.dev-data/qwerty.db` only after printing what it will overwrite and requiring `--yes`.
- [ ] **Step 4: Run** → PASS; `yarn stable:build` produces `dist-server/server.mjs` and `build/` with `--base=/`.
- [ ] **Step 5: Commit** `feat: data server entry point, configuration and dev/stable scripts`

---

### Task 7: Client layer and test harness (main, parallel with Tasks 1–3)

**Files:** Create `src/data/rpc.ts`, `events.ts`, `useLive.ts`, `hydrate.ts`, `src/test/serverHarness.ts`; Test `src/data/rpc.test.ts`, `events.test.ts`, `hydrate.test.ts`.

**Interfaces:**
- `rpc.ts`: `export class DataError extends Error { code: DataErrorCode }`; `call<N extends ProcedureName>(name: N, ...args: Procedures[N]['args']): Promise<Procedures[N]['result']>` (`POST /api/rpc/<name>`; a network failure throws `DataError('UNREACHABLE')`, which also makes `events.ts` report the server down; the base URL is relative so it works behind the Vite proxy and from the static server).
- `events.ts`: `subscribe(topics: string[] | '*', fn: () => void): () => void`, `notifyLocal(topics: string[])` (the client that wrote refreshes at once), `connectionState` store (`'connecting' | 'open' | 'down'`) fed by one `EventSource('/api/events')` with automatic reconnect; the connection is created lazily on the first subscription.
- `useLive.ts`: `useLive<T>(query: () => Promise<T>, topics: string[], deps: unknown[]): T | undefined` (runs now and again after any of the topics changes; ignores a late answer of an older run; `undefined` until the first answer).
- `hydrate.ts`: `toWordRecord(row)`, `toChapterRecord(row)`, `toReviewRecord(row)` that rebuild the classes with getters (`WordRecord.totalTime`, `ChapterRecord.wpm`, …) keeping `id`.
- `serverHarness.ts`: `installTestServer(): { db: Db; reset(): void; table: TestTables }` which replaces `globalThis.fetch` for `/api/*` with the real `createApp` handler over an in-memory database (no network) and an `EventSource` stub that delivers `publish`ed topics; `TestTables` offers `put/add/clear/toArray/get/count` for each table so existing tests can arrange and assert state exactly as they did with Dexie (`await tables.cardProgress.put(card)`). `vitest.config.ts` setup calls it for files that opt in with `installTestServer()` in a `beforeEach`.

- [ ] **Step 1: Write the failing tests:** `call` returns `result`, maps `{error:{code}}` to `DataError` with that code, maps a rejected fetch to `UNREACHABLE`; `subscribe` fires for a matching topic and not for another, `'*'` fires for all, unsubscribe stops it; `notifyLocal` triggers subscribers synchronously-soon (next microtask); `useLive` is tested through a tiny render with `react-dom/test-utils`-free logic extracted as `createLiveRunner` (a pure function) asserting the stale-answer rule and the re-run on topic; `hydrate` returns objects whose getters work and that keep `id`.
- [ ] **Step 2: Run** `npx vitest run src/data` → FAIL.
- [ ] **Step 3: Implement.** (The harness needs Tasks 1–3 to exist; until then it is written against the contract and finished when they land.)
- [ ] **Step 4: Run** → PASS once the server tasks are merged.
- [ ] **Step 5: Commit** `feat: client data layer and in-process test harness`

---

### Task 8: Port `src/utils/db` (delegate, high effort; main reviews)

**Files:** Modify `src/utils/db/card-progress.ts`, `custom-dict.ts`, `activity.ts`, `review-record.ts`, `index.ts`, `copy-dict.ts`, `personal-seed.ts`, `data-export.ts`; Delete `src/utils/db/database.ts`'s runtime use (kept until Task 13 for the legacy reader reference); Modify the five data tests' arrange code to use `installTestServer()`.

**Interfaces:** Every exported function keeps its name, parameters and return type: `getDictProgress`, `getHardWordsToday(dict, now?)` (computes `startOfLocalDay(now)` in the browser and calls `log.hardWordsSince`), `reviewCard`, `reviewQuizAnswer`, `loadActivity(now)` (calls `activity.times`, then the same `buildWeek`/`computeStreak` as today), `createCustomDict`, `updateCustomDict`, `duplicateCustomDict` (client-side: `sets.get` then `sets.create`), `deleteCustomDict`, `getCustomDict` (returns `undefined` for `null`), `listCustomDicts`, `getCustomDictWords`, `getReviewRecords` path via `reviews.latestUnfinished` (rebuilt with `hydrate`), `generateNewWordReviewRecord`, `putWordReviewRecord`, the `useSave*`/`useDeleteWordRecord` hooks in `index.ts` (`useSaveWordRecord` awaits `words.add` and keeps the `dbID = -1` + `console.error` path and additionally calls a `reportSaveFailure()` that shows the error banner of Task 11), `migratePersonalSet`, `backfillPersonalExtras`, `fixWordNames` (thin calls), `exportDatabase`/`importDatabase` (download from `/api/export/db` or `/api/export/json`; upload to `/api/import`, same progress callback shape). The pure helpers in these files stay.

- [ ] **Step 1:** The five existing test files keep every assertion; only the arrange/assert plumbing changes to the harness tables (the worker is told exactly this and that no test may be deleted or weakened). Add tests for the new browser-side behaviour: `getHardWordsToday` sends the start of the local day (assert the argument for a fixed `now` in a fixed `TZ`), `useSaveWordRecord` returns `-1` and reports when `call` rejects.
- [ ] **Step 2: Run** `npx vitest run src/utils/db` → FAIL.
- [ ] **Step 3: Implement** the ports.
- [ ] **Step 4: Run** → PASS; `npx tsc --noEmit -p .` clean except the pre-existing `mixpanel.ts`/`trackEvent.ts` errors.
- [ ] **Step 5: Commit** `refactor: the db modules call the data server`

---

### Task 9: Port the direct callers (delegate)

**Files:** Modify `src/components/DonateCard/hooks/useWordStats.ts`, `src/pages/Analysis/hooks/useWordStats.ts`, `src/pages/ErrorBook/index.tsx`, `src/pages/Gallery-N/hooks/useDictStats.ts`, `useChapterStats.ts`, `useErrorWords.ts`, `useRevisionWordCount.ts`, `src/hooks/useCardProgress.ts`, `src/hooks/useSetProgress.ts`, `src/pages/Dashboard/index.tsx`, `src/pages/MySets/SetDetail/index.tsx`, `src/components/CustomDictsSync/index.tsx`, `src/pages/Typing/components/Setting/DataSetting.tsx`.

**Interfaces:** Each `db.…` call becomes the matching operation (`stats.summary` for the four DonateCard numbers; `words.between`; `words.wrong`/`words.wrongByDict`; `words.revisionCount`; `chapters.byDict`/`byDictChapter`); the five `useLiveQuery` become `useLive(query, topics, deps)` with the topics `cards:<dict>` (`useCardProgress`, `useSetProgress`, Dashboard progress), `customDicts` (`CustomDictsSync`, `SetDetail`), `reviewLog` and `wordRecords` (Dashboard activity). Records returned by the stat queries are passed through `hydrate` where the consumer uses class getters. Behaviour and rendered output stay identical.

- [ ] **Step 1: Implement** the replacements; after, `grep -rn "from 'dexie'\|useLiveQuery\|@/utils/db/database\|\bdb\." src` shows only `src/data/legacy/**` and `src/utils/db/database.ts`.
- [ ] **Step 2: Main session:** `npx tsc --noEmit -p .`, `npx eslint src --ext .ts,.tsx`, the full `npx vitest run`.
- [ ] **Step 3: Commit** `refactor: direct callers use the data server and live topics`

---

### Task 10: Flags in the file (main)

**Files:** Modify `src/store/personal.ts`, `src/hooks/usePersonalSeeds.ts`, `src/pages/MySets/SetDetail/index.tsx`, `SetEditor.tsx`, `CopyBuiltIn.tsx`, `src/store/customDicts.ts`, `src/store/customDicts.test.ts`; Create `src/data/meta.ts`.

**Interfaces:** `metaAtom` (a jotai atom holding `Record<string, string>`, set once by the gate from `meta.getAll()`), `listAtom(key: string)` derived read/write atoms: reading parses the JSON array stored under `key` (missing → `[]`), writing calls `meta.set(key, JSON.stringify(list))` and updates the atom immediately. `seededPersonalSetsAtom = listAtom('seededPersonalSets')`, `backfilledPersonalExtrasAtom = listAtom('backfilledPersonalExtras')`; their names, element types and the callers' `set(list => …)` usage stay. `usePersonalSeeds` no longer needs its "flags are still loading" guard because the gate guarantees they are loaded (the guard code stays harmless).

- [ ] **Step 1: Write the failing tests:** `listAtom` read of a missing key is `[]`; write then read; a write calls `meta.set` once with the JSON; the existing `customDicts.test.ts` scenario that sets `seededPersonalSetsAtom` to `['myVocab']` still passes with the store primed from a fake `meta` map.
- [ ] **Step 2: Run** `npx vitest run src/store src/data/meta` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `refactor: the data-describing flags live in the data file`

---

### Task 11: The boot gate (main)

**Files:** Create `src/data/gate.ts` (pure state machine), `src/data/DataGate.tsx`; Modify `src/index.tsx`; Test `src/data/gate.test.ts`.

**Interfaces:** `type GateState = { kind: 'checking' } | { kind: 'unreachable'; since: number } | { kind: 'ready' } | { kind: 'migrate'; found: LegacyCounts } | { kind: 'blocked-other-browser'; found: LegacyCounts } | { kind: 'old-copy'; found: LegacyCounts } | { kind: 'failed'; message: string }`; `reduceGate(state, event): GateState` with events `health`, `unreachable`, `legacyFound`, `legacyNone`, `migrated`, `dismissed`, `failed`, `retry`. Rules: unreachable server → `unreachable` (retry button, polls every 3 s); a reachable server that is `empty` and not `migrated` with legacy data found → `migrate`; not empty (or migrated) with legacy data found → `old-copy` (informational: "your data is in the file; this browser still holds an old copy", button to delete it, button to continue); `migrated` false and folder non-empty without the marker while legacy data differs → `blocked-other-browser`; nothing found → `ready`. `DataGate` renders the screens with existing `ModeFrame`/`PageMessage`/`Button`, preloads `meta.getAll()` into `metaAtom` before `ready`, and while `ready` shows a non-blocking top banner when `connectionState` is `down` ("The data server stopped responding; changes may not be saved").

- [ ] **Step 1: Write the failing tests** for `reduceGate` for every row above, plus `unreachable → retry → checking`, and that `failed` keeps the message and allows `retry`.
- [ ] **Step 2: Run** `npx vitest run src/data/gate.test.ts` → FAIL.
- [ ] **Step 3: Implement** `gate.ts` and `DataGate.tsx` and wrap `<Root />` in `src/index.tsx`.
- [ ] **Step 4: Run** → PASS; in the browser (`yarn dev:full`) stop the server: the full-page message appears; start it: the app appears.
- [ ] **Step 5: Commit** `feat: data gate with unreachable, migration and banner states`

---

### Task 12: Browser migration, both sides (main)

**Files:** Create `server/migration.ts`, `src/data/legacy/detect.ts`, `read.ts`, `migrate.ts`; Modify `server/http.ts` (mount the four routes); Test `server/migration.test.ts`, `src/data/legacy/migrate.test.ts`.

**Interfaces:**
- Server: `POST /api/migrate/begin` → `{ session }` (creates `staging-<session>.db` with the same schema inside the data folder; refuses when the main database has learning data or the marker `migratedAt` exists → 409 `CONFLICT`); `POST /api/migrate/batch` `{ session, table, rows }` inserts into staging preserving ids (tables: `wordRecords`, `chapterRecords`, `reviewRecords`, `customDicts`, `cardProgress`, `reviewLog`); `POST /api/migrate/commit` `{ session, counts, meta }` verifies the staging row counts equal `counts` (else 409, staging kept for inspection), then in one transaction copies staging into the main database (`ATTACH`, `INSERT … SELECT`), resets autoincrements, writes `meta.migratedAt` and the flag lists, deletes the staging file, takes a backup of the new file, and returns the final counts read from the main database; `POST /api/migrate/abort` deletes staging; stale staging files older than a day are removed at server start.
- Client: `detectLegacy(): Promise<LegacyCounts | null>` opens `RecordDB` with the raw IndexedDB API (no Dexie), returns per-table counts or `null` when the database does not exist or all tables are empty; `readTable(name, batchSize)` async-iterates rows by primary key; `runMigration(onProgress): Promise<{ counts: LegacyCounts }>` reads localStorage `seededPersonalSets` and `backfilledPersonalExtras`, calls begin → batches of 2,000 → commit, then compares the server's final counts with what it read and throws `MigrationMismatch` if any differ; `deleteLegacyCopy()` deletes the `RecordDB` database and the two localStorage keys (called only from the explicit button).

- [ ] **Step 1: Write the failing tests.** Server: begin on an empty folder; batches then commit copies everything with ids preserved and the next `words.add` id is highest + 1; commit with a wrong claimed count returns 409 and leaves the main database empty; begin on a populated database or after the marker returns 409; abort removes the staging file; two sessions cannot interleave into each other's staging; an exception inside the commit transaction (spy) leaves the main database unchanged. Client (jsdom + `fake-indexeddb` populated with the 6 tables through the old `db` in the test only, + the in-process harness): `detectLegacy` null when absent, counts when populated; `runMigration` moves everything, ids equal, flags copied, final counts equal; a failure injected in the middle of batch upload (reject the 3rd call) throws, the harness database stays empty and the IndexedDB data is untouched; `runMigration` twice after success is refused by the server (409) without duplicating rows; `deleteLegacyCopy` removes the database and keys.
- [ ] **Step 2: Run** `npx vitest run server/migration.test.ts src/data/legacy` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: verified, non-destructive migration of browser data into the file`

---

### Task 13: Remove Dexie from the app (delegate)

**Files:** Modify `package.json` (remove `dexie`, `dexie-react-hooks`, `dexie-export-import` from `dependencies`; keep `fake-indexeddb` as a dev dependency for the migration tests and the fixture test, which import Dexie through a devDependency), `src/utils/db/database.ts` (moved into `src/test/legacyDb.ts` for the fixture/migration tests only), `src/test/setup.ts`.

- [ ] **Step 1: Write the failing guard test** `src/data/no-dexie.test.ts`: reads every `.ts/.tsx` under `src` (excluding `src/test` and `*.test.ts`) and fails if one imports `dexie`, `dexie-react-hooks`, `dexie-export-import` or `utils/db/database`; and reads `package.json` asserting those three are not in `dependencies`.
- [ ] **Step 2: Run** the guard → FAIL (Dexie still listed).
- [ ] **Step 3: Implement** the removal; the fixture and legacy-migration tests import the Dexie database from `src/test/legacyDb.ts` and Dexie from devDependencies.
- [ ] **Step 4: Run** the full suite, `tsc`, eslint, `yarn build` (the bundle no longer contains Dexie) → PASS.
- [ ] **Step 5: Commit** `refactor: remove Dexie from the application`

---

### Task 14: Stable deployment (main)

**Files:** Create `docs/stable-deploy.md`, `scripts/launchd.plist.template`; Modify `scripts/stable-build.mjs`, `scripts/stable-start.mjs`.

**Interfaces:** `stable:build` produces `~/stable/qwerty/site` (the Vite build with `--base=/`) and `~/stable/qwerty/server.mjs` from a **clean checkout of a given tag or branch** (`--ref <name>`, default the current branch must be clean) via `git worktree` in a temp folder, so the stable build never contains uncommitted work. `stable:start` reads `~/.config/qwerty-learner/stable.json` (`{ "dataDir": "...", "port": 4173 }`), refuses to run without it, and starts the bundled server with `--role stable --static ~/stable/qwerty/site`. The guide covers: first install, the launchd file (starts at login, restarts on crash, logs to `~/Library/Logs/qwerty-learner.log`), choosing the data folder, `qwerty.localhost` with Caddy (optional), restoring a backup (stop server, copy `backups/qwerty-DATE.db` over `qwerty.db`, start), copying real data to dev, and an explicit "do not merge into `master` while it deploys to a static host" note.

- [ ] **Step 1: Write the failing tests** for the script argument/config validation (pure functions `parseStableConfig`, `buildPlist(config)` returning a string that contains the program path, the data dir and `RunAtLoad`).
- [ ] **Step 2: Run** `npx vitest run scripts` → FAIL (add `scripts/**/*.test.ts` to the Vitest include).
- [ ] **Step 3: Implement** and write the guide.
- [ ] **Step 4: Run** → PASS; build once with `--ref feat/file-storage` into a temp folder (not the learner's `~/stable`) and start it against a temp data dir.
- [ ] **Step 5: Commit** `feat: stable build, start script and deployment guide`

---

### Task 15: Verification (main)

- [ ] **Step 1:** `npx vitest run` (all tests, expected well over 450), `npx tsc --noEmit -p .`, `npx eslint src server scripts --ext .ts,.tsx,.mjs` clean (only the known `mixpanel.ts` / `trackEvent.ts` type errors).
- [ ] **Step 2: Browser checklist** with `yarn dev:full` and `./.dev-data`: fresh start (empty data, My Vocabulary seeded once, flags in `meta`); create, edit, copy, delete a set; a flashcard session and a quiz (cards and log in the file, dashboard updates without reload); a typing chapter (word and chapter records, analysis page, error book); Sentences run (reads only); two tabs: a card review in tab A updates tab B's dashboard; the reload of every page keeps data; Export (db and JSON) and Import (the JSON back, ids kept).
- [ ] **Step 3: Fault injection:** kill the server while typing (banner appears in seconds, the next save shows an error); restart (banner clears, app continues); start a second server on the same folder (refuses); start a `stable` server on the dev folder (refuses `ROLE_MISMATCH`); corrupt a copy of the database file (refuses `CORRUPT`); set `user_version` of a copy higher (refuses `NEWER_SCHEMA`); delete `qwerty.db` and restore from `backups/` (app works, data as of that backup).
- [ ] **Step 4: Performance sanity:** generate 100,000 word records and 5,000 chapter records in a temp database; measure `words.wrong`, `words.between` over a year, `stats.summary`, `activity.times`, and a `words.add` round trip over HTTP; record the numbers in `docs/stable-deploy.md` (acceptance: `words.add` under 20 ms, every read under 1 s; if not, add the missing index or an aggregate operation).
- [ ] **Step 5:** Fix findings, commit `fix: findings from the verification pass`.

---

### Task 16: Rollout on the learner's real data (main, with the learner)

Done step by step with the learner present; nothing here is automated, and nothing is deleted.

- [ ] **Step 1 (safety copy):** in the learner's current app (`localhost:5173` on `feat/study-modes`) Setting → Data → Export, and keep the `.gz`.
- [ ] **Step 2:** the learner chooses the data folder; `stable:build` from the merged branch; start with `stable:start`; open the stable address: the gate shows the migration screen with the counts found in this browser; the learner compares them with their expectations and confirms.
- [ ] **Step 3:** after "migrated", compare the counts shown on the result with the found counts; open My Sets, Flashcards (Due counts), Dashboard (streak), Error book; check `backups/` has today's file.
- [ ] **Step 4:** use the stable address for about two weeks; the old browser copy stays (the gate shows the "old copy" notice); only then use "delete this browser's old copy".
- [ ] **Step 5 (rollback at any time before Step 4):** stop the stable server, keep using the old build and browser copy (unchanged); the file is just a copy. Any new data written to the file after migration would not be in the old browser copy, so the learner decides before using both.

---

## Risks and how the plan answers them

| Risk | Answer |
|---|---|
| `node:sqlite` is marked experimental and may change | One adapter file; Node pinned in `engines`/`.nvmrc`; tests exercise the adapter directly, so an upgrade failure shows at once; swapping to another engine changes `adapter.ts` only |
| Semantic drift from Dexie (default ordering, `put` vs `add`, key types) | Faithful port with explicit `ORDER BY`; the existing assertions run unchanged against the server logic; ids and counts checked in migration and import tests |
| Class getters lost over JSON | `hydrate.ts` rebuilds the classes; tests cover `totalTime`, `wpm` |
| Race on flags at start (the earlier "flags still loading" bug) | The gate loads `meta` before rendering anything |
| Heavy statistics queries now cross HTTP | Ported faithfully; Task 15 measures; optimisation only if a number fails |
| Learner's running dev server breaks | Work is in a worktree; the main folder is not touched |
| Real data touched by a test or by dev | Role marker, stable requires explicit folder, dev folder inside the project, tests use temp/in-memory folders |
| Migration mismatch or interruption | Staging file + count verification + single commit transaction + backup after; browser copy never deleted automatically |
| Old build used after migrating (split brain) | Gate notice and guide; cannot be enforced technically, documented as a rule |
| Two different browser stores | Second one refused, never merged; path via export/import described |
| Static hosting (Pages/Docker) can no longer serve the app | Stated non-goal; do not merge into `master` while it deploys |

## Estimate

About 17 tasks: 6 small or medium and 5 large pieces for the main session (contract, cards/sets/personal procedures, client layer, flags, gate, migration, deployment, verification), 7 delegated pieces (adapter and folder, schema and repos, typing procedures, HTTP, exchange, the two ports, Dexie removal). Realistically several sessions of work; every task ends in a committed, tested state, and the branch is not merged until Task 16 step 2 has been rehearsed with the learner.
