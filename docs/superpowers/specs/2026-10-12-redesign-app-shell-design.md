# App Redesign: Dashboard Home, Sidebar Shell, Design Tokens

Date: 2026-10-12
Status: draft for review
Builds on: `2026-10-12-study-modes-design.md` (P1–P4: custom sets, flashcards/SRS, quiz, match)

## 1. Intent

The app started as a typing tool ("Qwerty Learner") and now has five learning modes: Typing, Flashcards (SRS), Quiz, Match, and My Sets. The UI has not changed with it: one shared header, no home that says what to do next, the new modes reachable only through small links in the typing page, and only for custom sets.

Goal: make it obvious where to start, make switching modes easy, and make the app usable on desktop, tablet and phone.

What the user decided:

- Home is a **dashboard** (not a library, not the typing page).
- Visual feel is **calm and focused** (not playful, not dense).
- Navigation is a **left sidebar on desktop and a bottom tab bar on phones**.
- The app has **one current set**; every mode opens it. Study, Quiz and Match also work on built-in sets.
- Dashboard v1 has three blocks: Due today, Continue, Mode cards. Weekly activity and streak are a later phase.
- Phones are **supported**; only Typing needs a keyboard.

Success criteria:

1. A new visitor sees a clear primary action on `/` without scrolling at 1280×800 and at 375×812.
2. Any mode is one click or tap away from any page.
3. Every mode works on built-in and custom sets, or explains why it cannot (set too small).
4. Typing practice is no slower: same keyboard focus behavior, no extra renders per keystroke.
5. All existing logic tests still pass; light and dark mode both meet 4.5:1 text contrast.

Out of scope: weekly activity chart, streak, review-history table, sharing, accounts, renaming the product, translating more dictionary data.

## 2. Findings from the current code

- `src/index.tsx` redirects every route to `/mobile` at ≤ 600px width; `/mobile` is a separate 1,168-line page. A bottom tab bar can never show until this redirect changes.
- Pages wrap themselves in `components/Layout` and `components/Header` (14 files). The header is the same logo + icon card everywhere.
- Study/Quiz/Match routes take `:dictId`, and their entry links render only for custom sets (`DictChapterButton`).
- The current set already exists as `currentDictInfoAtom` (`src/store/index.ts`), resolved through `dictionaryByIdAtom`.
- `cardProgress` is keyed by `[dict+word]` strings, so built-in ids should work without a schema change. Task R3 verifies this with a test before the restriction is lifted.
- Tailwind has one custom color (`primary: '#6366f1'`) and no tokens. Dark mode is class-based (`darkMode: ['class']`). shadcn-style Radix components exist in `components/ui`.

## 3. Design tokens

CSS variables on `:root` and `.dark`, mapped in `tailwind.config.js`: `background`, `foreground`, `card`, `card-foreground`, `muted`, `muted-foreground`, `border`, `ring`, `primary`, `primary-foreground`, `accent` (green, for progress/correct), `accent-foreground`, `destructive`, `destructive-foreground`.

Light values (from the ui-ux-pro-max generator, adjusted): primary `#4F46E5`, accent `#16A34A`, background `#EEF2FF`, foreground `#312E81`, card `#FFFFFF`, muted `#EBEEF8`, muted-foreground `#475569`, border `#C7D2FE`, destructive `#DC2626`. Dark values are chosen in Task R1 and must keep text ≥ 4.5:1 and UI components ≥ 3:1.

Type: Inter for UI (Google Fonts, `display=swap`); the existing monospace stack stays for typing. Body 16px, line-height 1.5. Radius scale 8/12/16px. Shadows: one subtle card shadow, one raised.

Rules for all new UI: touch targets ≥ 44px; visible focus ring on every interactive element; no emoji as icons (use the icon set already in the project or lucide); `prefers-reduced-motion` disables non-essential transitions; transitions 150–250ms; no layout shift on hover.

## 4. AppShell

A layout route component `src/components/AppShell/` rendering `<Outlet />` for all app pages.

| Width      | Navigation                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| ≥ 1024px   | Full sidebar (≈ 240px): logo, set switcher, nav items, theme + settings at bottom                              |
| 768–1023px | Icon-only sidebar (≈ 72px) with tooltips                                                                       |
| < 768px    | Bottom tab bar: Home, Typing, Flashcards, Quiz, Match; "More" sheet for My Sets, Library, Error book, Settings |

