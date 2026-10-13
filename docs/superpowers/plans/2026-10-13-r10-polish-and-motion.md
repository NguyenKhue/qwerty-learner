# R10: Professional Polish and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app looks and feels like a finished product: clear type and spacing hierarchy, real elevation, consistent controls, and purposeful motion. Colors stay (indigo primary, green accent); nothing changes in behavior.

**Architecture:** One foundation layer (tokens for elevation, radius, type roles, motion, plus a few utility classes), then shared primitives (`Button`, `Card`, `PageHeader`, form controls) that every page already imports or will import, then page-by-page application. Motion is CSS-only (transform and opacity, Tailwind keyframes, `--i` stagger variable), so no new dependency.

**Tech Stack:** Tailwind (CSS-variable tokens), tailwindcss-animate (already installed), Radix `data-state` animations, Vitest (contrast + token tests).

**Spec:** `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md`, appended "Findings: R10 audit" section (written in Task 1).

## Audit (what makes it look unprofessional, from the live pages at 1280px)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 1 | **Flat, one-weight surfaces.** Lavender page + white cards with only a 1px indigo border and no elevation: every block has the same visual weight. | Dashboard: Today, Current set, This week, Practice all identical cards. | 3-level elevation scale (hairline border + layered soft shadow), page background a calmer near-neutral tint. |
| 2 | **No type hierarchy.** Almost everything is 14px `text-muted-foreground` or 16px; section labels look like body text; page titles are only 24px. | "Due today", "Current set", "This week" labels read as noise. | Type roles: display 36/40, title 24/32, heading 18/28, body 15/24, label 13/20, eyebrow 12 uppercase tracked; tabular numbers for stats; `tracking-tight` on headings. |
| 3 | **Dashboard has no focal point.** The thing to do today (Start review) is one small button among equals. | Screenshot: button 36px high beside tiny numbers. | One hero "Today" card: big numbers, one large primary CTA, quiet progress below; secondary cards recede. |
| 4 | **Inconsistent spacing and control size.** Card padding and gaps vary (`p-6`, `p-4`, `gap-3/4/6`); buttons are 36 to 44px; the native file input and default `<select>` are unstyled. | My Sets: "Choose File" gray browser button, big gaps next to cramped rows. | 4/8 rhythm: page gap 32, card padding 24 (16 on phones), control height 44; styled `Input`, `Select`, `Textarea`, `FileDrop`. |
| 5 | **Sidebar is small and timid.** 12px labels, weak active state, set switcher looks like a tag. | Sidebar items 12px, active = faint lavender. | 14px items, 40px rows, active = filled pill with a 3px primary bar, group labels, set switcher as a proper card with chevron. |
| 6 | **Almost no motion.** Pages appear instantly; only color transitions (51 files) and the flip (`duration-500`, linear-ish). Dialogs and menus snap. Nothing confirms a grade, a correct answer or a match. | Zero entrance animations; no press feedback. | Motion tokens, page enter, card stagger, press and hover feedback, tab and progress animations, flip with a springy curve, grading transition, quiz right/wrong feedback, match pop. All off under `prefers-reduced-motion`. |
| 7 | **Page chrome repeated by hand.** Each page builds its own title row (`h1 text-2xl` + Back button). | `ModePage`, Dashboard, MySets, Library all differ slightly. | `PageHeader` (title, optional subtitle, actions) used everywhere. |
| 8 | **Leftover prototype styling.** Gradient text, typewriter keyframes, `.my-card` giant shadow, `.shadow-upper`, scrollbar hard-coded black. | `src/index.css` tail. | Remove dead keyframes; replace `.my-card` with elevation tokens; scrollbar via tokens. |

## Design decisions

- **Direction:** calm, focused, "quiet product" (Linear/Notion-like), not playful. The skill's generated suggestion (Claymorphism, Baloo 2) is for children's apps and is rejected: the user asked for professional, and keeps the current palette.
- **Palette:** keep `primary` indigo, `accent` green, destructive red. Only neutrals change: light background `247 248 252` (less lavender), card `255 255 255`, border `226 230 242`, muted `241 243 250`; dark background `13 15 26`, card `22 25 40` (lighter than the page, so depth shows without shadow), border `42 47 72`. Every pair still passes the contrast test (`src/styles/tokens.test.ts`).
- **Typeface:** keep Inter, enable `cv11` and `ss01` features and `font-variant-numeric: tabular-nums` on numbers. Fonts load with `display=swap` already.
- **Radius scale:** 8 (controls), 12 (cards), 16 (hero, dialogs). **Elevation:** `shadow-1` (resting card), `shadow-2` (hover, menus), `shadow-3` (dialogs). In dark mode shadows are replaced by a lighter surface and a visible border.
- **Motion tokens:** `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`, `--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1)`; durations 120ms (press, hover), 200ms (state changes), 320ms (enter, dialogs), 600ms (flip). Exits are about 65% of the enter time. Only `transform` and `opacity` animate (progress bars use `transform: scaleX`).

## Global Constraints

