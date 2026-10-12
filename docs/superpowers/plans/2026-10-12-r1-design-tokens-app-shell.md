# R1: Design Tokens and App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the calm design tokens and Inter font, and put every page inside a new AppShell (sidebar on desktop and tablet, bottom tab bar on phones), with phones no longer redirected to `/mobile`.

**Architecture:** Colors become CSS variables (space-separated RGB triples) in `src/index.css`, mapped into Tailwind with `rgb(var(--x) / <alpha-value>)`. A contrast unit test parses those variables from the CSS file, so the CSS stays the single source of truth. `AppShell` is a React Router layout route rendering `<Outlet />`; its navigation list and active-state logic are pure functions in `navItems.ts` so they are unit-tested. `Layout` stops forcing `h-screen` so existing pages fit inside the shell unchanged.

**Tech Stack:** React 18, react-router 6.11, Tailwind 3.3, jotai, unplugin-icons (`~icons/tabler/*`), Vitest (node/jsdom, `.test.ts` only: logic is tested in `.ts` modules, UI is verified in the browser).

**Spec:** `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md` (sections 3, 4, 5, 8; phase R1)

## Global Constraints

- Tokens: `background, foreground, card, card-foreground, muted, muted-foreground, border, ring, primary, primary-foreground, accent, accent-foreground, destructive, destructive-foreground`.
- Text contrast ≥ 4.5:1 and UI-component contrast ≥ 3:1 in light and dark.
- Touch targets ≥ 44px; visible focus ring on every interactive element; `prefers-reduced-motion` respected; transitions 150–250ms; no emoji as icons.
- Breakpoints: sidebar full ≥ 1024px, icon-only 768–1023px, bottom tab bar < 768px. `/typing` always uses the icon-only sidebar at ≥ 768px.
- tsconfig target is es5: no iterating Map/Set iterators, no `flatMap`, no `matchAll` iteration.
- Existing tests stay green; eslint warnings stay at the baseline of 6; tsc errors stay at the baseline of 4.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. The pre-commit hook runs `prettier --write .` over the whole repo; stage only the files named in each task and verify with `git status` afterwards.

## Review Focus

- A custom set id contains `:` (`custom:12`): the Flashcards/Quiz/Match nav links must URL-encode it and still match the active route.
- `/study/custom%3A12` and `/quiz/...` must show the right nav item as active (prefix match, not exact).
- A page taller than the viewport must scroll inside the shell, not push the tab bar off screen.
- Phone width (375px): no horizontal scroll; the More sheet closes on route change and on Escape.
- Typing at < 768px must not mount the typing engine (no key listeners, no word loading) and must show the keyboard notice.
- Dark mode: no light flash and no unreadable text on pages that still use old gray/indigo classes.

---

### Task 1: Design tokens, Inter, Tailwind mapping

**Files:**

- Create: `src/utils/contrast.ts`, `src/utils/contrast.test.ts`, `src/styles/tokens.test.ts`
- Modify: `src/index.css`, `tailwind.config.js`, `index.html`

**Interfaces:**

- Produces: `contrastRatio(a: Rgb, b: Rgb): number`, `parseTokenBlock(css: string, selector: string): Record<string, Rgb>`, `type Rgb = [number, number, number]`. Tailwind classes `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-accent`, `bg-destructive`, `ring-ring`, plus `font-sans` = Inter.

- [ ] **Step 1: Write the failing contrast tests**

`src/utils/contrast.test.ts`:

```ts
import { contrastRatio, parseTokenBlock } from './contrast'
import { describe, expect, it } from 'vitest'

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colors', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1)
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBeCloseTo(1, 5)
  })
  it('does not depend on argument order', () => {
    expect(contrastRatio([79, 70, 229], [255, 255, 255])).toBeCloseTo(contrastRatio([255, 255, 255], [79, 70, 229]), 10)
  })
})

describe('parseTokenBlock', () => {
  const css = `@layer base { :root { --a: 1 2 3; --b-c: 255 0 10; } .dark { --a: 9 9 9; } } html.dark body { color: red; }`
  it('reads the triples of the requested block only', () => {
    expect(parseTokenBlock(css, ':root')).toEqual({ a: [1, 2, 3], 'b-c': [255, 0, 10] })
    expect(parseTokenBlock(css, '.dark')).toEqual({ a: [9, 9, 9] })
  })
  it('returns an empty object when the block is missing', () => {
    expect(parseTokenBlock(css, '.nope')).toEqual({})
  })
})
```

`src/styles/tokens.test.ts`:

```ts
import css from '../index.css?raw'
import { contrastRatio, parseTokenBlock } from '@/utils/contrast'
import { describe, expect, it } from 'vitest'

const TEXT_PAIRS: Array<[string, string]> = [
  ['foreground', 'background'],
  ['card-foreground', 'card'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['primary', 'background'],
  ['primary', 'card'],
]
const UI_PAIRS: Array<[string, string]> = [
  ['ring', 'background'],
  ['ring', 'card'],
]

for (const [mode, selector] of [
  ['light', ':root'],
  ['dark', '.dark'],
] as const) {
  describe(`${mode} tokens`, () => {
    const tokens = parseTokenBlock(css, selector)
    it('defines every token', () => {
      for (const name of [
        'background',
        'foreground',
        'card',
        'card-foreground',
        'muted',
        'muted-foreground',
        'border',
        'ring',
        'primary',
        'primary-foreground',
        'accent',
        'accent-foreground',
        'destructive',
        'destructive-foreground',
      ]) {
        expect(tokens[name], name).toBeDefined()
      }
    })
    it.each(TEXT_PAIRS)('text %s on %s is at least 4.5:1', (fg, bg) => {
      expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5)
    })
    it.each(UI_PAIRS)('%s against %s is at least 3:1', (fg, bg) => {
      expect(contrastRatio(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3)
    })
  })
}
```

- [ ] **Step 2: Run to verify they fail**

Run: `yarn vitest run src/utils/contrast.test.ts src/styles/tokens.test.ts`
Expected: FAIL (`./contrast` not found, tokens undefined).

- [ ] **Step 3: Implement `src/utils/contrast.ts`**

```ts
export type Rgb = [number, number, number]

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colors, 1 to 21 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** Reads `--name: R G B;` declarations from the first `selector { ... }` block of a stylesheet */
export function parseTokenBlock(css: string, selector: string): Record<string, Rgb> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
  const tokens: Record<string, Rgb> = {}
  if (!block) return tokens
  const declaration = /--([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g
  let match = declaration.exec(block[1])
  while (match) {
    tokens[match[1]] = [Number(match[2]), Number(match[3]), Number(match[4])]
    match = declaration.exec(block[1])
  }
  return tokens
}
```

- [ ] **Step 4: Add tokens to `src/index.css`**

Insert directly after the three `@tailwind` lines, and replace the existing `body` background rule and the `html.dark body` rule:

```css
@layer base {
  :root {
    --background: 238 242 255;
    --foreground: 49 46 129;
    --card: 255 255 255;
    --card-foreground: 49 46 129;
    --muted: 235 238 248;
    --muted-foreground: 71 85 105;
    --border: 199 210 254;
    --ring: 79 70 229;
    --primary: 79 70 229;
    --primary-foreground: 255 255 255;
    --accent: 21 128 61;
    --accent-foreground: 255 255 255;
    --destructive: 220 38 38;
    --destructive-foreground: 255 255 255;
  }

  .dark {
    --background: 15 18 32;
    --foreground: 226 232 240;
    --card: 30 34 53;
    --card-foreground: 226 232 240;
    --muted: 38 43 66;
    --muted-foreground: 148 163 184;
    --border: 55 62 92;
    --ring: 129 140 248;
    --primary: 129 140 248;
    --primary-foreground: 15 18 32;
    --accent: 74 222 128;
    --accent-foreground: 5 46 22;
    --destructive: 248 113 113;
    --destructive-foreground: 69 10 10;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

In `body { ... }` replace `font-family: -apple-system, ...;` with `font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;`, replace `background-color: #faf9ff;` with `background-color: rgb(var(--background)); color: rgb(var(--foreground));`, and delete the `html.dark body { @apply bg-gray-900; }` rule. The `transition-colors duration-300` on body stays.