Nav items: Home `/`, Typing `/typing`, Flashcards `/study`, Quiz `/quiz`, Match `/match`, My Sets `/my-sets`, Library `/gallery`. Active item uses `aria-current="page"`. The set switcher shows the current set name and word count and opens the Library.

On `/typing` the sidebar renders in its icon-only form regardless of width ≥ 768px so the typing area keeps its width. The existing in-page Typing controls (chapter picker, switchers, settings) stay inside the Typing page; only the outer header and footer move into the shell.

The footer content (links, donate) moves to a small block at the bottom of the sidebar and the "More" sheet.

## 5. Routes

| Route                                               | Page                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `/`                                                 | Dashboard (new)                                                  |
| `/typing`                                           | Typing (moved from `/`)                                          |
| `/study`, `/quiz`, `/match`                         | Modes, using the current set                                     |
| `/study/:dictId`, `/quiz/:dictId`, `/match/:dictId` | Redirect: set current set to `:dictId`, then go to `/study` etc. |
| `/gallery`                                          | Library: browse built-in and custom sets, "Use this set" action  |
| `/my-sets`, `/my-sets/:id`                          | Unchanged routes, new styling                                    |
| `/analysis`, `/error-book`, `/friend-links`         | Unchanged routes, rendered inside the shell                      |
| `/mobile`                                           | Redirect to `/`                                                  |

If the current set id no longer exists (deleted custom set), the app falls back to the default dictionary exactly as `shouldResetDictId` does today.

## 6. Dashboard (`/`)

Three blocks, from existing data only.

1. **Due today.** Counts from `cardProgress` plus the queue rules of the study modes: due cards, new cards available today (default 20/day cap). Primary button "Start review" opens `/study`. Empty states: "All caught up" (nothing due, new cards available: button "Learn new words"); "Nothing to study" (empty set).
2. **Continue.** Current set name, words seen / total word count as a progress bar, and a "Change set" button to `/gallery`.
3. **Mode cards.** Typing, Flashcards, Quiz, Match: icon, one-line description, state. Quiz and Match are disabled with a visible reason when the set is too small (rules from `utils/quiz` and `utils/match`). Match shows the best time from `matchBest:<dictId>` if present.

Counts are computed by a pure function `dashboardStats(progress, wordCount, now)` in `src/utils/dashboard/` so it can be unit-tested; the page reads progress through `useLiveQuery`.

## 7. Mode pages

Study, Quiz and Match keep their reducers, scheduling and tests unchanged. Changes:

- Remove their own `Layout`/`Header`; render inside the shell.
- Read the current set instead of `:dictId`.
- Restyle with tokens.
- Lift "custom sets only": `DictChapterButton` links and the guards in the pages. Prerequisite: a test that `reviewCard`/`reviewQuizAnswer`/`getDictProgress` work with a built-in id such as `cet4`, and that `useDictionaryWords` loads built-in words.

## 8. Phones

Remove the 600px redirect and the `/mobile` page content. At < 768px the bottom tab bar is used. `/typing` at < 768px (or on touch devices without a keyboard, detected by width only, no user-agent sniffing) shows a notice "Typing practice needs a physical keyboard" with links to the other modes; it does not mount the typing engine.

## 9. Testing and verification

- Existing suite stays green (`yarn test`), plus `tsc` and eslint no worse than the current baseline (6 warnings, 4 pre-existing tsc errors).
- New unit tests: `dashboardStats`, mode availability rules, old-route redirects, the built-in-id progress test from section 7.
- Browser verification at 375, 768 and 1280px width in light and dark mode, using the in-app browser: shell navigation, dashboard states (empty, due, all caught up), a mode page per breakpoint.
- Contrast checked for the token pairs listed in section 3.

## 10. Phases

- **R1** Tokens, Inter, Tailwind mapping, AppShell with sidebar/tab bar, route table and redirects, no page content changes.
- **R2** Dashboard and `dashboardStats`; current-set switcher; `/typing` move.
- **R3** Mode pages migrated, built-in sets enabled, tests from section 7.
- **R4** Library, My Sets, Error book, Analysis restyle; phone handling and `/mobile` removal; footer relocation.
- Later (separate spec): weekly activity and streak, which need a review-history table.

