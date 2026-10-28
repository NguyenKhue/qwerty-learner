# MCP server for qwerty-learner (dictation first)

## Why

Dictation builds a video's sentences from YouTube subtitles. For songs these are usually auto captions, and they get words
wrong ("i love you foreign"). There is no way to fix a sentence today except deleting the video. The learner wants AI agents
(Claude Code and others) to work on the web's data through MCP, starting with fixing a video's script.

## Goals

- Agents can list, read and fix a dictation video's sentences: edit text and times, merge, split, delete, retranslate, refetch.
- The learner can drop the correct lyrics of a song into a text file and have the server line them up with the video's
  timing. **The lyrics go from the file to the server and never through the agent**: the import returns numbers only (index,
  times, match score), never sentence text.
- Every other data procedure of the server stays reachable through one generic tool.

## Non-goals

- No edit UI in the web app in this change (the RPCs below are what a later edit button will call).
- No word-level re-timing from audio; times come from the existing sentence times.
- No history/undo table: `refetch` (prepare again from YouTube, keeping progress) is the way back.

## Anti-goals

- The import tool's reply or logs containing lyric text.
- Writing anything to stdout in the MCP process other than protocol messages (it breaks stdio MCP).
- New npm dependencies.

## Server side

### Shared: `src/utils/dictation/lyrics.ts` (pure, tested in `lyrics.test.ts`)

- `parseLyricLines(text): string[]`: one entry per line; strips LRC tags at the start of a line (`[00:12.34]`, `[ar:...]`,
  repeated tags), trims; drops empty lines, section markers wholly in brackets/parentheses (`[Chorus]`, `(x2)`) and lines for
  which `dictationText` (`./normalize`) is null.
- `alignLines(sentences, lines): { sentences: DictationSentence[]; report: AlignReport }`:
  - Caption tokens: every word of every current sentence (tokens of `dictationText(en)`), each given a time interpolated
    linearly inside its sentence by character offset; a token's end is the next token's time in the same sentence, or the
    sentence end.
  - Line tokens: the tokens of `dictationText(line)`.
  - Align the two token sequences with an LCS / edit-distance DP (equal tokens match). Refuse (throw) when
    `captionTokens * lineTokens > 4_000_000`.
  - A line with matches: start = its first matched token's time, end = its last matched token's end.
  - Consecutive lines without matches share evenly the gap between the previous line's end (or the first sentence start) and
    the next line's start (or the last sentence end).
  - Make the result monotonic: start >= previous end, end >= start + 0.3 s where room allows, end <= next start.
  - New sentences are `{ start, end, en: line }` (no `vi`, no `viSource`), times rounded to 0.01 s.
  - Throw when no line matched at all (wrong file for this video).
  - `AlignReport = { lineCount, previousSentenceCount, matchedLineCount, lines: { index, start, end, score }[],
    lowConfidence: number[], unmatchedCaptionWords: number }`; `score` = matched tokens / line tokens (0..1, 2 decimals),
    `lowConfidence` = indices with score < 0.5. No text anywhere in the report.

### Repo `server/repo/videos.ts`

- `replaceSentences(db, id, sentences, note: string | null)`: updates only `sentences` and `note`; clamps `video_progress.position` to
  `sentences.length` and clears `finished` when the position moved. Throws when the video is not cached.

### Service `server/dictation/service.ts`

- `prepare(id, opts?: { refetch?: boolean })`: with `refetch`, a cached video is prepared again from YouTube (edits are
  replaced, progress kept — `saveVideo` already keeps it).
- `retranslate(id): DictationStatus`: when not running and cached, translates in the background (step `translating`) every
  sentence without `vi`, saves with `replaceSentences`, publishes `dictation` and `dictation:<id>`; sets the note as `prepare`
  does when some fail. Not cached → `{ state: 'idle' }`. Running → current status.

### Types

- `DictationSentence.viSource` gains `'manual'` (a Vietnamese line the learner or an agent wrote).

### Procedures (contract `src/data/contract.ts`, handlers `server/procedures/dictation.ts`, topics)

All take `videoId` first (validated as now). A video not cached → `NOT_FOUND`; a video being prepared → `CONFLICT`. Index
arguments are whole numbers inside the sentence list → else `BAD_REQUEST`. Every write returns what the agent needs and then
calls `retranslate` when a sentence lost its `vi`. Topics: `dictation` and `dictation:<id>` for every write below.

| Procedure | Args | Result |
|---|---|---|
| `dictation.importLines` | `lines: string[]` (1..2000, each a string ≤ 500 chars) | `AlignReport` |
| `dictation.editSentence` | `index`, `patch: { en?, vi?, start?, end? }` | the sentence |
| `dictation.mergeSentences` | `index` (merged with `index + 1`) | the merged sentence |
| `dictation.splitSentence` | `index`, `atWord` (1..words−1 of `en` split on spaces) | the two sentences |
| `dictation.deleteSentence` | `index` | `null` |
| `dictation.retranslate` | — | `DictationStatus` |
| `dictation.refetch` | — | `DictationStatus` |