- [ ] **Step 5: Map tokens in `tailwind.config.js`**

At the top of the file add `const defaultTheme = require('tailwindcss/defaultTheme')` and `const token = (name) => \`rgb(var(--${name}) / <alpha-value>)\``. Replace `colors: { primary: '#6366f1' }` with:

```js
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        border: token('border'),
        ring: token('ring'),
        card: { DEFAULT: token('card'), foreground: token('card-foreground') },
        muted: { DEFAULT: token('muted'), foreground: token('muted-foreground') },
        primary: { DEFAULT: token('primary'), foreground: token('primary-foreground') },
        accent: { DEFAULT: token('accent'), foreground: token('accent-foreground') },
        destructive: { DEFAULT: token('destructive'), foreground: token('destructive-foreground') },
      },
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
```

- [ ] **Step 6: Load Inter in `index.html`**

In `<head>` add `<link rel="preconnect" href="https://fonts.googleapis.com" />`, `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />` and `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />`. Change `<html lang="zh-Hans">` to `<html lang="en">`.

- [ ] **Step 7: Run tests, adjust palette if a pair fails**

Run: `yarn vitest run src/utils/contrast.test.ts src/styles/tokens.test.ts`
Expected: PASS. If a pair fails, change only that token in `index.css` (keep hue, move lightness) and ledger a Ruling with the new value.

- [ ] **Step 8: Verify the build and commit**

Run: `yarn tsc --noEmit 2>&1 | tail -3` (expect the same 4 pre-existing errors), then `yarn vite build 2>&1 | tail -3` (expect success).

```bash
git add src/utils/contrast.ts src/utils/contrast.test.ts src/styles/tokens.test.ts src/index.css tailwind.config.js index.html
git commit -m "feat: add design tokens, Inter font and contrast tests"
git status --short | grep -v public/dicts
```

Expected: only the pre-existing untracked entries remain.

---

### Task 2: Navigation model and AppShell

**Files:**

- Create: `src/components/AppShell/navItems.ts`, `src/components/AppShell/navItems.test.ts`, `src/components/AppShell/index.tsx`, `src/hooks/useMediaQuery.ts`
- Modify: `src/components/Layout.tsx`

**Interfaces:**

- Consumes: `currentDictIdAtom`, `currentDictInfoAtom`, `isOpenDarkModeAtom` from `@/store`.
- Produces: `buildNavItems(dictId: string): NavItem[]`, `isNavActive(item: NavItem, pathname: string): boolean`, `MORE_LINKS: Array<{ label: string; to: string }>`, default export `AppShell` (a layout route component), `useMediaQuery(query: string): boolean`.

```ts
export type NavItem = {
  id: 'home' | 'typing' | 'study' | 'quiz' | 'match' | 'my-sets' | 'library'
  label: string
  to: string
  base: string // path prefix used for the active state
  icon: 'home' | 'keyboard' | 'cards' | 'quiz' | 'match' | 'sets' | 'library'
  tab: boolean // shown in the phone tab bar
}
```

- [ ] **Step 1: Write the failing tests**

`src/components/AppShell/navItems.test.ts`:

