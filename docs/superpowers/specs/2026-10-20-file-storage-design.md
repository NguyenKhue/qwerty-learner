# File storage: the data folder is the source of truth

Date: 2026-10-20 · Branch: `feat/file-storage` (worktree `../qwerty-learner-file-storage`, based on `feat/study-modes` at `e125d8b5`)

## Why

Everything the learner has done (their own sets, study cards, review log, typing history, the error book) lives in the browser's IndexedDB, plus a few flags in localStorage. It is tied to one browser and one address, it disappears when site data is cleared, and a second address (for example a stable build next to the dev build) starts empty. The learner wants the data to be **a real file on their own machine**, and wants to run a **stable build separate from development**.

Success: the learner's data lives in a folder they chose (`qwerty.db` plus automatic backups); clearing the browser, switching browser, or opening the app from another address loses nothing; the dev build can never touch the real folder; and nothing the learner sees or does in the app changes.

## Decided by the learner

- **The file is the only source of truth.** No copy of the data stays in the browser; the app needs the data server to be running. When it is not reachable the app says so clearly and does not save anything somewhere else.
- **One SQLite file** (`qwerty.db`), not many JSON files.
- **Only the flags that describe the data move into the file** (the "already seeded", "already topped up" and "spelling fixed" markers). Interface preferences (dark mode, current set, current chapter, new-cards-per-day, quiz and sentences length, and so on) stay in the browser's localStorage.
- **Dev and stable use separate data folders.** Dev writes to a throwaway folder inside the project (never committed); stable writes to the real folder. A command copies real data into the dev folder when the learner wants to test with real data.

## What gets built

### 1. A data server (`server/`, Node 22)

A small Node program, no native dependencies: it uses Node's built-in `node:sqlite` (verified on this machine, Node 22.23: WAL, 100,000 rows, `VACUUM INTO`, `quick_check`, transactions and rollback all work; it prints an "experimental" warning that the start script silences). It is bundled with `esbuild --bundle --platform=node --format=esm --target=node22 --alias:@=./src` (verified; the explicit `--target` is required because `tsconfig.json` says `es5`).

- Listens on `127.0.0.1` only. Same origin as the app (in dev, Vite proxies `/api`; in stable the same server also serves the built files with a fallback to `index.html` for client routes), so no CORS.
- Configuration: data folder (required in stable, defaults to `./.dev-data` in dev), port.
- Endpoints: `POST /api/rpc/<procedure>` (JSON in, JSON out, see below), `GET /api/events` (server-sent events), `GET /api/health`, `GET /api/export/db` (a consistent copy of the database file), `GET /api/export/json` (gzip of the same Dexie-compatible JSON the app exports today), `POST /api/import` (a legacy `.gz` export or the browser-migration upload).

### 2. Domain operations instead of generic queries

The server exposes named operations, not a query language, because several existing operations are read-then-write transactions (a flashcard review reads the card, computes the next state, writes the card and the log) and must be atomic. The scheduling and set logic that exists today as pure TypeScript (`nextState`, `srsEffect`, `normalizeWords`, `mergeExtras`, `mergeExamples`, `attachExtras`…) is shared with the server by import, not copied.

The operations (the existing function in parentheses keeps its name and signature on the client):

| Group                 | Operations                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Study cards           | `cards.byDict(dict)` (`getDictProgress`), `cards.review(dict, word, grade, now?)` (`reviewCard`), `cards.reviewQuiz(dict, word, correct, now?)` (`reviewQuizAnswer`), `log.hardWordsSince(dict, sinceMs)` (`getHardWordsToday`, the browser computes the start of today)                                                                                             |
| Activity              | `activity.times(fromMs)` (the raw review times and typed times that `loadActivity` turns into the week and streak)                                                                                                                                                                                                                                                   |
| My Sets               | `sets.list()`, `sets.get(id)`, `sets.create(input)`, `sets.update(id, input)`, `sets.delete(id)` (deletes the set and its cards, typing records, chapter records and review records in one transaction)                                                                                                                                                              |
| Built-in personal set | `personal.migrate(input)`, `personal.backfill(customId, extras)`, `personal.fixNames(customId, renames)`                                                                                                                                                                                                                                                             |
| Typing records        | `words.add(record)` (returns the new id), `words.deleteByWord(word, dict)`, `chapters.add(record)`, `words.between(start, end)`, `words.wrong()`, `words.wrongByDict(dict)`, `words.revisionCount(dict)`, `chapters.byDict(dict)`, `chapters.byDictChapter(dict, chapter)`, `stats.summary()` (chapter count, word count, first word timestamp, sum of wrong counts) |
| Error-book review     | `reviews.latestUnfinished(dict)`, `reviews.put(record)`                                                                                                                                                                                                                                                                                                              |
| Flags                 | `meta.getAll()`, `meta.set(key, value)`                                                                                                                                                                                                                                                                                                                              |