## 11. Risks

- Moving Typing off `/` breaks external links and bookmarks: mitigated by keeping `/` working (dashboard has a prominent Typing card) and by Playwright config check in R1.
- Typing page height assumes `h-screen` with its own header; the shell must not add scroll. Verified in R1/R2.
- Dark mode token pairs can fail contrast; verified in R1.
- Layout churn touches 14 files; mitigated by migrating page by page behind the shell.

## Findings: R1 (tokens and shell)

- Palette ruling: accent green darkened from `#16A34A` to `#15803D` so white text on it reaches 4.5:1. All token pairs are checked by `src/styles/tokens.test.ts`, which parses `src/index.css`.
- Vitest turns CSS imports into an empty string, so the token test reads the stylesheet with `fs`.
- The 600px redirect to `/mobile` moved into R1 (the tab bar could not be reached otherwise). `/mobile` now redirects to `/`; `src/pages/Mobile/` is still on disk for R4 to delete.
- Typing's word-list toggle was `fixed left-0` and sat on top of the sidebar; it is now `absolute` inside the shell's `main`.
- `Layout` is now a `div` (the shell owns the single `main`) and hides the footer below 768px until R4 moves the footer into the shell menu: the footer overflowed a 375px screen.
- `Suspense` sits inside the shell, so lazy pages no longer replace the sidebar with a spinner.
- The Library's language tab row is 1,671px wide and was already clipped before the shell; R4 restyles it.
- Dev console shows only the Youdao audio CORS errors (external, pre-existing).

## Findings: R2 (dashboard)

- `/` is now the Dashboard; Typing lives at `/typing` (a keyboard notice shows below 768px).
- The shell and the dashboard resolve the current set through `currentDictInfoAtom` (it falls back to CET-4), so an invalid stored id gives working links instead of `/study/<bad id>`.
- Verified in the browser: built-in set, a 3-word custom set (Quiz and Match disabled with the reason), an empty set (no Start button, 0% bar, no divide-by-zero), an invalid stored id, and a live update after grading a card (2 new, 1/3 studied, no reload). 375px dark mode has no horizontal scroll.
- Disabled mode cards no longer fade their text with opacity; the reason text keeps full contrast.
- A custom set that is still loading briefly shows CET-4 (existing behavior of `currentDictInfoAtom`); it corrects itself once the sets load.

## Findings: R3 (mode pages)

- `/study`, `/quiz` and `/match` read the current set. `/study/:dictId` (and quiz, match) now redirect: `classifyDictId` decides valid, pending (custom set still loading) or unknown; a valid id becomes the current set (chapter reset to 0) before continuing. Unknown ids, including names on `Object.prototype` such as `constructor`, go to the Library. This also fixed `shouldResetDictId`, which used `in` and accepted `constructor` as a known id.
- Built-in sets already worked: progress rows are keyed by a plain dictionary id. The new tests only document it (they passed on the first run).
- The Typing toolbar's Study/Quiz/Match links (custom sets only) were removed; the shell navigation replaces them.
- `Button` and the three modes use tokens now. Buttons are 44px tall by default (40px for `sm`); "Hard" uses `amber-700` with white text (5.0:1) because no warning token exists.
- Verified in the browser on CET-4: a Flashcards session (flip with Space, grade with 3, a progress row stored), a Quiz question (green correct, red wrong), a Match board at 375px in dark mode with no horizontal scroll. Test progress rows were deleted afterwards.

## Findings: R4 (library, my sets, about, cleanup)

- Places that sent people to `/` expecting the typing page now go to `/typing`: Library chapter picker, Mistake Review start/continue. My Sets lost its Study/Quiz/Match/Practice buttons (the dashboard has them) and has one `Open` action that makes the set current and opens the dashboard.
- The Library detail dialog has a "Use this set" button (sets the current set, chapter 0, leaves review mode, opens the dashboard).
- The footer moved to `/about` (reachable from the sidebar and the phone "More" sheet); `Layout` no longer renders it. Its icon links get 44px tap areas on that page.
- `src/pages/Mobile` and `src/assets/mobile` were deleted (`/mobile` redirects to `/` since R1).
- The Library grid was sized by viewport breakpoints, so it overflowed once the sidebar took 240px. It now uses `auto-fill` columns, wrapping tag and language rows, and no fixed side padding.
- `Panel` merges classes with `cn`, so `p-0` overrides its default padding.
- The set editor stacks each row on phones (labelled inputs) and keeps the table layout from 768px.
- Not restyled (they work in the shell with their old palette): Analysis, Error book, Friend links, the Library's card internals and dialog, the typing word panel and its toolbar buttons. These are the follow-up for a later pass, together with the weekly activity chart and streak.

