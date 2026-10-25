# Video Dictation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/dictation` mode: the learner pastes a YouTube link (or picks one), hears one sentence at a time from the embedded video, and types it from blanks with a Vietnamese hint; every prepared video is cached in the data folder.

**Architecture:** The data server prepares a video in a background job (`yt-dlp` for subtitles, YouTube's Vietnamese track or the `claude` CLI for translation) and stores sentences and progress in two new tables (schema version 2). The browser reads them through new RPC procedures, plays segments with the YouTube IFrame API, and reuses the Sentences typing line and session logic (made generic).

**Tech Stack:** TypeScript, React, Vitest (jsdom), Node 22 `node:sqlite` server, YouTube IFrame API, `yt-dlp` and `claude` CLI as child processes.

**Spec:** `docs/superpowers/specs/2026-10-24-video-dictation-design.md`

## Global Constraints

- Local personal use only. No video or audio is downloaded; no subtitles or video are committed to the repository.
- Style: no semicolons, single quotes, 2-space indent, 140 columns, shadcn/Tailwind tokens only, no new colours, no new runtime dependencies.
- Tests: Vitest files next to the code; `src/**/*.test.ts`, `server/**/*.test.ts`, `scripts/**/*.test.ts`. No test touches the network, `yt-dlp` or the real `claude` CLI (fakes return fixtures).
- Every external command is run with an argument array, never through a shell. A video id must match `^[A-Za-z0-9_-]{11}$` before it reaches any command or file path.
- Time limits: `yt-dlp` 60 s, one translation batch 120 s; output capped (4 MB for `yt-dlp`, 1 MB for a translation batch). A tool that exceeds a limit is killed.
- Typing feel is the Sentences feel: a wrong key is rejected, no Backspace; the last typed character moves on after 400 ms; Peek counts one mistake. Playback speed is 1×. Matching is lenient: lowercase letters, digits, spaces and the apostrophe only.
- Sentence limits: 3 to 25 words, at most 200 characters after normalising, at most 10 s; split pauses over 0.7 s; segment lead-in and tail 0.3 s.
- Never touches flashcard progress, review log, typing history, custom sets.
- The existing server rule stands: an older server refuses a newer schema (`NEWER_SCHEMA`).

## Review Focus

- A pasted link that carries shell characters or a wrong id (`https://youtu.be/abc; rm -rf ~`, a playlist link, 10 characters): rejected with a clear message, nothing is run. (Task 1 and Task 4)
- Subtitles that are only `[Music]` or are empty, or a video with no English track: the status ends in `error` with code `NO_SUBTITLES` and a readable message; the server keeps serving. (Task 2 and Task 4)
- Auto subtitles with repeated overlapping lines: no sentence is duplicated and no word is repeated within a sentence. (Task 2)
- `yt-dlp` or `claude` missing, hanging, or exiting non-zero: the job ends (with `NO_YTDLP`, `TIMEOUT` or `FETCH_FAILED`), a second `prepare` after a failure starts a new job, and a failed translation still leaves a usable video without hints. (Task 4)
- A translation reply of the wrong length or not JSON: nothing is misaligned; those sentences simply have no Vietnamese. (Task 4)
- Two `prepare` calls for the same video at once share one job. (Task 4)
- A sentence with non-ASCII letters, digits with punctuation (`3.5`, `U.S.`) or a contraction: either typable on a standard keyboard or dropped, never a dead end. (Task 2)

---

## File structure

- `src/data/contract.ts` — new procedure types and topics (Task 1)
- `src/utils/dictation/{types,videoId,normalize,captions,sentences}.ts` — pure logic (Tasks 1, 2)
- `server/schema.ts`, `server/repo/videos.ts` — version 2 tables and storage (Task 3)
- `server/dictation/{tools,youtube,translate,service}.ts` — child processes and the preparation job (Task 4)
- `server/procedures/dictation.ts`, `server/http.ts`, `server/config.ts`, `server/main.ts`, `server/cli.ts`, `scripts/lib/stable.mjs`, `scripts/stable-start.mjs` — wiring and tool settings (Task 5)
- `src/utils/sentences/session.ts` — made generic (Task 6); `src/utils/dictation/{items,session}.ts` (Task 6)
- `src/pages/Dictation/{index,Setup,Run,Result}.tsx`, `useYouTubePlayer.ts`, `segment.ts` (Tasks 7, 8); no store file: version 1 has no remembered settings
- `src/index.tsx`, `src/components/AppShell/navItems.ts`, `public/dictation/videos.json`, `docs/stable-deploy.md` (Task 9)

---

### Task 1: Contract, types and the video id

**Files:**

- Create: `src/utils/dictation/types.ts`, `src/utils/dictation/videoId.ts`
- Modify: `src/data/contract.ts`
- Test: `src/utils/dictation/videoId.test.ts`, `src/data/contract.test.ts` (extend)

**Interfaces:**

- Produces (`types.ts`):
  ```ts
  export type DictationSentence = { start: number; end: number; en: string; vi?: string; viSource?: 'youtube' | 'ai' }
  export type VideoProgress = { position: number; correct: number; wrong: number; finished: boolean; updatedAt: number }
  export type DictationVideo = {
    id: string
    title: string
    channel: string
    durationSec: number
    subtitleKind: 'manual' | 'auto'
    sentences: DictationSentence[]
    preparedAt: number
    note?: string
    progress?: VideoProgress
  }
  export type DictationVideoSummary = Omit<DictationVideo, 'sentences'> & { sentenceCount: number }
  export type DictationErrorCode = 'NO_YTDLP' | 'NO_SUBTITLES' | 'FETCH_FAILED' | 'TIMEOUT' | 'BAD_VIDEO'
  export type DictationStatus = {
    state: 'idle' | 'running' | 'ready' | 'error'
    step?: 'subtitles' | 'sentences' | 'translating'
    error?: { code: DictationErrorCode; message: string }
  }
  ```
- Produces (`videoId.ts`): `parseVideoId(input: string): string | null`, `isVideoId(value: string): boolean`.
- Produces (contract): `'dictation.videos'` (`[]` → `DictationVideoSummary[]`), `'dictation.get'` (`[id]` → `DictationVideo | null`), `'dictation.prepare'` (`[id]` → `DictationStatus`), `'dictation.status'` (`[id]` → `DictationStatus`), `'dictation.saveProgress'` (`[id, progress: Omit<VideoProgress, 'updatedAt'>]` → `null`), `'dictation.remove'` (`[id]` → `null`). Topics: `prepare`, `saveProgress`, `remove` publish `dictation` and `dictation:<id>`.

- [ ] **Step 1: Write the failing tests.** `videoId.test.ts`: `parseVideoId` returns `'dQw4w9WgXcQ'` for the watch, `youtu.be`, `shorts`, `embed` and `m.youtube.com` forms, for a bare id, and with extra query parameters; returns `null` for `''`, a 10-character id, `'https://youtu.be/abc; rm -rf ~'`, a playlist-only link, and a non-YouTube host. `contract.test.ts`: `topicsOf('dictation.saveProgress', ['abcdefghijk', {}])` equals `['dictation', 'dictation:abcdefghijk']`; reads publish nothing.
- [ ] **Step 2: Run** `npx vitest run src/utils/dictation src/data/contract.test.ts` → FAIL.
- [ ] **Step 3: Implement** the types, `parseVideoId` (URL parsing with the `URL` class, id matched against `^[A-Za-z0-9_-]{11}$`), the six procedure types, their entries in `NAME_TABLE`, and the topics in `topicsOf`.
- [ ] **Step 4: Run** the tests → PASS; `npx tsc --noEmit -p .` shows only the pre-existing `mixpanel`/`trackEvent` errors.
- [ ] **Step 5: Commit** `feat: dictation contract, types and video id parsing`

---

### Task 2: Subtitle parsing, sentence building and lenient text

**Files:**

- Create: `src/utils/dictation/{normalize,captions,sentences}.ts`, `src/utils/dictation/fixtures/auto.json3.json`, `fixtures/manual.json3.json`
- Test: `src/utils/dictation/{normalize,captions,sentences}.test.ts`

**Interfaces:**

- Consumes: `DictationSentence` (Task 1).
- Produces: `normalize.ts`: `dictationText(en: string): string | null` (lowercases, maps `’ ‘` to `'`, turns every character other than `a-z 0-9 '` into a space, collapses and trims; returns `null` when the original had a letter outside ASCII, or the result is empty or longer than 200 characters); `captions.ts`: `type TimedWord = { startMs: number; text: string }`, `parseJson3(json: string): TimedWord[]` (word timing from `tOffsetMs` when present, otherwise the words of an event are spread evenly across its duration; drops `[Music]`-style tags, newline-only and empty segments, and exact repeats of the previous word group that overlap in time); `sentences.ts`: `buildSentences(words: TimedWord[], totalMs: number): Omit<DictationSentence, 'vi' | 'viSource'>[]` (applies the Global Constraints sentence limits; splits at terminal punctuation when the text has any, else at pauses; a sentence's `end` is the next sentence's start or `totalMs`; drops sentences whose `dictationText` is `null` or under 3 words).

- [ ] **Step 1: Write the failing tests.** `normalize.test.ts`: `dictationText("Don't stop, it's 3.5!")` → `"don't stop it's 3 5"`; `dictationText('Café')` → `null`; `dictationText('   ')` → `null`; a 201-character input → `null`; `dictationText('well-known')` → `'well known'`. `captions.test.ts` (fixture `auto.json3.json` holds rolling duplicated lines and a `[Music]` event): `parseJson3(fixture)` has no `[Music]`, no word run repeated, and non-decreasing `startMs`; the manual fixture yields words spread inside each event; invalid JSON throws. `sentences.test.ts`: punctuated text splits at `.`/`?`; unpunctuated words split at a 0.8 s pause but not at 0.5 s; a 40-word run is cut at 25 words; every sentence has `end > start` and `end - start <= 10`; a 2-word sentence is dropped; a sentence with `é` is dropped.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the three modules per the signatures. Build the two fixtures by hand from the json3 structure (`events[]` with `tStartMs`, `dDurationMs`, `segs[].utf8`, `tOffsetMs`), about 20 lines each.
- [ ] **Step 4: Run** → PASS. Add the case from Review Focus "digits with punctuation" and "repeated overlapping lines" to the tests if not already covered.
- [ ] **Step 5: Commit** `feat: dictation subtitle parsing and sentence building`

---

### Task 3: Schema version 2 and the video repository

**Files:**

- Modify: `server/schema.ts` (SCHEMA_VERSION 2, forward migration 1→2), `server/schema.test.ts`
- Create: `server/repo/videos.ts`
- Test: `server/repo/videos.test.ts`

**Interfaces:**

- Consumes: `DictationVideo`, `DictationVideoSummary`, `VideoProgress` (Task 1), `Db` (`server/adapter.ts`).
- Produces (`videos.ts`): `saveVideo(db: Db, video: Omit<DictationVideo, 'progress'>): void` (replaces an existing cache and keeps its progress), `getVideo(db: Db, id: string): DictationVideo | null` (with `progress` when saved), `listVideos(db: Db): DictationVideoSummary[]` (newest opened first), `saveProgress(db: Db, id: string, p: Omit<VideoProgress, 'updatedAt'>, now: number): void` (throws `NOT_FOUND`-style `Error` when the video is not cached), `removeVideo(db: Db, id: string): void` (removes cache and progress).
- Tables: `video_cache (id TEXT PRIMARY KEY, title, channel, duration_sec, subtitle_kind, prepared_at, note, sentences TEXT)` and `video_progress (video_id TEXT PRIMARY KEY, position, correct, wrong, finished, updated_at)`.

- [ ] **Step 1: Write the failing tests.** `schema.test.ts`: a fresh database has `user_version` 2 and both tables; a version-1 database (built by running the old v1 SQL, set `PRAGMA user_version = 1`) is migrated to 2 with its existing rows intact; `user_version` 3 still throws `NEWER_SCHEMA`. `videos.test.ts` (in-memory db): save then get returns the same sentences; saving again keeps progress; `saveProgress` then `getVideo` returns it with `updatedAt === now`; `listVideos` carries `sentenceCount` and the progress; `saveProgress` for an unknown id throws; `removeVideo` removes both rows.
- [ ] **Step 2: Run** `npx vitest run server/schema.test.ts server/repo/videos.test.ts` → FAIL.
- [ ] **Step 3: Implement.** Export and import: the database-file export (`/api/export/db`) already contains the new tables; the JSON (Dexie-format) export is left unchanged and does not carry them (the cache can be prepared again; only progress is lost), and the spec says so. Keep `SCHEMA_V1` unchanged and add `MIGRATE_V1_TO_V2` run in one transaction; a fresh database runs v1 then the migration; `SCHEMA_VERSION = 2`. `/api/health` already reports `SCHEMA_VERSION`.
- [ ] **Step 4: Run** the whole `server/` suite → PASS (existing folder/health tests that assert `schemaVersion` 1 are updated to 2).
- [ ] **Step 5: Commit** `feat: schema version 2 with video cache and progress tables`

---

### Task 4: Tool runner, subtitle fetch, translation and the preparation job

**Files:**

- Create: `server/dictation/tools.ts`, `server/dictation/youtube.ts`, `server/dictation/translate.ts`, `server/dictation/service.ts`
- Test: `server/dictation/{tools,youtube,translate,service}.test.ts`

**Interfaces:**

- Consumes: `parseJson3`, `buildSentences`, `dictationText` (Task 2), `videos` repo (Task 3), `isVideoId` (Task 1).
- Produces (`tools.ts`):
  ```ts
  export type ToolResult = { stdout: string; stderr: string; code: number }
  export type RunTool = (command: string, args: string[], opts: { timeoutMs: number; maxBytes: number; input?: string; cwd?: string }) => Promise<ToolResult>
  export class ToolError extends Error { kind: 'missing' | 'timeout' | 'toobig' }
  export const runTool: RunTool // child_process.spawn, no shell; kills on timeout or overflow
  ```
- Produces (`youtube.ts`): `export class DictationFailure extends Error { code: DictationErrorCode }` (also thrown by the service for `NO_SUBTITLES`), and `fetchSubtitles(id: string, d: { runTool: RunTool; ytDlp: string; tmpDir: string }): Promise<{ title: string; channel: string; durationSec: number; kind: 'manual' | 'auto'; enJson3: string; viJson3?: string }>` — rejects with `DictationFailure` (`{ code: DictationErrorCode; message: string }`) for `NO_YTDLP`, `NO_SUBTITLES`, `FETCH_FAILED`, `TIMEOUT`.
- Produces (`translate.ts`): `translateBatches(sentences: string[], d: { runTool: RunTool; claude: string }): Promise<(string | undefined)[]>` — batches of 40, one entry per input, `undefined` where a batch failed or its reply did not validate (a JSON array of strings of the same length); never rejects.
- Produces (`service.ts`):

  ```ts
  export type DictationService = {
    prepare(id: string): DictationStatus // starts a job when none runs and the video is not cached; returns the current status
    status(id: string): DictationStatus
    idle(): Promise<void> // resolves when no job runs (tests)
  }
  export function createDictationService(d: {
    db: Db
    runTool: RunTool
    tools: { ytDlp: string; claude: string }
    publish(topics: string[]): void
    now(): number
    tmpDir?: string
  }): DictationService
  ```

  A cached video has status `ready`; a running job reports its `step`; a failed job reports `error` until the next `prepare` starts a new one. Steps publish `dictation:<id>`; success also publishes `dictation`.

- [ ] **Step 1: Write the failing tests** (fake `RunTool` returns fixtures; never the network). `tools.test.ts`: `runTool` with `node -e` returns stdout; a missing command throws kind `missing`; a sleeping command with `timeoutMs: 100` throws `timeout` and the process is gone; output over `maxBytes` throws `toobig`. `youtube.test.ts`: the fake returns an info JSON and writes json3 files into `tmpDir`; `kind` is `manual` when an English manual track exists, else `auto`; no English track → `NO_SUBTITLES`; missing command → `NO_YTDLP`; an invalid id never reaches `runTool`. `translate.test.ts`: 85 sentences make 3 calls; a reply of the wrong length leaves that batch `undefined` and the others filled; non-JSON reply and a `ToolError` leave `undefined`; the prompt carries the sentences as a JSON array. `service.test.ts`: success stores a video with sentences, `viSource` `youtube` where the fake supplied a Vietnamese track and `ai` where translation filled the rest; a subtitle file with only `[Music]` ends `error` `NO_SUBTITLES` and stores nothing; two `prepare` calls for one id call `fetchSubtitles` once; after an error a new `prepare` runs again; translation failure still stores the video with a `note` saying why; `status` of an unknown id is `idle`; published topics include `dictation:<id>` at each step.
- [ ] **Step 2: Run** `npx vitest run server/dictation` → FAIL.
- [ ] **Step 3: Implement.** `youtube.ts`: one `yt-dlp` call with `--skip-download --no-playlist --write-subs --write-auto-subs --sub-langs "en.*,vi" --sub-format json3 --dump-single-json -o <tmpDir>/%(id)s.%(ext)s` (verify the flags against `yt-dlp --help` once it is installed; the tests pin only the behaviour), then read the json3 files, delete the temp files. `translate.ts`: `claude -p --output-format json` with the prompt on stdin and tools disabled (verify the exact flags with `claude --help`); read the `result` field and parse the array. `service.ts`: an in-memory map of running jobs and last errors; the job runs subtitles, then `buildSentences` (and `viJson3` matching by time overlap), then translation for sentences still lacking Vietnamese, then `saveVideo`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: dictation preparation job with yt-dlp subtitles and Claude CLI translation`

---

### Task 5: Procedures, server wiring and tool settings

**Files:**

- Create: `server/procedures/dictation.ts`
- Modify: `server/procedures/index.ts`, `server/procedures/support.ts` (Ctx gains `dictation: DictationService`), `server/http.ts` (AppDeps gains `dictation?: DictationService`, passed into the handler context), `server/config.ts`, `server/main.ts`, `server/cli.ts`, `scripts/lib/stable.mjs`, `scripts/stable-start.mjs`, `scripts/stable-launchd.mjs` if it lists arguments, `docs/stable-deploy.md`
- Test: `server/procedures/dictation.test.ts`, `server/config.test.ts`, `scripts/stable.test.ts` (extend), `server/procedures/registry.test.ts` (must pass)

**Interfaces:**

- Consumes: Tasks 1, 3, 4.
- Produces: handlers for the six `dictation.*` names (ids validated with `isVideoId`, else `BAD_REQUEST`); `Config` gains `tools: { ytDlp: string; claude: string }` (defaults `'yt-dlp'` and `'claude'`, flags `--yt-dlp <path>` and `--claude <path>`, environment `QWERTY_YT_DLP` and `QWERTY_CLAUDE`); `parseStableConfig` accepts optional `ytDlpPath` and `claudePath` (absolute or `~/…`) and returns them; `stable-start.mjs` and the plist pass them as `--yt-dlp` and `--claude` when set.

- [ ] **Step 1: Write the failing tests.** `dictation.test.ts` (db plus a fake service): `dictation.prepare` with `'../etc'` → `BAD_REQUEST` and the fake is not called; `prepare` returns the service's status; `dictation.get` of an uncached id → `null`; `saveProgress` for a cached video then `get` shows it; `saveProgress` for an unknown id → `NOT_FOUND`; `dictation.videos` lists cached videos; `dictation.remove` deletes. `config.test.ts`: defaults, the two flags, the two environment variables, a flag overrides the environment. `stable.test.ts`: `ytDlpPath: '~/bin/yt-dlp'` expands to the home folder; a relative path throws; the plist arguments contain `--yt-dlp` and the path only when set.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** `main.ts` builds the service with `runTool`, the config's tools and `app.publish` (the service is created after the app, so `createApp` receives a lazy `publish`); the handler context becomes `{ db, now, dictation }`; tests that build contexts by hand add a fake service.
- [ ] **Step 4: Run** `npx vitest run server scripts` → PASS; then `yarn server:build` and start the bundle in a temp data folder: `curl -X POST localhost:<port>/api/rpc/dictation.status -d '{"args":["dQw4w9WgXcQ"]}'` returns `{"result":{"state":"idle"}}`.
- [ ] **Step 5: Commit** `feat: dictation procedures, wiring and tool path settings`

---

### Task 6: Generic typing session and dictation items

**Files:**

- Modify: `src/utils/sentences/session.ts` (generic over the item type, default `SentenceItem`)
- Create: `src/utils/dictation/items.ts`, `src/utils/dictation/session.ts`
- Test: `src/utils/sentences/session.test.ts` (must still pass unchanged), `src/utils/dictation/{items,session}.test.ts`

**Interfaces:**

- Produces (`sentences/session.ts`): `SentenceSession<T extends { text: string } = SentenceItem>`, with `createSession`, `currentItem`, `typeKey`, `peekSentence`, `advance`, `summarize`, `retryItems` typed over `T`; `SentenceResult<T>`, `SentenceSummary<T>`.
- Produces (`items.ts`): `export type DictationItem = { text: string; index: number; start: number; end: number; en: string; vi?: string; viSource?: 'youtube' | 'ai' }` and `toItems(sentences: DictationSentence[], from = 0): DictationItem[]` (`text = dictationText(en)`, sentences whose text is `null` are skipped; `index` is the position in the original list; `from` skips earlier sentences).
- Produces (`session.ts`): `typeDictationKey(s: SentenceSession<DictationItem>, key: string, now: number): SentenceSession<DictationItem>` — lowercases a single letter key, then `typeKey`.

- [ ] **Step 1: Write the failing tests.** Existing sentence tests unchanged and green; `items.test.ts`: `toItems` keeps order, skips a non-ASCII sentence, `from: 2` starts at the third original sentence and keeps original `index` values; `session.test.ts`: typing `'D'` when `'d'` is expected advances; `'x'` is rejected and counts a wrong key; a full sentence plus `advance` records the result; `retryItems` returns the items with mistakes.
- [ ] **Step 2: Run** → FAIL (generic types missing).
- [ ] **Step 3: Implement** the generic types (no behaviour change for `SentenceItem`), `toItems`, `typeDictationKey`.
- [ ] **Step 4: Run** `npx vitest run src/utils` → PASS; `npx tsc --noEmit -p .` clean except the pre-existing errors.
- [ ] **Step 5: Commit** `refactor: make the typing session generic and add dictation items`

---

### Task 7: The YouTube player hook

**Files:**

- Create: `src/pages/Dictation/useYouTubePlayer.ts`, `src/pages/Dictation/segment.ts`
- Test: `src/pages/Dictation/segment.test.ts`

**Interfaces:**

- Produces (`segment.ts`, pure): `segmentWindow(start: number, end: number): { from: number; to: number }` (lead-in and tail of 0.3 s, `from` not below 0), `shouldStop(currentTime: number, to: number): boolean` (true once `currentTime >= to`).
- Produces (`useYouTubePlayer.ts`): `useYouTubePlayer(videoId: string, onSegmentEnd: () => void): { containerRef: RefObject<HTMLDivElement>; state: 'loading' | 'ready' | 'blocked' | 'error'; playSegment(start: number, end: number): void; pause(): void }`. Loads `https://www.youtube.com/iframe_api` once per page (a shared promise), creates the player in `containerRef` at speed 1 with modest controls, polls `getCurrentTime()` every 100 ms while a segment plays and pauses at `to`, calls `onSegmentEnd`, and reports `blocked` when the player raises error 101 or 150 (embedding disabled) and `error` when the API cannot load (offline).

- [ ] **Step 1: Write the failing tests** for `segmentWindow` (`(0.1, 2)` → `{ from: 0, to: 2.3 }`; `(10, 12)` → `{ from: 9.7, to: 12.3 }`) and `shouldStop` (below, at and above `to`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the two pure functions and the hook; the hook needs no unit test (the player needs the network, verified in Task 10).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: YouTube player hook with segment playback`

---

### Task 8: Dictation pages

**Files:**

- Create: `src/pages/Dictation/index.tsx`, `Setup.tsx`, `Run.tsx`, `Result.tsx`
- Modify: none outside the folder (the typing line is reused as it is)

**Interfaces:**

- Consumes: Tasks 1, 5, 6, 7; `call` from `@/data/rpc`; `useLive` from `@/data/useLive`; `TypingLine` and `ModeFrame`/`ScrollCenter` as used by `src/pages/Sentences`; `summarize`, `retryItems`, `advance`, `peekSentence`, `createSession`, `isComplete` from the generic session.
- Produces: `export default function DictationPage()` handling `/dictation` and `/dictation/:videoId` (setup, then run, then result, as `src/pages/Sentences/index.tsx` does).

- [ ] **Step 1: `Setup.tsx`** — a link field (`parseVideoId`; an invalid link shows "That is not a YouTube link" and starts nothing), the built-in list read from `/dictation/videos.json` grouped by category, and the prepared videos from `useLive(() => call('dictation.videos'), ['dictation'], [])` with "N of M sentences" progress. Choosing a video calls `dictation.prepare` and shows the status (`useLive` on `dictation.status` with topic `dictation:<id>`), with a retry button on `error` showing the error's message; when the tool is missing the message includes `brew install yt-dlp`.
- [ ] **Step 2: `Run.tsx`** — the player on top (`useYouTubePlayer`), `TypingLine` below with `target={{ start: 0, end: item.text.length }}` and `masked={!session.turn.peeked}`, the Vietnamese under it with a small mark when `viSource` is `ai` or `youtube`, Replay and Peek and Exit buttons, the same key listener and 400 ms advance as `src/pages/Sentences/Run.tsx` using `typeDictationKey`, playing each sentence when its turn starts, and `dictation.saveProgress` after each sentence (and `finished: true` at the end). A `blocked` or `error` player state shows its message and a back button.
- [ ] **Step 3: `Result.tsx`** — the same numbers and lists as `src/pages/Sentences/Result.tsx` (accuracy, wpm, time, sentences done, the missed sentences worst first with "and N more"), showing `item.en` for each missed sentence; actions "Practise mistakes", "Replay the video", "Back to setup".
- [ ] **Step 4: `index.tsx`** — owns the screen state; resumes from `video.progress.position` through `toItems(sentences, position)` when the video has unfinished progress (a "Start over" button uses position 0).
- [ ] **Step 5: Verify** `npx tsc --noEmit -p .` and `npx eslint src/pages/Dictation --fix` are clean; `npx vitest run` still passes. The screens are checked in the browser in Task 10.
- [ ] **Step 6: Commit** `feat: dictation setup, run and result screens`

---

### Task 9: Route, navigation, built-in list and docs

**Files:**

- Modify: `src/index.tsx` (lazy `DictationPage`, routes `/dictation` and `/dictation/:videoId`), `src/components/AppShell/navItems.ts` (`id: 'dictation'` after `sentences`, `tab: false`, added to `MORE_LINKS` too), `src/components/AppShell/index.tsx` (icon for `'dictation'`), `docs/stable-deploy.md` (a "Dictation" section: install `yt-dlp`, the `claude` CLI, `ytDlpPath` and `claudePath` in the stable settings, why launchd needs them)
- Create: `public/dictation/videos.json`
- Test: `src/components/AppShell/navItems.test.ts` (extend)

**Interfaces:**

- Produces: `public/dictation/videos.json` = `{ id: string; title: string; channel: string; category: string }[]`, initially four TED talks as placeholders to be verified by the learner in Task 10: `qp0HIF3SfI4` (Simon Sinek, "How great leaders inspire action"), `iG9CE55wbtY` (Ken Robinson, "Do schools kill creativity?"), `eIho2S0ZahI` (Julian Treasure, "How to speak so that people want to listen"), `iCvmsMzlF7o` (Brené Brown, "The power of vulnerability"), category `Talks`.

- [ ] **Step 1: Write the failing test** in `navItems.test.ts`: the ids list now contains `'dictation'` after `'sentences'`; `byId('dictation').to` is `'/dictation'`; `isNavActive` is true for `/dictation/dQw4w9WgXcQ`; `MORE_LINKS` contains Dictation.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** the route, nav item (the existing `sentences` icon is reused for `'dictation'` unless a distinct one already exists in the icon set), the list file and the docs. **Step 4: Run** the whole suite → PASS.
- [ ] **Step 5: Commit** `feat: dictation route, navigation entry, starter video list and docs`

---

### Task 10: Verification in the browser, then the learner's video list

**Files:** none new. Fixes found here are committed with the test that pins them.

- [ ] **Step 1: Seed a fixture video** into a throwaway data folder (`yarn dev:full`, data in `./.dev-data`): insert one `video_cache` row with 8 hand-written sentences for a real, short, embeddable video id, using the `sqlite3` CLI; no network tool is needed.
- [ ] **Step 2: Walk the run** in the browser: the setup lists the video with 0 of 8; opening it plays sentence 1 and stops at its end; Replay replays it; typing fills blanks, a wrong key flashes and is rejected, Peek reveals and counts a mistake; the last character advances after about 400 ms and plays sentence 2; reload mid-run resumes at the saved sentence; the result screen shows the numbers; "Practise mistakes" replays only the missed segments; an embed-blocked id shows the blocked message; going offline shows the error state.
- [ ] **Step 3: Failure paths** with the real tools absent: pasting a new link shows "yt-dlp is not installed" with the install command; garbage pasted in the field is refused and starts nothing.
- [ ] **Step 4: With the learner:** after `brew install yt-dlp`, prepare each of the four starter videos once, confirm it has subtitles and plays, record which kind (manual or auto) and whether the Vietnamese came from YouTube or the CLI, remove or replace any that fail, and add the learner's own picks (films, humor) to `public/dictation/videos.json`. Run `yarn stable:update` only after the learner approves.
- [ ] **Step 5: Commit** `fix: …` for anything found, and `feat: starter dictation videos verified with the learner` for the list.
