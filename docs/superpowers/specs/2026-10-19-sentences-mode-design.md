# Sentences mode: typing a whole example sentence

Date: 2026-10-19 · Branch base: `feat/example-sentences` (example sentences data layer already merged there)

## Why

The app trains single words by typing and by flashcards. A word learned alone is easy to forget how to use: the verb that goes with it, the preposition, the word order. Words already carry example sentences (`Word.examples: { text, trans? }[]`, 525 words / 1,166 sentences in My Vocabulary). The learner wants to type those sentences, so the word is practised in context and the fingers learn the collocations.

Success: the learner can pick a set, type through a short run of its example sentences in either "copy" or "from memory" style, and see how well it went, without leaving the app's existing look and feel.

## What it is

A new mode, a page at `/sentences`, built like Quiz and Match: setup screen, run screen, result screen. It is not part of the Typing page (that page is built around single words, chapters, dictation and its own stores).

### Where the sentences come from

- All example sentences of the words of the current set, flattened to a pool of `{ word, text, trans }`.
- Custom sets (My Sets) already hold `examples` on their words. Built-in sets get theirs from the extras sidecar (`extrasUrl`, see `src/utils/detail/sidecar.ts`); the shared word-loading hook (`useDictionaryWords`) does not attach extras today, so the mode must.
- A set whose pool is empty shows a clear message on the setup screen ("This set has no example sentences") and cannot be started.
- A sentence whose `text` is empty/whitespace is never used.

### Setup screen

- Shows the set name and how many sentences can be played (see "What goes into the pool"). When "Hide sentence" is on, the count is of playable sentences that have a translation, so the number matches what a run will use.
- Run length: 10 / 20 / all (same options as Quiz), remembered like the quiz length. Default 10. If the pool is smaller than the chosen length, the run uses the whole pool.
- Start button. The "hide the sentence" choice (below) is also a remembered setting and can be changed here and during the run.

### Run screen: one sentence per turn

- The target word is highlighted inside the sentence; the Vietnamese translation (`trans`, when present) is shown under it.
- **Copy mode (default):** the English sentence is visible; the learner types over it, character by character. A correct character changes colour; a wrong key flashes red and is rejected (the learner retypes the right character), the same feel as the existing word typing.
- **From-memory mode (toggle "Hide sentence"):** the sentence text is hidden; the learner sees the translation and a row of blanks (one per typed character position, spaces and punctuation shown), and types the sentence. Typed correct characters appear in place. A "Peek" button reveals the sentence for the rest of that turn and counts as one mistake. If a sentence has no `trans`, hiding is not offered for that turn (copy mode is used).
- The toggle is switchable at any time; the current turn keeps its progress. If the toggle is on and a turn's sentence has no `trans`, that turn is shown in copy mode (the toggle stays on for the next turn).
- Matching rules: exact, case-sensitive, punctuation required; these pairs are treated as equal so a keyboard cannot block the learner: `’`/`'`, `‘`/`'`, `“`/`"`, `”`/`"`, `–`/`-`, `—`/`-`, and non-breaking space/space. Typing the last character moves on to the next sentence after a short pause (about 400 ms) so the final character is seen.
- Keys: letters, space, punctuation type; Backspace does nothing (wrong keys are never entered); Esc and the visible Exit button leave the run (with a confirm if progress exists; browser back leaves without a confirm). Tab is NOT used by the mode: it keeps moving focus, so the "Hide sentence" toggle and the Peek button are ordinary focusable buttons.
- Progress shown: "3 / 10", running accuracy, running speed.
- The mode ignores key presses while a modifier (Ctrl/Cmd/Alt) is held, so browser shortcuts keep working. The existing key sound setting is respected if it is cheap to reuse; not required.

### Result screen

- Speed (words per minute; a word = 5 characters), accuracy (correct keystrokes / all keystrokes), time, sentences completed.
- The sentences that had mistakes (or a peek), each with its mistake count.
- The mistakes list shows at most 50 sentences (worst first) and a line "and N more" for the rest.
- Actions: "Practise mistakes" (a run made only of those sentences), "Try again" (a new run from the pool), "Back to setup".

## Goals

- Feels like the other modes: same page frame, tokens, keyboard-friendly, works on a phone-width screen (a phone has a soft keyboard, so the run screen must keep the typing area visible; on touch devices an on-screen text input is acceptable).
- Pure logic (building the pool and the run, the matching rules, the per-turn state machine, the summary) lives outside React in `src/utils/sentences/` with unit tests, like `src/utils/quiz/`.
- Accessible: the sentence being typed is available to screen readers; focus is managed; colour is never the only signal for right/wrong.

## Non-goals (this version)

- No change to flashcard scheduling (SRS) and no card progress is written.
- No reading the sentence aloud (text-to-speech), no audio.
- No history, best scores or charts stored; the result screen is for the moment only.
- No editing of sentences from this mode (editing stays in My Sets).
- No new Dexie tables or schema change.

## Anti-goals (failure even if it technically works)

- Touching the learner's flashcard progress or review log.
- A run that dead-ends: a sentence the learner cannot finish because a punctuation or quote character cannot be typed on their keyboard.
- Slowing the app: the mode is lazy-loaded like the other pages, and a set with thousands of sentences must start instantly (the run is sampled, the pool is not rendered).
- Breaking the existing Typing page.

## Constraints