## Findings: Opus review of R1-R4

Fixed after the review (each with a test that failed first where the logic is pure):

- Dashboard timer: `useNow` kept a past due time and re-armed every second. `useNow` now takes a stable `getDelay(now)`, and `dashboardRefreshDelay` (tested) always looks forward from the current time.
- `ModePage` used `justify-center` on a shorter-than-content column, which hid the top on short screens. It now uses the `my-auto` pattern inside a scroll container (checked at 667x320). Its Back button is 44px.
- The shell's lazy-page and pending-set fallback was the full-screen `Loading`; it is now an in-flow `InlineLoading`, so the navigation stays visible. The root `Loading` uses the background token.
- Library hotkey: `enter` removed (it blocked button activation), `esc` ignored while a dialog is open. Checked: Enter on "Use this set" works, Esc closes only the dialog.
- Study, Quiz and Match wait for a pending custom set (`useCurrentDictId`) instead of flashing CET-4.
- Back uses `canGoBack()` (history `idx`), which stays correct after a `replace` redirect.
- `100vh` fallback before `100dvh` (`.app-shell`), tapping a tab closes the More sheet, Analysis and Error book go back to `/typing`, `ErrorBook` uses `h-full`, the empty-set progressbar has `aria-valuemax` of at least 1, and the role-less `aria-disabled` was removed.

Deferred (minor): focus trap and `aria-modal` for the More sheet; a chapter in progress is lost when the window is resized below 768px; the old unrouted `src/pages/Gallery` folder is still on disk; the Typing toolbar, Analysis, Error book and Library card internals keep their old palette.

## Findings: R5 (remaining pages)

- The old look lived mostly in the shared classes of `src/index.css` (word chip, buttons, tooltip, switch, listbox, slider); they are rewritten on tokens by hand.
- The Typing page and its panels, `components/ui`, Drawer, Analysis, Error book, Friend links and the Library cards were converted with a mapping script that was checked against an examples table first (the examples are kept only in the scratchpad, not shipped). `dark:` pairs are removed because the tokens already adapt; `text-white` next to `bg-primary` became `text-primary-foreground`; the `neutral` palette used by the settings panel is covered too.
- A token-by-token comparison of old and new files showed no change outside class names, apart from the Analysis chart cards: their only background was a `dark:` class, so they now get `border border-border bg-card` in both themes.
- Checked in the browser: Typing, settings panel, word list drawer, Analysis, Error book, Friend links and the Library dialog in dark mode; the Library dialog, Analysis and Typing in light mode.
- Left on purpose: the typing letters' green and red, other status colors, the chart and illustration colors, the share-picture dialog, and the promotional popups and footer stickers.

## Findings: R5 follow-up

- The first R5 conversion script also "tidied" spaces next to quotes. That changed rendered text in 9 places (`'Chapter '`, `'a new '`, `'; '`, and several bare `' '` separators in the typing word panel and the error table). A whitespace-sensitive comparison of every string literal, which my first audit lacked, found them. The migration was redone from the pre-R5 files without the tidy-up step, and the same comparison now shows only class-name changes (plus the intended Analysis card and Error book edits).
- Error book: on a phone the table keeps a 38rem minimum width and scrolls sideways inside its own box; its header text uses `text-card-foreground` (it was `text-black` on a card, unreadable in dark mode).
- Added after the Opus review: focus trap and `aria-modal` for the More sheet (tested helper `nextFocusIndex`), typing stays mounted when the window shrinks (latched media query), and the unrouted `src/pages/Gallery` folder was deleted.

## Findings: R6 (weekly activity and streak)

