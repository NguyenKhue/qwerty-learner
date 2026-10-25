# Video dictation: listen to a YouTube video, type each sentence

Date: 2026-10-24 · Branch: `feat/video-dictation` (from `feat/study-modes`) · Status: draft for the learner's approval

## Why

The learner trains typing and vocabulary, but not listening. Dictation joins the two: hear one real sentence from a video, type what was heard. The learner wants to practise with films, humor and talks they actually like, not with a fixed word list. Success: the learner pastes a YouTube link (or picks one from a short built-in list), and can work through the video sentence by sentence, in the same typing feel as Sentences mode, and come back another day to the sentence where they stopped.

The app is for local personal use only (no hosting, no commercial use).

## What it is

A new mode, a page at `/dictation`, built like Sentences: a setup screen, a run screen, a result screen. It is a separate mode, not part of Typing or Sentences.

### Choosing a video (setup screen)

- A field to paste a YouTube link (watch, `youtu.be`, shorts and embed forms all accepted; only the 11-character video id is used).
- A short built-in list grouped by category (films, humor, talks, interviews). Each item: title, channel, category. It stores links only, never subtitles or video.
- Videos already prepared are shown first, with progress (for example "42 of 180 sentences").
- Opening a video that is not prepared yet shows a clear progress state ("Fetching subtitles", "Splitting sentences", "Translating") and then opens the run. It never freezes silently.

### Run screen: one sentence per turn

- The YouTube player is on top (embedded, speed 1×, the normal YouTube controls hidden or reduced as far as the player allows).
- Only the current sentence is played: from its start to its end (with about 0.3 s of lead-in and tail), then the player pauses. A "Replay" button plays the same segment again, without limit.
- Under the video: the sentence as **blank placeholders**, one per character to type, with spaces and apostrophes visible. The sentence text is never shown while listening. Under the blanks: the Vietnamese translation as a hint.
- Typing feels exactly like Sentences mode: a correct character is filled in, a wrong key flashes and is rejected (no Backspace; the learner retypes the right key). Typing the last character moves to the next sentence after a short pause (about 400 ms) and plays it.
- "Peek" reveals the English sentence for the rest of that turn and counts as one mistake (as in Sentences mode).
- Progress shown: "3 / 180", running accuracy, running speed. Exit leaves the run; progress is kept.
- Keys: the same rules as Sentences (letters, digits, space, apostrophe type; Esc and the Exit button leave; modifier keys are ignored; Tab keeps moving focus so Replay and Peek are ordinary buttons).

### Matching is lenient (the author's call)

What is heard has no punctuation or capital letters, and auto-generated English subtitles have none either. So typed and expected characters are compared after both are lowercased and stripped of punctuation, except the apostrophe (curly `’` and straight `'` are equal, as in Sentences). The blanks therefore cover letters, digits, spaces and apostrophes only. A sentence is playable only if, after this normalisation, everything is printable ASCII.

### Result screen

Like Sentences: speed (words per minute, a word is 5 characters), accuracy, time, sentences done; the sentences with mistakes or a peek, worst first, at most 50 with "and N more"; actions "Practise mistakes" (a run of only those sentences, replaying their segments), "Replay the video" (start again from sentence 1), "Back to setup".

## Where the sentences come from

### Subtitles

The data server runs `yt-dlp` as a child process (arguments passed as an array, never through a shell) to fetch the English subtitles with timestamps, in a format that carries word or line timing. A manual English track is preferred; the auto-generated English track is accepted and the sentence list is marked "auto subtitles" so the learner knows the text may contain errors. No video or audio is ever downloaded.

### Making sentences

Subtitles arrive as short overlapping lines (auto-generated ones repeat text). The builder produces sentences like this:

- remove duplicate overlapping text, sound tags such as `[Music]` and `[Applause]`, and speaker marks;
- join lines and split at terminal punctuation when the track has it; when it has not, split at pauses of more than about 0.7 s, and never let a sentence pass about 25 words or 10 s;
- drop sentences shorter than 3 words or longer than 200 characters after normalisation, and sentences that are not playable;
- each sentence keeps its start and end time in seconds.

### Vietnamese translation

1. If YouTube offers an auto-translated Vietnamese track for the video, fetch it with `yt-dlp` and match each translated line to the sentences by time overlap.
2. For any sentence still without Vietnamese (or the whole video when there is no track), the server calls the **Claude CLI** (`claude -p`, non-interactive, no tools, JSON output) in batches of about 40 sentences, asking for a natural Vietnamese translation per sentence and nothing else.
3. Each sentence records where its translation came from (`youtube`, `ai`, or none), and the run screen shows a small mark for AI or machine translations.
4. If the CLI is missing or fails, the video still opens, with the sentences that have no Vietnamese shown without a hint, and a message says why.

### Cache

