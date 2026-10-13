# R9: My Sets List, Set Detail Page and Editor Redesign

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) My Sets rows keep one primary "Open" button and move the other actions into a "⋯" menu; clicking a row opens a new set detail page. (2) The detail page shows every word as its own card (like a flashcard-site term list) with a search box, short meanings, and a collapsed "Show detail". (3) The editor becomes one card per word with a sticky top bar, search inside the set, per-card issue warnings and a per-card menu.

**Architecture:** Pure helpers (`search.ts`: diacritic-insensitive multi-term filter returning original indexes; `issues.ts`: per-row problems; route helpers) are tested first. The UI uses the existing Radix dropdown package through a small token-styled wrapper. Routes: `/my-sets` list, `/my-sets/new` editor (create), `/my-sets/:id` detail, `/my-sets/:id/edit` editor.

**Tech Stack:** React 18, react-router 6, Radix dropdown-menu, Tailwind tokens, Vitest.

**Spec:** the chat design of 2026-10-13 (user approved: keep the Open button, collapse the detail by default).

## Global Constraints

- Colors only through tokens; touch targets ≥ 44px; visible focus rings; keyboard-operable menus (Radix).
- Search ignores case and Vietnamese diacritics (`nghiem ngat` finds `nghiêm ngặt`; `đ` = `d`); all terms must match (AND) in the word, its meanings or its detail.
- A list of 555 words must stay fast: the detail page and editor render in pages of 50 with "Show more"; search results are paged the same way.
- Saving still keeps `detail` and every other field (the round trip test of `wordsToRows`/`rowsToWords` stays green); delete still asks for confirmation.
- No behavior change to import, copy, flashcards or the other modes. Tests, tsc (4 baseline errors) and eslint (6 baseline warnings) stay at baseline. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- Editing a word while a search filter is active must change the right word (indexes map back to the full list).
- Adding a word while filtering must show it (clear or bypass the filter) and focus its Word field.
- The Open/Edit/Duplicate/Delete menu items must work by keyboard; Delete must still confirm.
- `/my-sets/new`, `/my-sets/<id>` and `/my-sets/<id>/edit` must not shadow each other; old links to `/my-sets/<id>` now land on the detail page.
- Unsaved changes: leaving the editor with changes asks for confirmation; the browser tab warns on close.

## Tasks

1. **Pure helpers (main session, TDD):** `src/utils/custom-dict/search.ts`, `src/utils/custom-dict/issues.ts`, `customEditPath` -> `/my-sets/<id>/edit`, `customViewPath`.
2. **Routes (main session):** register the four routes.
3. **Run A (opencode):** `src/components/ui/dropdown-menu.tsx`, `src/pages/MySets/SetActionsMenu.tsx`, `src/pages/MySets/index.tsx` (list rows).
4. **Run B (opencode):** `src/pages/MySets/SetDetail/index.tsx`, `src/pages/MySets/SetDetail/WordCard.tsx`.
5. **Run C (opencode):** `src/pages/MySets/SetEditor.tsx` (+ `WordEditorCard.tsx`).
6. **Verification (main session):** browser at 1280 and 375 px, light and dark, with the 555-word My Vocabulary; findings in the spec; commit.