The first version is a **faithful port**: same results as today's queries, including records with their `id`. Optimising the heavy statistics queries is out of scope.

### 3. The client

- `src/data/`: the typed contract (one place that lists every operation with its arguments and result, imported by both sides), the RPC client, the live-update hook, and the boot gate.
- The modules in `src/utils/db/` and the few pages that talk to the database directly keep their exported function names and signatures and call the server instead. The record classes with getters (`WordRecord.totalTime`, `ChapterRecord.wpm`, …) are rebuilt from the JSON the server returns.
- **Live updates:** `useLiveQuery` (used in 5 places) is replaced by a hook that runs a query and runs it again when the server announces a change to a topic it depends on (`customDicts`, `cards:<dict>`, `reviewLog`, `wordRecords`). The server announces over server-sent events after every committed write; the client that made the write also refreshes at once.
- **Boot gate** (a component around the whole app): (1) ask `/api/health`; if the server is unreachable show a full-page message (what to start, a Retry button) and render nothing else; (2) load the flags; (3) if the folder is empty and this browser holds IndexedDB data, offer the migration (below); (4) render the app. Because the flags are loaded before anything renders, the "flags still loading" race that once made the spelling fix skip its step cannot happen.

### 4. The data folder

```
<folder>/qwerty.db            the database (WAL mode, synchronous=FULL)
<folder>/qwerty.db-wal/-shm   SQLite's journal files, present while the server runs
<folder>/backups/             daily copies made with VACUUM INTO
<folder>/server.lock          so two servers can never write to one folder
<folder>/README.txt           what the files are and how to restore
```

Tables (`INTEGER PRIMARY KEY AUTOINCREMENT` where the app uses `++id`, so ids that chapter records point to are preserved): `word_records`, `chapter_records`, `review_records`, `custom_dicts` (the words of a set as one JSON column), `card_progress` (key: dict + word), `review_log`, `meta` (key, value). Indexes mirror today's Dexie indexes. The schema version is kept in `PRAGMA user_version` with forward-only migrations; a server refuses to open a database whose version is newer than it knows.

Safety rules: `quick_check` at start (refuse to serve and say why when it fails); a backup at start and then daily; keep the last 14 daily copies and 8 weekly copies; refuse to start when another live server holds the lock; a stale lock (dead process) is taken over; every write is inside a transaction.

### 5. Moving the learner's existing data

A one-time flow in the browser, non-destructive:

