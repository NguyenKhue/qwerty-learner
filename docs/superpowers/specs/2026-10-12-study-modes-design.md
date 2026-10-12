# Study modes (Quizlet-style features) — design

Date: 2026-10-12 · Status: draft for review

## Goal

Add Quizlet-style ways to learn vocabulary next to the existing typing practice: user-created sets,
flashcards with spaced repetition, multiple-choice quiz, and a matching game.

Personal use only. Everything is stored in the browser (IndexedDB). No backend, no sharing, no accounts.

Primary target is the user's own sets (e.g. "My Vocabulary", 555 IT words). All learning data is keyed by
`(dictionary id, word)` so the same modes can later be enabled for built-in dictionaries (CET, GRE, IELTS...)
without a data migration.

## Out of scope (YAGNI)

Sharing/publishing sets, accounts/sync, feeding the schedule into the existing typing mode, SRS charts,
reminders/notifications, editing built-in dictionaries (they can be duplicated into a custom set instead),
mobile layout (the app redirects widths ≤ 600px to `/mobile`).

## Existing code this builds on

- Dictionaries are static, `src/resources/dictionary.ts`, loaded by `useWordList` through
  `wordListFetcher(url)` (SWR). `currentDictInfoAtom` resolves the active dictionary.
- Word shape: `Word = { name, trans: string[], usphone, ukphone, notation? }` (`src/typings/index.ts`).
- IndexedDB via Dexie in `src/utils/db/index.ts`, currently `version(3)` with `wordRecords`,
  `chapterRecords`, `reviewRecords`. Export/import (`data-export.ts`, `dexie-export-import`) is generic over tables.
- Routes live in `src/index.tsx`; UI is Radix + Tailwind; state is jotai
  (`atomWithStorage` for config, see `src/store/atomForConfig.ts`).
- Pronunciation playback: `usePronunciation`, `WordPronunciationIcon`.

## Delivery: four sub-projects, in order

Each gets its own implementation plan and is shippable on its own.

| #   | Sub-project                          | Depends on |
| --- | ------------------------------------ | ---------- |
| P1  | Foundation + user-created sets       | —          |
| P2  | Flashcards + spaced repetition (SRS) | P1         |
| P3  | Multiple-choice quiz                 | P1, P2     |
| P4  | Matching game                        | P1         |

Flashcards and SRS are one sub-project because a schedule is meaningless without a grading UI.

## P1 — Foundation + user-created sets

### Data (Dexie `version(4)`, existing tables unchanged)

```
customDicts: 'id,name,updatedAt'
  { id: string, name: string, description: string, words: Word[], createdAt: number, updatedAt: number }

cardProgress: '[dict+word],dict,due'
  { dict: string, word: string, state: 'learning' | 'review',
    due: number (ms), interval: number (days), ease: number,
    reps: number, lapses: number, firstSeen: number, lastReviewed: number }
```

- A custom set becomes a `Dictionary` with `id = custom:<id>`, `url = idb:<id>`, `category = 'My Sets'`,
  `language = 'en'`, `languageCategory = 'en'`, `length = words.length`, `chapterCount` via `calcChapterCount`.
- A new card has no `cardProgress` row. The queue is derived (see P2), so no counter table is needed.
- `word` in `cardProgress` is `Word.name` compared case-sensitively; names are unique within a set
  (duplicates merged on import and on save).

### Loading

- `wordListFetcher` accepts `idb:<id>` URLs and reads `customDicts` through Dexie.
- A hook (`useAllDictionaries`) merges built-in dictionaries with custom ones; `currentDictInfoAtom`,
  Gallery and the typing page resolve custom ids through it. If the active custom set no longer exists,
  fall back to `cet4`, the same behaviour as an unknown dictionary id today.

### UI

- Gallery gets a "My Sets" group above the built-in groups with: "New set", "Import", and per-set
  edit / duplicate / delete.
- Set editor (`/my-sets/:id`, `/my-sets/new`): name, description, a table of words
  (name, meanings one per line, US/UK phonetic optional), add/remove/reorder rows, save.
- Import: CSV or JSON file. CSV columns `name,trans,usphone,ukphone` (`trans` separated by `;`).
  JSON uses the existing dictionary file format (`Word[]`), so files from `public/dicts/` can be imported.
- Duplicate a built-in dictionary into a custom set (fetches its words and stores a copy).

### Errors

- Import: skip invalid rows, list them with line numbers and reasons, allow importing the valid rows.
- Duplicate names: merged, shown as a warning.
- Delete set: confirm dialog; also deletes that set's `cardProgress` rows.
- Unknown set id in a route: redirect to Gallery.

### Acceptance

A user can create a set by hand, import the 555-word JSON, see it in Gallery, practise it in the existing
typing mode, export/import all data and get the sets back.

## P2 — Flashcards + SRS

### Scheduler (`src/utils/srs/scheduler.ts`, pure)