```ts
import { MORE_LINKS, buildNavItems, isNavActive } from './navItems'
import { describe, expect, it } from 'vitest'

const byId = (dictId: string, id: string) => {
  const item = buildNavItems(dictId).find((i) => i.id === id)
  if (!item) throw new Error(id)
  return item
}

describe('buildNavItems', () => {
  it('lists the modes in order and marks five tabs for phones', () => {
    const items = buildNavItems('cet4')
    expect(items.map((i) => i.id)).toEqual(['home', 'typing', 'study', 'quiz', 'match', 'my-sets', 'library'])
    expect(items.filter((i) => i.tab).map((i) => i.id)).toEqual(['home', 'typing', 'study', 'quiz', 'match'])
  })
  it('points the mode links at the current set, URL-encoded', () => {
    expect(byId('cet4', 'study').to).toBe('/study/cet4')
    expect(byId('custom:12', 'quiz').to).toBe('/quiz/custom%3A12')
    expect(byId('custom:12', 'match').to).toBe('/match/custom%3A12')
  })
})

describe('isNavActive', () => {
  it('matches home only on the exact root path', () => {
    expect(isNavActive(byId('cet4', 'home'), '/')).toBe(true)
    expect(isNavActive(byId('cet4', 'home'), '/typing')).toBe(false)
  })
  it('matches mode links by prefix, including encoded ids', () => {
    expect(isNavActive(byId('custom:12', 'study'), '/study/custom%3A12')).toBe(true)
    expect(isNavActive(byId('cet4', 'quiz'), '/quiz/anything')).toBe(true)
    expect(isNavActive(byId('cet4', 'quiz'), '/quizzes')).toBe(false)
  })
  it('keeps My Sets active inside the set editor', () => {
    expect(isNavActive(byId('cet4', 'my-sets'), '/my-sets/3')).toBe(true)
  })
  it('does not activate anything on unrelated paths', () => {
    for (const item of buildNavItems('cet4')) expect(isNavActive(item, '/error-book')).toBe(false)
  })
})

describe('MORE_LINKS', () => {
  it('offers the pages that have no tab', () => {
    expect(MORE_LINKS.map((l) => l.to)).toEqual(['/my-sets', '/gallery', '/error-book', '/analysis'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `yarn vitest run src/components/AppShell/navItems.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `navItems.ts`**

```ts
export type NavItem = {
  id: 'home' | 'typing' | 'study' | 'quiz' | 'match' | 'my-sets' | 'library'
  label: string
  to: string
  base: string
  icon: 'home' | 'keyboard' | 'cards' | 'quiz' | 'match' | 'sets' | 'library'
  tab: boolean
}

export const MORE_LINKS: Array<{ label: string; to: string }> = [
  { label: 'My Sets', to: '/my-sets' },
  { label: 'Library', to: '/gallery' },
  { label: 'Error book', to: '/error-book' },
  { label: 'Analysis', to: '/analysis' },
]

export function buildNavItems(dictId: string): NavItem[] {
  const id = encodeURIComponent(dictId)
  return [
    { id: 'home', label: 'Home', to: '/', base: '/', icon: 'home', tab: true },
    { id: 'typing', label: 'Typing', to: '/typing', base: '/typing', icon: 'keyboard', tab: true },
    { id: 'study', label: 'Flashcards', to: `/study/${id}`, base: '/study', icon: 'cards', tab: true },
    { id: 'quiz', label: 'Quiz', to: `/quiz/${id}`, base: '/quiz', icon: 'quiz', tab: true },
    { id: 'match', label: 'Match', to: `/match/${id}`, base: '/match', icon: 'match', tab: true },
    { id: 'my-sets', label: 'My Sets', to: '/my-sets', base: '/my-sets', icon: 'sets', tab: false },
    { id: 'library', label: 'Library', to: '/gallery', base: '/gallery', icon: 'library', tab: false },
  ]
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.base === '/') return pathname === '/'
  return pathname === item.base || pathname.indexOf(item.base + '/') === 0
}
```

- [ ] **Step 4: Run to verify pass**

Run: `yarn vitest run src/components/AppShell/navItems.test.ts`
Expected: PASS.

- [ ] **Step 5: Add `src/hooks/useMediaQuery.ts`**

```ts
import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}
```

- [ ] **Step 6: Build `src/components/AppShell/index.tsx`**