- `editSentence`: `en` must give a non-null `dictationText`; a changed `en` drops `vi`/`viSource` unless `vi` is in the patch;
  `vi` given (non-empty string) sets `viSource: 'manual'`; `start`/`end` finite, `0 <= start < end`.
- `mergeSentences`: start of the first, end of the second, `en` joined with a space; must pass `dictationText`; `vi` dropped.
- `splitSentence`: the time is split in proportion to the characters of the two parts; both parts drop `vi`.
- `deleteSentence`: refuses to delete the last sentence (`BAD_REQUEST`).

## MCP server: `server/mcp/`

- Hand-written MCP over stdio (newline-delimited JSON-RPC 2.0), no SDK: `initialize` (answers with the client's
  `protocolVersion` when it is one of `2025-06-18`, `2025-03-26`, `2024-11-05`, else `2025-06-18`; capabilities
  `{ tools: {} }`; `serverInfo { name: 'qwerty-learner', version }`; `instructions` text below), `ping`, `tools/list`,
  `tools/call`, notifications ignored, unknown method → `-32601`, bad params → `-32602`. Tool failures come back as
  `{ content: [{ type: 'text', text }], isError: true }`, not as JSON-RPC errors. Logs go to stderr only.
- It talks to the data server over HTTP: `POST <QWERTY_URL>/api/rpc/<name>` with `{ args }`; reply `{ result }` or an error
  body. `QWERTY_URL` defaults to `http://127.0.0.1:4173` (the stable server, the learner's real data).
- Tools (JSON Schema inputs, results as JSON text):
  - `list_videos`, `get_video { videoId }` (sentences with their index), `prepare_video { videoId, refetch? }`,
    `video_status { videoId }`
  - `import_lyrics_file { videoId, path }`: reads the file inside the MCP process (absolute path, or relative to the MCP
    process cwd; refuses files > 256 KB or not UTF-8 text), runs `parseLyricLines`, calls `dictation.importLines`, returns the
    report only. The tool description says the reply never contains the lyrics.
  - `edit_sentence`, `merge_sentences`, `split_sentence`, `delete_sentence`, `retranslate_video`
  - `call_procedure { name, args }`: any procedure in `PROCEDURE_NAMES` (enum in the schema), for the rest of the data.
- `instructions`: short guide: sentence indices change after merge/split/delete/import, so re-read with `get_video`; to fix
  a song use `import_lyrics_file` with a file the learner provides; `refetch` restores YouTube's version.
- Entry `server/mcp/cli.ts`; started for Claude Code through `.mcp.json` at the repo root:
  `node_modules/.bin/vite-node -c vitest.config.ts server/mcp/cli.ts` with `QWERTY_URL` in `env`.
- README: a short section on the MCP server, how to point it at dev (`http://127.0.0.1:5180`) and the lyrics-file flow.

## Left to the builder

Naming inside files, how the DP is written, exact wording of messages and tool descriptions.

# Part 2: tools for every other feature (2026-10-28)

The learner asked for dedicated tools for all features, not only `call_procedure`. These tools live in the MCP process and use
the existing procedures over HTTP, plus the repo files for what is not in the data server. No new server procedures.

## Where the data is

| Data | Where | Reached by |
|---|---|---|
| Built-in dictionaries (384 files) | `public/dicts/*.json`, registry `src/resources/dictionary.ts`, extras `public/dicts/*.extras.json` | repo files (MCP process) |
| The learner's own sets (`custom:<id>`) | data server `sets.*` | RPC |
| Flashcard schedule | `cards.*` | RPC |
| Typing history, chapter results, stats, activity, hard words | `words.*`, `chapters.*`, `stats.summary`, `activity.times`, `log.hardWordsSince` | RPC |
| Mistake-review sessions | `reviews.*` | RPC |
| Suggested dictation videos | `public/dictation-videos.json` | repo file |
| UI settings (dark mode, current dict...) | browser localStorage | **not reachable**: out of scope |

## Files

- `server/mcp/repoFiles.ts`: pure-ish helpers over a repo root (`QWERTY_REPO`, default `process.cwd()`):
  - `readRegistry(root)`: parses `src/resources/dictionary.ts` with regexes (it cannot be imported: it pulls browser code) into
    `{ id, name, description, category, tags, url, extrasUrl?, length, language }[]` (object literals with `id: '...'` …
    `url: '/dicts/...'`; skip the commented-out block).
  - `readDict(root, entry)` / `writeDict(root, entry, words)`: reads/writes `public<url>`; writes keep the file's own indent
    (detect from the first indented line, default 2) and its trailing newline, `JSON.stringify(words, null, indent)`; after a
    change of word count, updates `length: N` of that entry in `dictionary.ts` (same regex idea as `scripts/update-dict-size.js`,
    only for that file).
  - `readExtras` / `writeExtras` for `extrasUrl` (object word → `{ detail?, examples? }`), same formatting rules.
  - `readSuggestedVideos` / `writeSuggestedVideos` for `public/dictation-videos.json` (`{ id, title, channel, category }[]`;
    keep its one-object-per-line layout: `[\n  {...},\n  {...}\n]\n` with each object `JSON.stringify` on one line, spaces after
    `:` and `,` as in the file now: write it as `{ "id": "x", "title": "y", ... }`).
  - All writes: write to a temp file in the same folder, then rename.
- `server/mcp/library.ts`: dictionary and set tools (below), `createLibraryTools(rpc, repo)`.
- `server/mcp/study.ts`: flashcards, history, stats, reviews, backup tools, `createStudyTools(rpc, opts)`.
- `server/mcp/tools.ts`: keeps dictation + `call_procedure`; `INSTRUCTIONS` gets one more paragraph on dict ids and that built-in
  edits change repo files (seen at once by the dev server, by the stable app after `yarn stable:update`).
- `server/mcp/cli.ts`: registers all three families.
- Tests: `repoFiles.test.ts`, `library.test.ts`, `study.test.ts` (temp dirs with tiny invented dictionaries, fake `Rpc`).

## Dictionary ids

Every tool that takes `dict` accepts a built-in id (`cet4`), `custom:<id>`, or a dictionary/set **name** (case-insensitive exact
match; ambiguous → error listing the candidates). Replies always give the resolved id.

## Library tools (`library.ts`)

- `list_dictionaries { query?, category?, kind?: 'builtin'|'custom' }`: id, name, category, wordCount, language, kind,
  chapterCount (20 words per chapter, `CHAPTER_LENGTH`). Custom sets come from `sets.list`.
- `get_dictionary_words { dict, chapter? (1-based), offset?, limit? (default 50, max 500) }`: words with their index, name,
  trans, phones, and `hasDetail`/`exampleCount` (not the long detail text).
- `search_words { query, dict?, limit? (default 30) }`: case-insensitive match on `name` (prefix and substring, prefix first)
  and on `trans`; all built-in files (cached in memory per mtime) and custom sets; replies dict id, name, word, trans.
- `get_word { dict, word }`: the whole entry including detail and examples (from the extras file for built-ins that have one).
- `update_word { dict, word, patch: { name?, trans?, usphone?, ukphone?, notation?, detail?, examples? } }`: custom → `sets.get`
  + `sets.update`; built-in → file write (detail/examples go to the extras file when the dict has one, else inline). A rename
  of a custom-set word also calls `personal.fixNames` so history/cards follow it. Reply: the updated entry and where it was
  written.
- `add_words { dict, words: Word[] }` (refuses names already in the dict; returns added/skipped), `remove_words { dict, names }`.
- `create_set { name, description?, words? }`, `update_set_info { dict, name?, description? }`, `delete_set { dict }` (custom
  only; description warns it also deletes its study history), `copy_dictionary_to_set { dict, name? }` (built-in → new custom set
  with the same words merged with extras).
- `list_suggested_videos`, `add_suggested_video { id, title, channel, category }` (validates the id with `isVideoId`, refuses
  duplicates), `remove_suggested_video { id }`.

## Study tools (`study.ts`)

- `flashcard_overview { dict }`: counts new (words without a card), learning, review, due now, due today; plus the next 10 due.
  Needs the dict's word list (via the library's loader, injected) to count new words.