`nextState(card | undefined, grade, now) -> card`, grades `again | hard | good | easy`, simplified SM-2:

- New card, first grade: `again` → `learning`, due in 10 min; `hard` → due 1 day, interval 1;
  `good` → interval 1; `easy` → interval 3. Initial ease 2.5.
- Review card: `again` → `lapses+1`, ease −0.2 (min 1.3), state `learning`, due in 10 min, interval reset to 1;
  `hard` → interval × 1.2, ease −0.15; `good` → interval × ease; `easy` → interval × ease × 1.3, ease +0.15.
- Interval is rounded to whole days (min 1) and `due` is the start of that day offset from `now`.
- `learning` cards graded `good`/`easy` graduate to `review` with interval 1 / 3.

### Queue (`src/utils/srs/queue.ts`, pure)

Today's queue = cards with `due <= now` (oldest first), then new cards in set order, limited to
`newPerDay` (default 20, user setting). New cards already introduced today (`firstSeen >= start of today`)
count against the limit. In-session `again` cards are re-queued at the end of the session.

### UI (`/study/:dictId`)

- Front: word, phonetic, pronunciation button (existing hook). Space flips to the meanings.
  Toggle for reversed direction (meaning first). Grade with keys 1–4 or buttons; show the next interval on
  each button.
- Header: remaining new / due counts. Empty queue: "Done for today" screen with the next due date.
- Entry points: a "Study" button on each custom set card and on the typing page's dictionary menu.

### Acceptance

Grading cards persists to `cardProgress`, reloading keeps the queue state, cards graded `good` do not
reappear until due, and the new-card limit is respected across reloads on the same day.

## P3 — Multiple-choice quiz (`/quiz/:dictId`)

- Question: word → pick the meaning, or meaning → pick the word (toggle). 4 options.
- Distractors: random words from the same set; prefer the same part-of-speech prefix (`n.`, `v.`, `adj.`...)
  when the meaning starts with one. If the set has fewer than 4 words, quiz is unavailable with a message.
- Length: 10 / 20 / all. Result screen lists missed words.
- SRS effect: a wrong answer records `again`; a correct answer records `good` only if the card is currently
  due. Correct answers on non-due cards only count toward the session score.

## P4 — Matching game (`/match/:dictId`)

- 6 word/meaning pairs on a grid; select two to match, matched pairs disappear, timer runs.
- Best time per set stored in `localStorage` (not IndexedDB, not in SRS).
- Needs ≥ 6 words.

## Testing

- Add Vitest (devDependency) for pure logic: scheduler, queue builder, CSV/JSON parser, distractor chooser.
  The repo currently has no unit test runner (`"test": "echo \"No tests\""`).
- One Playwright smoke test per new page (existing `tests/` + `playwright.config.ts`).
- Manual verification in the browser before each sub-project is reported done.

## Risks / open points

- Large built-in sets later (thousands of words): the queue builder must stay O(n); only the
  `[dict+word]` rows that exist are read, new cards come from the in-memory word list.
- Dexie export/import uses `clearTablesBeforeImport: true`; importing an old backup that lacks the new
  tables keeps them untouched (`acceptMissingTables: true` is already set) — verify in P1.
- The existing translation work leaves partially Chinese glosses in many built-in dictionaries; custom sets
  are unaffected.

## Findings from P1 implementation

- Export/import of user data (`dexie-export-import`, `clearTablesBeforeImport: true`) carries `customDicts` and `cardProgress`: an export followed by an import restores them (verified in the browser).
- Importing a backup made **before** P1 (no `customDicts`/`cardProgress` tables) clears the current custom sets and progress, because the import replaces all tables. This is the existing "restore replaces everything" behaviour and was left unchanged.
- Under Vitest the app's import graph (`@/utils` → `mixpanel` → `@/store` → `@/resources/dictionary`) needs `window` and `window.matchMedia` at load time, so tests run in `jsdom` with a `matchMedia` stub (`src/test/setup.ts`).

## Findings from P2 implementation

- The study queue is a snapshot built when "Start" is pressed. A card graded `again` is saved as due in 10 minutes, so after a reload it reappears only once those 10 minutes have passed (inside a running session it is re-queued at the end).
- `nextState` takes the card identity as an extra argument (a new card has no row to read `dict`/`word` from); learning cards graded `again`/`hard` stay `learning` without counting a lapse; the interval is capped at 365 days and `ease` never drops below 1.3.
- Study entry points are shown for custom sets only; the `/study/:dictId` route itself works for any dictionary id.

## Findings from P3 implementation

- "Fewer than 4 words" is implemented as "fewer than 4 distinct meanings among the words that have a meaning": that is what guarantees 3 distractors whose text differs from the answer.
- A word that has the same meaning text as the answer is never offered as a distractor, and option texts never repeat.
- A wrong answer on a never-studied word records `again`, which introduces it as a learning card and therefore uses up one of the day's new-card slots (consequence of the spec rule). A correct answer on a new or not-yet-due card writes nothing.
