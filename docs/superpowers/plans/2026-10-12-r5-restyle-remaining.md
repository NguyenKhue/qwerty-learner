# R5: Restyle the Remaining Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the pages still on the old gray/indigo palette (Typing page and its panels, shared UI primitives, Analysis, Error book, Friend links, Library cards) onto the design tokens so they look right in light and dark mode.

**Architecture:** The old look is mostly in the shared component classes of `src/index.css` (`word-chip`, `my-btn-primary`, `tooltip`, `switch-*`, `listbox-*`, `slider`); those are rewritten by hand. The per-file utility classes are converted by a reviewed, pure mapping function (`scripts/retoken.cjs`-style, kept in the scratchpad, not shipped) that is unit-checked against a table of examples before it touches files. Pages are then checked in the browser in both themes.

**Spec:** `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md` (the "Not restyled" lists in R4 and the Opus review findings).

## Global Constraints

- Tokens only: `background, foreground, card, muted, muted-foreground, border, ring, primary(-foreground), accent, destructive`. Semantic reds/greens/ambers for status may stay.
- No behavior change: only class names and CSS. No renamed components, no moved files.
- Text contrast ≥ 4.5:1 in both themes; touch targets ≥ 44px stay as they are.
- Not restyled on purpose: `HandPositionIllustration` and chart colors (illustration/data colors), `SharePicDialog` (renders a share picture), the donation/star/promotion popups and `Footer` stickers (promotional content), the dead `src/pages/Gallery` folder.
- Tests, tsc (4 baseline errors) and eslint (6 baseline warnings) must stay as they are. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Text that was `dark:text-white` on a colored background must not become dark-on-dark; `text-white` next to `bg-primary` becomes `text-primary-foreground`.
- Headless UI `ui-active`/`ui-selected` variants in the listbox classes keep working.
- The typing letters (correct/wrong/neutral) stay distinguishable in both themes.
- Tables, dialogs and tabs from `components/ui` look right (they are shared by the Library dialog and Analysis).

---

### Task 1: Shared component classes in `index.css`

- [ ] Rewrite `word-chip`, `word-chip-tooltip`, `tooltip`, `my-btn-primary`, `switch-*`, `listbox-*`, `slider` with token classes (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `ui-active:bg-primary/10`, `ui-active:text-primary`), no `dark:` pairs.
- [ ] `yarn vitest run src/styles` (token test unchanged), `yarn vite build`, commit `style: move shared component classes to tokens`.

### Task 2: Mapping function, verified before use

- [ ] Write the mapping as a function with an examples table (input class string → expected output) and run it against the table; examples must cover: `bg-white dark:bg-gray-800`, `text-gray-600 dark:text-white dark:text-opacity-60`, `hover:bg-indigo-400 hover:text-white`, `bg-indigo-400 text-white`, `border-indigo-400`, `text-indigo-500`, `bg-gray-200`, `disabled:bg-gray-300`, a `ui-active:` token (must be untouched), and a gradient (`from-indigo-100`, untouched).
- [ ] Apply it to `src/pages/Typing` (except `ShareButton`, `HandPositionIllustration`), `src/pages/Analysis`, `src/pages/ErrorBook`, `src/pages/FriendLinks`, `src/pages/Gallery-N`, `src/components/ui`, `src/components/Drawer`, `src/components/Tooltip`.
- [ ] Review the whole diff by eye for wrong conversions; `yarn tsc`, `yarn eslint`, `yarn vitest run`; commit `style: move the remaining pages to tokens`.

### Task 3: Browser pass and fixes

- [ ] Typing (toolbar, switchers, settings panel, word list drawer, result screen), Analysis, Error book, Friend links, Library with a dialog open, at 1280 and 375 (where reachable), light and dark. Fix what looks wrong; append "Findings: R5" to the spec and commit.