Everything prepared for a video is saved once in the data folder (the same SQLite database as the rest of the data): title, channel, duration, subtitle kind (manual or auto), and the sentence list with times, English, Vietnamese and translation source. Opening the same video again needs no network for the text, no `yt-dlp` and no CLI call. The learner's progress per video (current sentence, correct and wrong counts, finished flag, last opened) is stored in the same place, so it is backed up with the rest and travels with the database-file export and import (the JSON export does not carry it: the text can be prepared again, only progress would be lost). The database schema moves forward by one additive version; an older server never sees the new tables (the existing newer-schema refusal covers it).

## Constraints

- **Structure follows the app:** `src/pages/Dictation/{index.tsx, Setup.tsx, Run.tsx, Result.tsx}`, pure logic in `src/utils/dictation/` (sentence building, normalisation, caption parsing, turn state) with unit tests like `src/utils/sentences/`, a lazy route in `src/index.tsx`, a nav item in `src/components/AppShell/navItems.ts` (desktop sidebar and the "More" sheet, not the bottom tab bar), the built-in list in `public/dictation/videos.json`. The typing line and the turn state machine of Sentences mode are reused where they fit, not copied.
- **Server side:** new procedures in `src/data/contract.ts` and `server/procedures/` (list videos, get one, start preparing one, read its status, save progress), a repository for the two new tables, a job runner for preparing a video with progress announced over the existing live-update topics. Preparing runs in the background and survives the page being reloaded. Two preparations of the same video at once share one job.
- **Process safety:** the video id must match `^[A-Za-z0-9_-]{11}$` before it reaches any command; a child process has a time limit (about 60 s for `yt-dlp`, about 120 s per translation batch) and is killed when it is exceeded; its output size is capped; the translation prompt carries the subtitle text as data and the result is validated (a JSON array with one string per sentence, same length) before being stored.
- **Where the tools live:** the stable server is started by launchd, which has a minimal `PATH`. The tool paths are therefore settings (`ytDlpPath` and `claudePath` in the stable settings file, and environment variables for the dev server), with a lookup on the normal `PATH` as the fallback. The setup screen shows a clear message when a tool is missing, with the command to install `yt-dlp` (`brew install yt-dlp`). `yt-dlp` is **not installed on this machine today**; the learner installs it. The `claude` CLI is installed (2.1.304).
- **Player:** the YouTube IFrame Player API is loaded from `https://www.youtube.com/iframe_api` (an allowed, documented way to embed). A video that blocks embedding shows a message and cannot be started. Segment end is detected by polling the player time (about every 100 ms) and pausing; a precision of about 0.2 s is accepted.
- **Tests:** Vitest, jsdom, files next to the code; nothing in a test touches the network, `yt-dlp` or the real CLI (both are replaced by fakes that return fixtures). UI is checked in the browser by hand, with a cached fixture video, since the player needs the network.
- Code style: no semicolons, single quotes, 2-space indent, 140 columns, shadcn/Tailwind tokens only, no new colours. No new runtime dependencies unless the builder can show one is needed.

## Goals, non-goals, anti-goals

**Goals:** feels like Sentences mode; a video, once prepared, opens instantly and works offline for its text; the learner can stop and continue; a clear message for every failure (tool missing, no subtitles, embed blocked, offline).

**Non-goals (first version):** playback speed other than 1×; saving missed words to the vocabulary; flashcards or SRS writes; editing a sentence; sharing or exporting a video's text; downloading video or audio; serving the cached text to anyone but the learner.

**Anti-goals (failure even if it technically works):** a sentence that cannot be finished because of a character the keyboard cannot type; a preparation that hangs forever or blocks the server for other requests; shipping copyrighted subtitles or video in the repository; the typing feel differing from Sentences mode; breaking the existing modes or the learner's data (progress, flashcards, review log are never touched).

## Decided by the learner

Local personal use only · separate mode with the typing feel of Sentences · the video plays on top, the sentence under it as blanks only, Vietnamese as a hint under the blanks · one sentence at a time, next one plays when the last character is typed · a pasted link, plus a built-in list (films, humor, talks and the like) · English auto-generated subtitles are acceptable · the Vietnamese comes from YouTube when offered, else from the Claude CLI · everything prepared for a video is cached in the data folder · first version: 1× speed, Vietnamese shown under the sentence.

## The author's calls (to check while reading)

- Lenient matching (case and punctuation ignored) instead of the exact matching of Sentences, because dictation has nothing to tell punctuation from.
- Sentences are split by pauses and length when the subtitles have no punctuation, with the limits written above.
- The cache and progress live in the main database as two new tables, not in a separate file.
- Tool paths are settings, because launchd has a minimal `PATH`.
- The built-in list holds about 20 videos chosen later with the learner, and each is checked for subtitles and embedding once `yt-dlp` is installed; the builder only builds the list mechanism and a few placeholder entries.

## Left to the builder

File and component names inside the structure above · the layout and animation of the player, blanks and result · how the preparation job reports progress · the exact subtitle format requested from `yt-dlp` (json3 or vtt) and how it is parsed · the exact CLI flags and prompt for the translation · how the sentence limits are tuned against real fixtures · the copy of every message.