Requirements (each is checked in Task 4): `<div className="flex h-[100dvh] w-full bg-background text-foreground">` containing `aside` and the content column.

- `aside`: `hidden md:flex shrink-0 flex-col border-r border-border bg-card` with width `w-[72px]` plus `lg:w-60` unless `compact` (`pathname` is `/typing` or starts with `/typing/`). Contents top to bottom: logo link to `/` (`@/assets/logo.svg`, text "Qwerty Learner" shown only when expanded); set switcher (a `Link` to `/gallery` showing `currentDictInfoAtom` name and `length` words, `aria-label="Change set: <name>"`, book icon only when compact); a `nav` with all `buildNavItems` items as `NavLink`-style links; bottom area with a theme toggle button (`aria-label` "Switch to dark mode" / "Switch to light mode", sun/moon icon) that flips `isOpenDarkModeAtom`.
- Link style: `flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`; active adds `bg-primary/10 text-primary` and `aria-current="page"`; inactive `text-muted-foreground`. Label span is `sr-only` when compact and `sr-only lg:not-sr-only` otherwise; every link also gets `title={label}`.
- Icons: `~icons/tabler/home`, `keyboard`, `cards`, `list-check`, `puzzle`, `folders`, `books`, `sun`, `moon`, `dots`.
- Content column: `flex min-h-0 min-w-0 flex-1 flex-col`; inside, `<main className="min-h-0 flex-1 overflow-y-auto"><Outlet /></main>` and below it the tab bar `nav` (`md:hidden`, `flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)]`) with the five `tab` items plus a "More" button (`aria-expanded`, `aria-haspopup="dialog"`). Each tab is `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs` with the same active styling.
- More sheet: when open, a fixed backdrop (`fixed inset-0 z-30 bg-black/40 md:hidden`, click closes) and a panel (`fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 rounded-t-2xl border border-border bg-card p-2 md:hidden`, `role="dialog"`, `aria-label="More"`) listing `MORE_LINKS` as 44px links plus the theme toggle. Close on route change (effect on `pathname`) and on Escape (keydown listener only while open).

- [ ] **Step 7: Make `Layout` fit inside the shell**

In `src/components/Layout.tsx` change `h-screen` to `h-full` in the `main` className. Keep the `Footer` for now (R4 relocates it).

- [ ] **Step 8: Typecheck and commit**

Run: `yarn tsc --noEmit 2>&1 | tail -3` (same 4 errors as the baseline), `yarn eslint src/components/AppShell src/hooks/useMediaQuery.ts` (0 warnings).

```bash
git add src/components/AppShell src/hooks/useMediaQuery.ts src/components/Layout.tsx
git commit -m "feat: add app shell with sidebar and phone tab bar"
```

---

### Task 3: Routes, phones, and the Typing keyboard notice

**Files:**

- Create: `src/pages/Typing/KeyboardNotice.tsx`, `src/pages/Typing/TypingGate.tsx`
- Modify: `src/index.tsx`, `src/pages/Typing/index.tsx`

**Interfaces:**

- Consumes: `AppShell` (default), `useMediaQuery`, `buildNavItems`, `currentDictIdAtom`.
- Produces: `TypingGate` default export, used by both `/` and `/typing` until R2 replaces `/` with the Dashboard.

- [ ] **Step 1: Create the notice and gate**

`src/pages/Typing/KeyboardNotice.tsx`: a centered card (`m-auto max-w-sm rounded-xl border border-border bg-card p-6 text-center`) with `h2` "Typing needs a keyboard", a paragraph "Typing practice works best with a physical keyboard. On a phone you can use Flashcards, Quiz and Match.", and three links (Flashcards, Quiz, Match) built from `buildNavItems(useAtomValue(currentDictIdAtom))`, styled as 44px primary buttons.

`src/pages/Typing/TypingGate.tsx`:

```tsx
import KeyboardNotice from './KeyboardNotice'
import TypingPage from './index'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Below 768px the typing engine is not mounted at all: no key listeners, no word loading
export default function TypingGate() {
  const wide = useMediaQuery('(min-width: 768px)')
  return wide ? <TypingPage /> : <KeyboardNotice />
}
```

- [ ] **Step 2: Remove the old mobile alert in `src/pages/Typing/index.tsx`**

Delete the `useEffect` that calls `IsDesktop()` and `alert(...)`, and drop `IsDesktop` from the `@/utils` import if it becomes unused (keep `isLegal`).

- [ ] **Step 3: Rewire `src/index.tsx`**

- Remove the `MobilePage` import, the `isMobile` state, its resize effect, and the `isMobile ? ... : ...` branches. Import `AppShell from './components/AppShell'` and `TypingGate from './pages/Typing/TypingGate'`; drop the direct `TypingPage` import.
- Route table:

```tsx
<Routes>
  <Route element={<AppShell />}>
    <Route index element={<TypingGate />} />
    <Route path="/typing" element={<TypingGate />} />
    <Route path="/gallery" element={<GalleryPage />} />
    <Route path="/analysis" element={<AnalysisPage />} />
    <Route path="/error-book" element={<ErrorBook />} />
    <Route path="/my-sets" element={<MySetsPage />} />
    <Route path="/my-sets/:id" element={<SetEditorPage />} />
    <Route path="/study/:dictId" element={<StudyPage />} />
    <Route path="/quiz/:dictId" element={<QuizPage />} />
    <Route path="/match/:dictId" element={<MatchPage />} />
    <Route path="/friend-links" element={<FriendLinks />} />
    <Route path="/mobile" element={<Navigate to="/" replace />} />
    <Route path="/*" element={<Navigate to="/" />} />
  </Route>
</Routes>
```

Leave `src/pages/Mobile/` in place (R4 deletes it).

- [ ] **Step 4: Typecheck, lint, run the whole suite**

Run: `yarn tsc --noEmit 2>&1 | tail -5`, `yarn eslint src --max-warnings 6`, `yarn vitest run 2>&1 | tail -6`
Expected: tsc same 4 baseline errors; eslint ≤ 6 warnings; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/index.tsx src/pages/Typing/KeyboardNotice.tsx src/pages/Typing/TypingGate.tsx src/pages/Typing/index.tsx
git commit -m "feat: route every page through the app shell and open the app on phones"
```

---

### Task 4: Browser verification and fixes

**Files:** whichever Task 1–3 files need fixes.

- [ ] **Step 1: Start the dev server** (`preview_start` with the `.claude/launch.json` entry) and open `/`.

- [ ] **Step 2: Check each Review Focus item**

At 1280×800, 900×800 and 375×812, in light and dark (`resize_window` with `colorScheme`), verify with `read_page`/`find` and one screenshot per breakpoint:

- 1280: full sidebar with labels; `/typing` shows the icon-only sidebar; the typing page still works (type a word).
- 900: icon-only sidebar, labels exposed to assistive tech (`sr-only`).
- 375: tab bar visible, no horizontal scroll (`document.documentElement.scrollWidth <= innerWidth`), `/typing` shows the notice and `document.querySelectorAll` finds no typing word panel, More sheet opens, closes on Escape and after navigating.
- With a custom set selected: the Flashcards link goes to `/study/custom%3A<id>` and highlights; opening it loads the set.
- A long page (`/gallery`) scrolls inside the shell and the tab bar stays visible at 375.
- `/mobile` redirects to `/`.
- Console: no errors.

- [ ] **Step 3: Fix anything found, add a test where the bug is in a pure function, then run `yarn vitest run`, `yarn tsc --noEmit`, `yarn eslint src`.**

- [ ] **Step 4: Commit fixes** (if any) with `git add <files>` and `git commit -m "fix: <what>"`, then record the spec's R1 findings by appending a "Findings: R1" section to `docs/superpowers/specs/2026-10-12-redesign-app-shell-design.md` and committing it.