- `get_flashcards { dict, filter?: 'due'|'learning'|'review'|'all', limit? }`: per card word, state, due (ISO), interval, ease,
  reps, lapses, lastReviewed (ISO).
- `grade_flashcard { dict, word, grade: 'again'|'hard'|'good'|'easy' }` → `cards.review`; reply the new card with due ISO.
- `typing_stats`: `stats.summary` with ISO dates.
- `mistake_words { dict?, limit? }`: from `words.wrong` / `words.wrongByDict`, grouped by word+dict: total wrong, times typed,
  last typed (ISO), sorted by total wrong.
- `typing_history { from, to? }` (ISO dates or `YYYY-MM-DD`): `words.between` grouped per local day: words typed, mistakes,
  distinct words; `detail: true` also lists records (word, dict, chapter, time ISO, wrongCount), max 500.
- `chapter_results { dict, chapter? }`: chapter records with ISO time, accuracy %, wpm-ish (`wordCount / (time/60)`).
- `activity { days? (default 30) }`: `activity.times` per local day: reviews and typed minutes.
- `hard_words { dict, since? (default 7 days ago) }`.
- `forget_word_history { dict, word }` → `words.deleteByWord`.
- `mistake_review_progress { dict }` → `reviews.latestUnfinished` (index, word count, created ISO, finished).
- `backup_data { path }`: GET `<QWERTY_URL>/api/export/json` and write the gzip bytes to `path` (refuse an existing file).
  Instructions say: take one before bulk edits.

## Not in scope

UI settings in localStorage; `personal.migrate`/`personal.backfill` (one-off migrations; still under `call_procedure`).