- New Dexie table `reviewLog` (schema version 5, indexes `++id,at,dict`). `reviewCard` and `reviewQuizAnswer` add a row inside their existing transaction; a quiz answer that does not change the schedule writes nothing, and a failed card write leaves no row (tested).
- Typing activity comes from the existing `wordRecords` (`timeStamp` is epoch seconds). Reviews made before this table existed are not counted: the history cannot be recovered.
- `buildWeek` (7 local days, oldest first) and `computeStreak` are pure and tested, including 23:59 vs 00:01 and a streak that survives an empty today. The streak looks back up to 365 days. The DST test builds days from local calendar components; on a machine without DST (such as this one) it checks no day is skipped or repeated rather than a real transition.
- Dashboard: a "This week" card with stacked bars (cards reviewed in the primary color, words typed in the accent color), weekday labels, the streak, and an empty state. The bars are `aria-hidden`; a screen-reader list gives each day's numbers. It updates live (checked by inserting rows).
- Export and import: `db.export` includes the new table; `importDatabase` already sets `acceptMissingTables`, so older exports still import (they leave the log empty).
- Deleting a custom set removes its typing records, so those words leave the "typed" counts; its review log rows stay.

## Findings: Opus review of R5 and R6

The rendered text is intact (checked string by string against the pre-R5 files). Fixed after the review:

- Error book: the header, every row and both page counters still said `text-black` (1.3:1 on the dark card). They use `text-card-foreground` / `text-foreground`. The row detail popup no longer has a 26rem minimum width on a phone.
- `.my-btn-primary` carried `hover:bg-primary/90` in its component class, which beat every caller's own background on hover (grey Pause/Restart, orange Skip, the result screen buttons). It is back to `hover:opacity-90`.
- The selected Settings tab matched its tab list (`bg-muted` on `bg-muted`); it is `bg-card text-foreground` now. The typing progress bar is `primary/40`, `primary/70`, `primary` instead of one near-invisible shade. The dialog overlay is `bg-background/80` (it was a white veil in dark mode). The destructive Alert uses `text-destructive`. The export menu items get a visible hover and focus state.
- `ui/tabs`, `ui/toggle` and `ui/table` state classes use tokens; the Settings module CSS and the info-panel button lost their leftover slate/gray and opacity classes; the selected dictionary card uses `text-primary-foreground`; untyped letters in the second letter map are `text-foreground` again (they were near-white in dark mode before the restyle).
- `loadActivity` reads only the index keys (`keys()`), not whole word records. Tapping the More sheet backdrop returns focus to the More button. The week chart clips a stacked bar to its area.
- Not changed: the off-switch track contrast, the gray and indigo shadow classes in `StartButton` and `LoopWordSwitcher`, and the hue-only difference between correct/wrong/untyped letters (all as before the restyle).

## Findings: last restyle pass (delegated to opencode)

- Four batches went to opencode (`opencode/space-bunny-free`, each prompt listing the exact files, the token mapping, "class names only", "no build or test commands", "do not commit"): the footer and the promotional popups, the donation card and share dialog chrome, and two small batches of leftovers. Every run ended with exit 0.
- Each batch was audited here before it was accepted: a whitespace-sensitive comparison of every string literal against `HEAD`, a check that no code outside strings changed, then `tsc`, `eslint`, the test suite and a browser look at the donation dialog in dark mode. The comparison flagged only class-name changes.
- Judgment calls kept by hand: the share dialog's generated picture keeps its fixed colors (it is exported as an image); the dialog scrims use `bg-background/80`; the selected donation amount is `bg-primary/10` (opencode had made it equal to the hover color); the Pause button is `bg-muted-foreground`; gradients and brand/status colors (amber, WeChat green, RedNote red, Twitter blue) stay.
- Earlier items from the review: the switch off-track is `bg-muted-foreground` against a `bg-card` knob (a token pair test now covers its contrast); the typing shadows use `shadow-primary` and `shadow-muted-foreground`; wrong letters are underlined and the light-theme green is `green-700`, so a letter's state no longer depends on hue alone.
- Still on the old palette on purpose: `HandPositionIllustration` and the share picture.

The last leftover, the Library's "Find more dictionaries" button and link (`Gallery-N/DictRequest.tsx`), was also delegated to opencode with line-exact instructions and audited the same way; the unused `Gallery-N/Dictionary.tsx` was deleted. What still uses fixed colors is intentional: status and warning colors, black overlays, the exported share picture, the hand illustration, and brand gradients in promotional popups.

## Findings: R7 (flip flashcards with a detailed meaning)