- Follow the existing structure: `src/pages/Sentences/{index.tsx, Setup.tsx, Run.tsx}` (names are the builder's call), `src/utils/sentences/`, `src/store/sentences.ts` for the remembered settings (jotai `atomWithStorage`, values sanitised before use as `quizLengthAtom` is), a lazy route in `src/index.tsx`, a nav item in `src/components/AppShell/navItems.ts`, and `'sentences'` added to the mode accepted by `SelectDictRedirect` with the matching `/sentences/:dictId` route.
- Nav: the item appears in the desktop sidebar and the "More" sheet; it is NOT added to the bottom tab bar (already full).
- Tests: Vitest, files next to the code, jsdom, only `src/**/*.test.ts` is collected (no component tests; UI is verified in the browser).
- Code style: no semicolons, single quotes, 2-space indent, 140 columns, shadcn/Tailwind tokens only (no new colours).
- No new dependencies.

## Decided by the learner

Separate mode (not inside Typing) · both copy and from-memory styles, copy is the default, a toggle hides the sentence · no SRS change · no text-to-speech · setup-run-result flow like Quiz · 10-sentence default · everything labelled _guess_ in the chat was confirmed as right ("ok đúng rồi").

## What goes into the pool, and how the target word is found (settled after the builder check; the author's calls, measured on My Vocabulary: 1,166 sentences)

- **Which set:** the same current set the Quiz and Flashcards use (`useCurrentDictId`; My Sets are ids like `custom:<id>`, built-ins are plain ids; `/sentences/:dictId` works through `SelectDictRedirect` exactly like `/quiz/:dictId`). There is no separate picker.
- **Shape of examples:** custom-set and sidecar examples are both `{ text, trans? }` (the sidecar loader already normalises them); no extra conversion is needed.
- **Playable sentence:** after trimming, `text` is non-empty, no longer than 200 characters (21 of 1,166 are over 150, the longest is 348: too long to be a typing exercise), and every character is printable ASCII once the equivalences below are applied (this drops the 32 sentences that have Vietnamese letters mixed into the English text and keeps those that only use an em dash or curly quotes).
- **Equivalences** apply to both sides: the expected character and the typed character are both mapped (`’ ‘` to `'`, `“ ”` to `"`, `– —` to `-`, non-breaking space to space), so a curly quote in the data accepts a straight quote typed, and the reverse. Any other character outside printable ASCII makes the sentence unplayable.
- **Highlighting the target word:** case-insensitive. First choice is a whole-word match of the headword; second choice is a word that starts with the headword (covers `enforce` in `enforcement`); if neither is found the sentence is shown without a highlight (never an error). Measured: 928 whole-word, 183 prefix, 31 none.
- **Peek** counts as exactly one mistake in the summary. **Sampling:** random, no repeats within a run; when the pool is smaller than the run length the whole pool is used once.
- **Touch devices:** best effort only: a visible text input that feeds the same logic; no IME/autocorrect handling and no mobile test beyond "the page works and does not break". Not a goal of this version.

## Left to the builder

Component and file names inside the structure above · exact visual layout and animation of the typing line and blanks · how the per-turn state machine is shaped · how sentences are sampled for a run (random, no repeats within a run; a word with several sentences may appear more than once only when the pool is smaller than the run length) · the touch-device input approach · whether to reuse the key-sound hook · copy of the messages.

## Revision: "Hide word" becomes the default mode (2026-10-19, decided by the learner)

Supersedes the copy / hide-sentence toggle described above. The run has three **modes**, chosen on the setup screen and switchable during a run (remembered):

- **Hide word (default):** the full sentence is shown, only the target word is masked (letters shown as `_`, the rest of the word such as `-` or spaces stays visible as in hidden mode). The translation is shown as the hint. The learner types the whole sentence: copies what is visible, recalls the masked word. Peek reveals the masked word and counts one mistake. A sentence is playable in this mode only if its target word was found (see below); the setup count reflects that.
- **Copy:** the sentence is fully visible (the earlier default).
- **Hide sentence:** only the translation is shown (the earlier toggle). Needs a translation.

Not in this revision: any write to the flashcard schedule (SRS) stays out; the other modes are unchanged apart from the setting becoming a three-way choice.

### Finding the target word (replaces the earlier rule)

`findTarget` tries, in order, each case-insensitive and starting at a word boundary: (1) the whole headword as a standalone word; (2) the headword's tokens (split on spaces and hyphens, so `cross cutting` finds `cross-cutting` and `consist of` finds `consists of`), each token allowed to carry a tail of letters/digits (`fine-tune` finds `fine-tuned`); (3) for a one-token headword of at least 5 letters ending in `e` or `y`, the headword without that last letter plus a tail (`embody` finds `embodies`, `evolve` finds `evolving`). The range covers the whole matched span. No match returns null (the sentence is then not used in Hide word mode).

### Data fixes done together with this revision

- The 21 sentences of My Vocabulary whose translation was glued to the English text (a comment `— ...` follows the closing parenthesis) are repaired by making the detail extractor ignore that comment.
- 33 words that had no usable sentence got new example sentences with Vietnamese translations (30 had none at all; `specification` had sentences that belong to another word; `take an approach` and `regulatory landscapes` had none containing the exact phrase).
- The sidecar backfill of already created sets becomes versioned and merges: sentences not yet in a word are added (the learner's own sentences are kept, duplicates are dropped), once per version.
- Not touched, reported to the learner: four headwords look misspelled in the learner's own data (`disclamer`, `reponsive`, `widepread`, `accommplish`), so their sentences cannot be matched until those words are corrected.