1. The gate sees an empty folder and a populated `RecordDB` in IndexedDB and shows how many records of each kind were found.
2. On confirm, the browser reads each table (without Dexie's export, in batches of about 2,000 rows) and uploads them preserving ids, together with the three flags from localStorage.
3. The server inserts everything in one transaction, then the client asks for the counts and compares them with what it read; only a match marks the migration done (`meta`).
4. The browser copy is **left untouched**. A button offers to delete it later, after the learner has used the app from the file for a while. Nothing deletes it automatically.

The learner can also import a `.gz` file made by today's export (Setting → Data) into the folder, and the Export button now downloads the database file or the JSON.

### 6. Dev and stable

- `yarn dev:full`: the data server (dev folder `./.dev-data`) and Vite together; Vite proxies `/api` to the server.
- `yarn stable:build`: builds the app with `--base=/` and bundles the server into one file.
- `yarn stable:start`: runs that file with the real data folder from a small config the learner owns; refuses to start without an explicit folder.
- A launchd file and a short guide so the stable server starts when the Mac starts.
- `yarn data:copy-to-dev`: copies the real database into the dev folder (via a backup copy, never the live files).

## Goals

- No silent data loss and no split brain: one writer, one place the data lives.
- The app behaves as today when the server is up (same screens, same results; the typing hot path never waits visibly on the server).
- Every existing test scenario for the data layer still exists and passes, run against the real server logic.
- The dev build cannot write to the real folder by accident.

## Non-goals

- Syncing between devices, an offline mode, accounts or passwords, access from other machines (loopback only; a LAN or remote setup would need a token and is a separate project), a desktop (Tauri) build, cloud storage.
- Changing any screen, rule or number the learner sees, except the new "server not reachable" and "move your data" screens and the Export/Import wording.
- Optimising statistics queries or changing what they return.

## Anti-goals (a failure even if everything "works")

- Any path in which data is written to the wrong folder, to two places, or to the browser instead of the file.
- Deleting or overwriting the browser copy or the learner's `.gz` exports automatically.
- A migration that reports success without matching counts.
- A schema change that cannot be recovered from a backup.

## Constraints

- Node 22.13 or newer (where `node:sqlite` needs no flag); record it in `package.json` `engines` and `.nvmrc`. No native add-ons, no new runtime dependency for the server beyond Node itself.
- The server code lives in `server/`, imports shared pure modules from `src/` through the `@/` alias, and is bundled with the esbuild command above. SQLite access goes through one small adapter file so that swapping the engine later changes one file.
- The client contract file and the shared pure modules import nothing from React, jotai or browser APIs.
- Tests: Vitest. Server and migration tests run in the `node` environment against an in-memory database; client data-layer tests run against the real server logic through an in-process `fetch`, so the existing data tests keep their assertions. Component tests remain out.
- Code style as in the repository (no semicolons, single quotes, 2-space indent, 140 columns).
- Work happens in the worktree on `feat/file-storage`; the folder with `feat/study-modes` and the learner's running dev server are not touched until the learner merges.

## Settled after the builder check (the author's calls, to be confirmed when the learner reads this)

- **The migration marker and several browsers.** The marker lives in `meta` inside the file. The migration is offered only when the folder holds no learning data and no marker. If the folder already has data and a browser still holds an old copy, the gate does not offer to merge or overwrite: it tells the learner their data is in the file and offers the (manual) "delete this browser's old copy" button. If a second browser or address holds a _different_ IndexedDB, it is refused (never merged, never overwritten) and the screen points to the old export (Setting → Data → Export in that old build) and the file import. Restoring an older backup that lacks the marker makes the migration offer appear again; that is intended. Opening an old build (for example `feat/study-modes`) after migrating still reads its own browser copy: nothing can stop that, so the migration screen and the guide tell the learner to stop using it.
- **The flags that move** are the two jotai atoms in `src/store/personal.ts`: `seededPersonalSets` and `backfilledPersonalExtras` (that one also holds the spelling-fix marker). They become atoms hydrated from `meta.getAll()` at the gate and written back with `meta.set`; the migration copies both lists as they are, so nothing is redone on migrated data.
- **The typing hot path** awaits the call (loopback: a few milliseconds), exactly as it awaits IndexedDB today; there is no queue. A failed write shows a visible error and logs, the word's id stays `-1` as it does today. The page also watches the live-update stream: when it drops, a banner says the data server is unreachable; the app is never silently usable-but-not-saving.
- **The operations table is the starting inventory, not a limit.** Every direct `db.` call (about 90 in 8 tables) must be replaced; the builder adds operations for call sites not listed (for example `copy-dict`, the delete count). `revisionDictRecords` and `revisionWordRecords` are in the Dexie class but in no schema version and used nowhere: they are dropped, not migrated. Wherever Dexie's order was implicit, the SQL says `ORDER BY` explicitly to match (primary key ascending for plain scans, the index for `orderBy`).
- **Time.** The browser always sends `now` or day boundaries; the server never computes local days or time zones. When an operation's `now` is omitted the server uses its own clock.
- **Other targets.** The Docker image, the hosted web build and the Tauri config are not supported by this branch (the app needs the data server) and are not touched. Do not merge this branch into `master` while the repository deploys it to a static host.
- **Import and export.** Importing a legacy `.gz` replaces everything, after a backup of the current file, and preserves ids. The JSON export and import are written by hand for the documented Dexie export format (the server does not use Dexie), with the same database name and version as the app declares.
- **Backup retention.** Daily files; the Sunday daily file is also what the "weekly" set keeps (kept 8 weeks, daily ones 14 days). The check runs at start and again hourly while the server stays up.

## Left to the builder

File and folder names inside `server/` and `src/data/`, the SQL column names and how rows map to the existing interfaces, the exact JSON error format, server-sent-event reconnect and topic details, how the gate screens look (within the app's existing components and tokens), and how the migration upload is batched.