- No behavior, route, data or copy changes; no new npm dependency.
- Colors only through tokens; light and dark designed together; contrast pairs >= 4.5:1 (text) and >= 3:1 (UI) stay green in `tokens.test.ts`.
- `prefers-reduced-motion`: all new animations and the stagger are disabled (the existing global rule handles durations; entrance classes must also end in the visible state, never depend on `animation-fill-mode` to become visible).
- Touch targets >= 44px; focus ring visible on every control; no layout shift from hover or press (transform only).
- Content must be visible if animations never run (no `opacity-0` without an animation that ends at 1).
- tsconfig target es5: no iterating Map/Set, no `flatMap`. Tests, tsc (4 baseline errors) and eslint (6 baseline warnings) stay at baseline. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A phone at 375px: card padding 16, hero numbers do not wrap badly, tab bar not covered by the page-enter transform.
- Dark mode: card visibly lifts from the page (border + lighter surface), text contrast holds.
- Reduced motion on: nothing moves, nothing is invisible.
- Rapid interaction: pressing Next quickly on flashcards or answering quiz questions fast must not queue animations or leave a card half-visible.
- Long content: 5,000-character flashcard detail and a 40-character set name do not break the new header or card layout.
- Keyboard: focus ring is not clipped by `overflow-hidden` cards or hidden by the hover lift.

---

### Task 1: Foundation tokens, type roles, motion (main session)

Files: `src/index.css`, `tailwind.config.js`, `index.html` (none expected), `src/styles/tokens.test.ts`, spec findings section.

- [ ] Failing test first: `tokens.test.ts` asserts the new neutrals (light and dark) keep the existing pair contrast, and that `--ease-out`, `--ease-spring`, `--dur-fast`, `--dur-base`, `--dur-enter` and `--shadow-1..3` exist in `index.css`.
- [ ] `index.css`: new neutral values; `--shadow-1/2/3` (light) and dark overrides; `--radius-*`; motion variables; body `font-feature-settings: 'cv11', 'ss01'`; utility classes `.text-display`, `.text-title`, `.text-heading`, `.text-eyebrow`, `.num` (tabular-nums); keyframes `enter-up` (opacity 0, translateY 8px to 0), `enter-fade`, `pop` (scale .96 to 1), `shake` (+-4px, 240ms), `soft-pulse`; `.page-enter` and `.stagger > * { animation: enter-up var(--dur-enter) var(--ease-out) both; animation-delay: calc(var(--i, 0) * 40ms) }` guarded by `@media (prefers-reduced-motion: no-preference)`; remove `.gradient-text`, `typing`, `blink-caret`, `hideCaret`, `gradientBG`, `.typewriter`, `.my-card`, `.shadow-upper`, `.text-shadow` after confirming by `grep` they are unused (or replace their uses).
- [ ] `tailwind.config.js`: `boxShadow: { 1,2,3 }` from the variables, `borderRadius` md/lg/xl/2xl mapped to the radius scale, `transitionTimingFunction: { out, spring }`, `transitionDuration` 120/200/320/600, `animation` entries for the keyframes.
- [ ] Run tests, tsc, eslint, build; screenshot Dashboard light and dark to check nothing regressed; commit `feat: design foundation, elevation, type roles and motion tokens`.

### Task 2: Primitives (opencode Run A)

Files: `src/components/ui/button.tsx`, `src/components/ui/card.tsx` (new: `Card`, `CardHeader`, `CardTitle`, `CardEyebrow`), `src/components/ui/page-header.tsx` (new), `src/components/ui/input.tsx`, `select.tsx`, `textarea.tsx`, `file-drop.tsx` (new), `src/components/ui/dialog.tsx`, `dropdown-menu.tsx`, `tabs.tsx`, `tooltip.tsx`, `src/components/ModePage.tsx` (`Panel` = `Card`, `ModePage` uses `PageHeader`).

- [ ] `Button`: heights 44 (default) and 36 only where a dense table needs it; radius `rounded-lg`; `active:scale-[0.98]` with `transition-[transform,background-color,box-shadow] duration-fast ease-out`; primary gets `shadow-1` and a 1px inner top highlight; variants keep names; icon slot gap 8px.
- [ ] `Card`: `rounded-xl border border-border bg-card shadow-1`, padding `p-4 sm:p-6`; `interactive` prop adds `hover:-translate-y-0.5 hover:shadow-2` and `focus-within` ring, transform only.
- [ ] `PageHeader({ title, subtitle?, actions?, back? })`: title `text-title`, subtitle `text-sm text-muted-foreground`, actions right-aligned and wrapping under the title on phones.
- [ ] Form controls: 44px height, `rounded-lg`, `border-border`, `focus-visible:ring-2`, label and helper text slots; `FileDrop` replaces the native file input with a dashed dropzone (click or drop, shows file name), still using a real `<input type="file">` for accessibility.
- [ ] Radix overlays: `data-[state=open]:animate-in data-[state=closed]:animate-out fade/zoom-95` (dialog 320ms enter, 200ms exit; menus 160ms/110ms); tabs: active tab underline slides with `transition-transform`.
- [ ] Run B-E consume these; the main session reviews the diff, runs tests, checks in the browser (light/dark, 375/1280), commits.

