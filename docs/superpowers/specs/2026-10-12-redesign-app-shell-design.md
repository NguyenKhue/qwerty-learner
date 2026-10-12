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