- `Word.detail` is an optional long text. Custom sets store it inside the word record; CSV imports read a `detail` column (positional fifth column, or named in a header in any order: `name/word`, `trans/meaning`, `usphone`, `ukphone`, `detail/details`), JSON imports read a `detail` string, and the set editor has a "Detail" box per word. Duplicate words keep the first non-empty detail while meanings still merge. Old CSV and JSON files import exactly as before.
- Built-in sets can declare `detailUrl`, a `{ word: detail }` file that only Flashcards fetch (`my-vocab.detail.json`, 1.1 MB, 555 entries built from `Vocab.rtf` by `scripts/vocab-detail-from-text.py`). The other modes never load it. Copying a built-in set into My Sets merges its details first.
- Flashcards: a CSS 3D flip card. Front: the word; back: `parseDetail` lines (first line as a heading, labels in bold), scrolling inside the card when long; a word without detail shows its short meanings on the back. "Show the meaning first" shows the short meanings on the front and the word with its detail on the back. The hidden face is `aria-hidden` and ignores pointer events; reduced motion turns the animation off.
- Found while reading the editor: it loaded stored words without `detail`, so opening a set and saving it would have erased every detail. Loading now goes through `wordsToRows` (tested, round trip keeps detail).
- Delegated to opencode (4 runs, tests written first by the main session, "no build/test commands", "do not commit"); the main session ran the tests, read every diff and checked the flow in the browser: CSV import with a reordered header and quoted multi-line detail, edit and save without losing a detail, flashcards on built-in, custom and copied sets, reverse mode at 375px in dark mode. Test sets and progress rows created for the check were deleted.

- R7 follow-up: the flip was one-way (the session only knew "flipped"). The session now keeps two facts: which face is showing (`flipped`) and whether the answer was seen for this card (`revealed`). `toggleFlip` turns the card either way (Space, the button, or a click on the front); grades are accepted as soon as the answer has been seen, even when the card is turned back to the word, so the user can read the meaning, look back at the English word to rehearse it, and grade when ready. The button reads "Show answer", "Flip back" or "Flip again". The next card always starts on its front with the answer unseen. Covered by session and grader tests (276 total) and checked in the browser (Space four times in a row, grading from the front side, click on the card).

- R7 follow-up 2: the flip button is gone. Tapping or clicking the card turns it over either way (a small hint under the card says so; Space still works). A tap on a control inside the card, such as the pronunciation button, is ignored by the card, a long back scrolls without flipping, and a tap while text is selected does nothing (the app sets `user-select: none` on the body, so that guard is only a safety net). Checked with real mouse clicks, with the pronunciation button, and at 375px.

- Set dialog and editing entry points: the Library dialog header used `h-40` plus an absolutely positioned tab group, so a long description ran under "Chapters / View Mistakes / Mistake Review". The header now flows (no fixed height), the title and buttons wrap, and the tab group sits below the description (checked at 1280 and 375px, no overlap). Sets the user added got an "Edit set" button in that dialog and on the dashboard's "Current set" card (`customEditPath`, tested: custom id -> `/my-sets/<id>`, built-in -> none). Built-in sets, including "My Vocabulary", stay read-only; copying one into My Sets gives an editable copy.

- "My Vocabulary" is editable (R8). It is the user's own data, so the first time the app opens it becomes an editable set of the user (record id `myvocab`, dictionary id `custom:myvocab`) with all 555 words and their details. `migratePersonalSet` does this in one transaction: it creates the set only if it does not exist (re-running never overwrites the user's edits or adds a duplicate) and moves everything done with the built-in set to the new id: study progress (rows are re-keyed), typing history, chapter records, mistake reviews and the review log. The hook `usePersonalSeeds` runs it at start, then adds the id to `seededPersonalSets` (local storage), switches the stored current set and the Match best time to the new id, and the built-in copy is hidden from the Library and from "Copy a built-in dictionary" (it still resolves by id, so old links keep working). A failure (for example the word file cannot be fetched) changes nothing and is retried on the next start. Checked with realistic data in the browser: cards kept their repetition counts, the dashboard still read "2 / 555 words studied" with the Best time, the Library showed one "My Vocabulary", the editor opened 555 rows with details in about 0.55 s, saving without changes kept all 555 details, and a second start did not move anything again. Deleting the set removes it for good (the marker prevents re-creating it); the built-in file stays in the project.