### Task 3: App shell and Dashboard (opencode Run B)

Files: `src/components/AppShell/index.tsx`, `navItems.ts` (no logic change), `src/pages/Dashboard/index.tsx`, `WeekCard.tsx`.

- [ ] Sidebar: 14px labels, 40px rows, active = `bg-primary/10 text-primary` pill plus a 3px left bar, icon 20px, group spacing 24, set switcher as a bordered card with chevron and truncated name; tab bar: active icon filled, label 11px, `active:scale-95`. Theme toggle moves into the footer group with About.
- [ ] Dashboard hierarchy: `PageHeader` ("Today", subtitle with the date); hero `Card` (16px radius, subtle `bg-gradient-to-br from-primary/10` to card, same indigo hue) with `text-display num` due and new counts and a large primary "Start review" button; current set as a slim card (name, progress bar using `scaleX` animation on mount, "n / total words studied", Change/Edit as `ghost` buttons); WeekCard bars animate `scaleY` from 0 with 40ms stagger; Practice grid cards `interactive`, icon tile 40px, arrow that nudges 2px on hover.
- [ ] Page enter: the content column has `.page-enter`, cards `.stagger` with `style={{ '--i': n }}`.

### Task 4: Study modes (opencode Run C)

Files: `src/pages/Study/*`, `src/pages/Quiz/*`, `src/pages/Match/*`, `src/components/ModePage.tsx` usage only.

- [ ] Flashcards: card face `rounded-2xl shadow-2`, word at `text-display`, flip duration 600ms with `ease-spring`; after grading the old card slides 24px left and fades (160ms) and the next enters from the right (`enter-up` variant); progress bar at the top as a thin 4px `scaleX` fill; grade buttons in a 4-column row with the interval hint under each label, `active:scale-95`; the keyboard shortcut chips as `kbd` styled elements. Guard against queued animations: key the card by id and run only one transition at a time (state flag cleared on `animationend` with a 250ms timeout fallback so correctness never depends on the event).
- [ ] Quiz: option buttons `interactive`; on pick, correct = green ring + `pop`, wrong = destructive ring + `shake` and the right one highlighted; progress as above; result screen counts up with `enter-up` stagger.
- [ ] Match: tiles `rounded-xl shadow-1`, selected = ring + `-translate-y-0.5`, matched = `pop` then fade to `opacity-40` (never below 0.4, so it stays readable), wrong pair = `shake`.

### Task 5: Typing page, popups and settings (opencode Run D)

Files: `src/pages/Typing/**` (styling only, no input logic), `src/components/Header`-like chrome if any, Settings and Analysis dialogs.

- [ ] Typing: the word area on a `Card` with `shadow-1`, current letter caret as a 2px primary underline with a 120ms transition, correct letters fade to `text-foreground`, wrong letter `shake` 160ms; stats row uses `.num`; panels (chapter/dict pickers) use the new `Dialog`/`Select` styling. No change to key handling.
- [ ] Settings/Analysis/ErrorBook: `Card` sections, `PageHeader`, tabs underline animation.

### Task 6: My Sets, Library, set detail, editor, About (opencode Run E)

Files: `src/pages/MySets/**`, `src/pages/Gallery-N/**`, `src/pages/About/index.tsx`.

- [ ] My Sets list rows as `interactive` cards (name 16px semibold, meta 13px muted, Open as primary, menu ghost), import uses `FileDrop` and a collapsed "Import a set" `Card` with the format help in a `<details>`-style disclosure (the long CSV sentence becomes progressive disclosure), copy-built-in as one row with `Select` + button.
- [ ] Detail page: header with `PageHeader`, mode buttons as a segmented row; word cards `shadow-1`, collapsed detail animates height via `grid-template-rows: 0fr to 1fr` (no height animation); search input 44px with icon.
- [ ] Editor: sticky bar gets `shadow-2` when scrolled; new card enters with `pop` and focuses; remove uses a 160ms collapse.
- [ ] Library dialog: card grid `interactive`, chip styling consistent.

### Task 7: Verification, findings, commit (main session)

- [ ] Run tests, tsc, eslint, build. In the browser at 1280 and 375, light and dark, with reduced motion emulated off and on: Dashboard, Study (flip, grade, rapid grading), Quiz (right and wrong), Match, Typing, My Sets list/detail/editor, Library dialog, Settings.
- [ ] Append "Findings: R10" to the spec; commit.

## Delegation

Per the user's instruction the main session writes the foundation (Task 1) and reviews; opencode (`space-bunny-free`, sequential runs because Tasks 2 to 6 share `components/ui`, exact file lists, "no build/test commands", "do not commit") implements Tasks 2 to 6 in order A to E. After each run the main session reads the diff, runs the tests and checks the page in the browser before the next run starts. Run A must finish first because B to E import its components.
