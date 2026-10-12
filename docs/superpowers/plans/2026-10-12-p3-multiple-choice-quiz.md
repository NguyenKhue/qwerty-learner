# P3 — Multiple-Choice Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user quiz themselves on any custom set with 4-option multiple-choice questions (word → meaning or meaning → word), 10 / 20 / all questions, with a result screen that lists the missed words, and with wrong/correct answers feeding the spaced-repetition schedule from P2.

**Architecture:** All logic is pure and unit-tested: question generation (distractor choice, part-of-speech preference, duplicate-meaning safety), a quiz-session reducer, and the rule that turns an answer into an SRS grade. One thin React page (`/quiz/:dictId`: setup → questions → result) calls those modules and `reviewCard` from P2. Nothing new is stored in the database.

**Tech Stack:** React 18, TypeScript (target es5, strict), jotai 2.1 (`atomWithStorage`), react-hotkeys-hook 4, SWR, Dexie 3.2, Vitest 0.34 (jsdom) + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-12-study-modes-design.md` (section "P3 — Multiple-choice quiz"; it builds on P1 and P2).

## Global Constraints

Copied from the spec; every task implicitly includes them.

- Personal use only: everything in the browser (IndexedDB), no backend, no sharing, no accounts.
- Route `/quiz/:dictId`.
- Question: word → pick the meaning, or meaning → pick the word (toggle). **4 options.**
- Distractors: random words from the same set; **prefer the same part-of-speech prefix** (`n.`, `v.`, `adj.`, …) when the meaning starts with one.
- If the set has too few words the quiz is **unavailable with a message** (spec: fewer than 4 words).
- Length: **10 / 20 / all**. The result screen **lists the missed words**.
- SRS effect: a **wrong** answer records `again`; a **correct** answer records `good` **only if the card is currently due**. Correct answers on non-due cards only count toward the session score.
- Learning data is keyed by `(dictionary id, word)`; `reviewCard(dict, word, grade, now?)` from P2 is the only writer.
- Out of scope: sharing, accounts/sync, quiz history/statistics, timers, mobile layout, editing built-ins.
- Code style: Prettier (no semicolons, single quotes, width 140, import-sorting plugin) — run `npx prettier --write <files>` before every commit. TypeScript target is `es5`: no spreading/iterating `Map`/`Set` iterators (use `Array.from`, `forEach`).
- Branch: `feat/study-modes` (P1 and P2 are already committed on it).

## Decisions made while planning (fill gaps in the spec)

1. **"Fewer than 4 words" is made precise:** the quiz is available when at least **4 distinct meanings** exist among the set's words that have a meaning. That is what guarantees 3 distractors whose text differs from the answer; a set of 5 words that all mean the same thing cannot be quizzed.
2. **Which words are asked:** a random sample of the requested length from the set's words, de-duplicated by name; words with no meaning are excluded. Length larger than the set uses every word.
3. **Option text:** a word's meaning is all its meanings joined with `; `; in the reverse direction the option is the word's name.
4. **Duplicate meanings are never ambiguous:** a distractor is rejected if its meaning text equals the answer's meaning text (so two words that mean the same thing never appear together as "right" and "wrong"), and distractors are de-duplicated by option text.
5. **Part-of-speech preference:** the tag is the leading `n.` / `adj.` / `adv.` / `v.` … of the first meaning (`vt.`/`vi.` count as `v`). Distractors are taken first from words with the same tag, then from the rest.
6. **SRS effect rule** (`srsEffect`): wrong → `again` (this also _introduces_ a never-studied word as a learning card and so uses up one of the day's new-card slots — a consequence of the spec rule); correct → `good` only if a row exists and is due (`due <= now`, a non-numeric `due` counts as due now), otherwise nothing is written.
7. **Interaction:** keys `1`–`4` choose, `Enter`/`Space` go to the next question; after choosing, the right option turns green and a wrong choice red. A second choice on the same question and a second "next" are ignored (reducer is idempotent).
8. **Settings:** length (`10` | `20` | `all`, default 10) and direction are stored with `atomWithStorage`; a tampered stored length is sanitised to a valid one.
9. **Entry points** for custom sets only (like Study): a "Quiz" button in `/my-sets` and a "Quiz" link next to "Study" in the typing page's dictionary menu. The route works for any dictionary id.
10. **No Playwright test** (the project's e2e config targets the production site). Verification = Vitest for all logic + a manual browser pass (Task 4).

## Review Focus

Inputs/conditions the spec implies but does not spell out, most likely to bite first. Each has a test in the owning task.

1. **Duplicate meanings across words:** the answer's meaning must never appear twice among the options and a word with the same meaning must never be offered as a distractor — Task 1.
2. **Sets that cannot be quizzed:** fewer than 4 distinct meanings, words without any meaning, repeated names — must give "unavailable" (no crash, no empty/duplicate options) — Task 1.
3. **Length edge cases:** 20 questions asked of a 12-word set uses 12; `all`; a stored length that is garbage (`'abc'`, `0`, `9999`) falls back to a valid value — Tasks 1 and 3.
4. **Rapid input:** double-click / key repeat on an option or on "next" records one answer, one SRS write and skips no question — Task 2 (reducer idempotence) and Task 3 (the page reads the session from a ref).
5. **SRS effect:** wrong → `again`; correct on a due card → `good`; correct on a new or not-due card → nothing; corrupt `due` counts as due — Task 2.

## File Structure

Create:

- `src/utils/quiz/questions.ts` (+ `questions.test.ts`) — `meaningText`, `posTag`, `quizWords`, `canQuiz`, `buildQuiz`, `sanitizeQuizLength`.
- `src/utils/quiz/session.ts` (+ `session.test.ts`) — quiz session reducer and summary.
- `src/utils/quiz/effect.ts` (+ `effect.test.ts`) — `srsEffect`.
- `src/store/quiz.ts` — `quizLengthAtom`, `quizDirectionAtom`.
- `src/hooks/useDictionaryWords.ts` — resolve a dictionary id and load its words.
- `src/pages/Quiz/index.tsx` (route + data), `src/pages/Quiz/Setup.tsx`, `src/pages/Quiz/QuizRun.tsx`.

Modify:

- `src/utils/srs/queue.ts` — export `isDue`.
- `src/index.tsx` — route `/quiz/:dictId`.
- `src/pages/MySets/index.tsx` — "Quiz" button.
- `src/pages/Typing/components/DictChapterButton/index.tsx` — "Quiz" link for custom sets.

---

### Task 1: Question generation (`questions.ts`)

**Files:**

- Create: `src/utils/quiz/questions.ts`
- Test: `src/utils/quiz/questions.test.ts`

**Interfaces:**

- Consumes: `Word` from `@/typings`.
- Produces (exact signatures later tasks use):

  - `type QuizDirection = 'word-to-meaning' | 'meaning-to-word'`
  - `type QuizLength = 10 | 20 | 'all'`
  - `type QuizQuestion = { word: Word; direction: QuizDirection; prompt: string; options: string[]; answerIndex: number }`
  - `OPTION_COUNT = 4`, `MIN_DISTINCT_MEANINGS = 4`
  - `meaningText(word: Word): string`
  - `posTag(word: Word): string | null`
  - `quizWords(words: Word[]): Word[]` (de-duplicated by name, words with no meaning removed)
  - `canQuiz(words: Word[]): boolean` (takes the raw word list)
  - `sanitizeQuizLength(value: unknown): QuizLength`
  - `buildQuiz(input: { words: Word[]; length: QuizLength; direction: QuizDirection; rng?: () => number }): QuizQuestion[]` (empty when `canQuiz` is false)

- [ ] **Step 1: Write the failing tests**

Create `src/utils/quiz/questions.test.ts`:

```ts
import { OPTION_COUNT, buildQuiz, canQuiz, meaningText, posTag, quizWords, sanitizeQuizLength } from './questions'
import type { QuizDirection } from './questions'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

const word = (name: string, ...trans: string[]): Word => ({ name, trans, usphone: '', ukphone: '' })

// Small seeded generator so the "random" choices are reproducible
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const nouns = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((n) => word(n, `n. meaning of ${n}`))
const verbs = ['v1', 'v2', 'v3'].map((n) => word(n, `v. meaning of ${n}`))
const pool = [...nouns, ...verbs]

describe('meaningText / posTag', () => {
  it('joins all meanings with ; and trims', () => {
    expect(meaningText(word('a', ' n. một ', 'v. hai '))).toBe('n. một; v. hai')
    expect(meaningText(word('a'))).toBe('')
  })

  it('reads the leading part-of-speech tag, with vt./vi. counting as v', () => {
    expect(posTag(word('a', 'adj. nghiêm ngặt'))).toBe('adj')
    expect(posTag(word('a', 'N. danh từ'))).toBe('n')
    expect(posTag(word('a', 'vt. làm'))).toBe('v')
    expect(posTag(word('a', 'vi. đi'))).toBe('v')
    expect(posTag(word('a', 'không có tag'))).toBeNull()
    expect(posTag(word('a'))).toBeNull()
  })
})

describe('quizWords / canQuiz', () => {
  it('drops words without a meaning and repeated names', () => {
    const words = [word('a', 'x'), word('a', 'y'), word('b'), word('c', '  ')]
    expect(quizWords(words).map((w) => w.name)).toEqual(['a'])
  })

  it('needs at least 4 distinct meanings', () => {
    expect(canQuiz([word('a', 'x'), word('b', 'y'), word('c', 'z')])).toBe(false)
    expect(canQuiz([word('a', 'x'), word('b', 'x'), word('c', 'x'), word('d', 'x'), word('e', 'x')])).toBe(false)
    expect(canQuiz([word('a', 'x'), word('b', 'y'), word('c', 'z'), word('d', 'w')])).toBe(true)
    expect(canQuiz([])).toBe(false)
  })
})

describe('sanitizeQuizLength', () => {
  it('only accepts 10, 20 or all', () => {
    expect(sanitizeQuizLength(10)).toBe(10)
    expect(sanitizeQuizLength(20)).toBe(20)
    expect(sanitizeQuizLength('all')).toBe('all')
    expect(sanitizeQuizLength('20')).toBe(20)
    for (const bad of ['abc', 0, 9999, -1, null, undefined, NaN, {}]) expect(sanitizeQuizLength(bad)).toBe(10)
  })
})

describe('buildQuiz', () => {
  it('returns no questions when the set cannot be quizzed', () => {
    expect(buildQuiz({ words: [word('a', 'x'), word('b', 'y'), word('c', 'z')], length: 10, direction: 'word-to-meaning' })).toEqual([])
  })

  it.each(['word-to-meaning', 'meaning-to-word'] as QuizDirection[])(
    '%s: every question has 4 distinct options and answerIndex points at the right one',
    (direction) => {
      for (let seed = 1; seed <= 20; seed++) {
        const questions = buildQuiz({ words: pool, length: 'all', direction, rng: seeded(seed) })
        expect(questions).toHaveLength(pool.length)
        questions.forEach((q) => {
          expect(q.options).toHaveLength(OPTION_COUNT)
          expect(new Set(q.options).size).toBe(OPTION_COUNT)
          const correct = direction === 'word-to-meaning' ? meaningText(q.word) : q.word.name
          expect(q.options[q.answerIndex]).toBe(correct)
          expect(q.prompt).toBe(direction === 'word-to-meaning' ? q.word.name : meaningText(q.word))
          expect(q.direction).toBe(direction)
        })
      }
    },
  )

  it('asks each word at most once and honours the length', () => {
    const many = Array.from({ length: 25 }, (_, i) => word(`w${i}`, `n. meaning ${i}`))
    const ten = buildQuiz({ words: many, length: 10, direction: 'word-to-meaning', rng: seeded(3) })
    expect(ten).toHaveLength(10)
    expect(new Set(ten.map((q) => q.word.name)).size).toBe(10)
    expect(buildQuiz({ words: many, length: 'all', direction: 'word-to-meaning', rng: seeded(3) })).toHaveLength(25)
  })

  it('uses every word when the requested length is larger than the set', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => word(`w${i}`, `meaning ${i}`))
    expect(buildQuiz({ words: twelve, length: 20, direction: 'meaning-to-word', rng: seeded(5) })).toHaveLength(12)
  })

  it('never offers a word with the same meaning as the answer, and never repeats an option text', () => {
    const words = [
      word('big', 'adj. lớn'),
      word('large', 'adj. lớn'), // same meaning as "big"
      word('small', 'adj. nhỏ'),
      word('tiny', 'adj. rất nhỏ'),
      word('huge', 'adj. khổng lồ'),
      word('hot', 'adj. nóng'),
    ]
    for (let seed = 1; seed <= 30; seed++) {
      for (const direction of ['word-to-meaning', 'meaning-to-word'] as QuizDirection[]) {
        buildQuiz({ words, length: 'all', direction, rng: seeded(seed) }).forEach((q) => {
          expect(new Set(q.options).size).toBe(OPTION_COUNT)
          if (direction === 'word-to-meaning') {
            // "adj. lớn" is the answer of big and large, and must never show up a second time as a distractor
            const count = q.options.filter((o) => o === 'adj. lớn').length
            if (q.word.name === 'big' || q.word.name === 'large') expect(count).toBe(1)
            else expect(count).toBeLessThanOrEqual(1)
          } else if (q.word.name === 'big') {
            expect(q.options).not.toContain('large') // large is an equally right answer
          } else if (q.word.name === 'large') {
            expect(q.options).not.toContain('big')
          }
        })
      }
    }
  })

  it('prefers distractors with the same part of speech', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const questions = buildQuiz({ words: pool, length: 'all', direction: 'meaning-to-word', rng: seeded(seed) })
      const nounQuestion = questions.find((q) => q.word.name === 'n1')
      // 5 other nouns exist, so all 3 distractors must be nouns
      expect(nounQuestion?.options.every((o) => o.startsWith('n'))).toBe(true)
      const verbQuestion = questions.find((q) => q.word.name === 'v1')
      // only 2 other verbs exist: both must be among the options, the third distractor is a noun
      const verbOptions = verbQuestion?.options.filter((o) => o.startsWith('v')) ?? []
      expect(verbOptions.sort()).toEqual(['v1', 'v2', 'v3'])
    }
  })

  it('is reproducible for the same seed and does not mutate its input', () => {
    const before = JSON.stringify(pool)
    const a = buildQuiz({ words: pool, length: 'all', direction: 'word-to-meaning', rng: seeded(9) })
    const b = buildQuiz({ words: pool, length: 'all', direction: 'word-to-meaning', rng: seeded(9) })
    expect(a).toEqual(b)
    expect(JSON.stringify(pool)).toBe(before)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test src/utils/quiz/questions.test.ts`
Expected: FAIL — cannot find module `./questions`.

- [ ] **Step 3: Implement `questions.ts`**

Create `src/utils/quiz/questions.ts`:

```ts
import type { Word } from '@/typings'

export type QuizDirection = 'word-to-meaning' | 'meaning-to-word'
export type QuizLength = 10 | 20 | 'all'
export type QuizQuestion = { word: Word; direction: QuizDirection; prompt: string; options: string[]; answerIndex: number }

export const OPTION_COUNT = 4
export const MIN_DISTINCT_MEANINGS = 4
const DEFAULT_LENGTH: QuizLength = 10

/** All meanings of a word as one string (the text of a "meaning" option). */
export function meaningText(word: Word): string {
  return word.trans
    .map((meaning) => meaning.trim())
    .filter(Boolean)
    .join('; ')
}

/** Leading part-of-speech tag of the first meaning (`n.`, `adj.`, `vt.` …), lower-case; `vt`/`vi` count as `v`. */
export function posTag(word: Word): string | null {
  const first = word.trans[0]
  if (typeof first !== 'string') return null
  const match = /^([A-Za-z]{1,6})\./.exec(first.trim())
  if (!match) return null
  const tag = match[1].toLowerCase()
  return tag === 'vt' || tag === 'vi' ? 'v' : tag
}

/** Words that can be asked: de-duplicated by name (first wins) and with at least one meaning. */
export function quizWords(words: Word[]): Word[] {
  const seen = new Set<string>()
  const result: Word[] = []
  words.forEach((word) => {
    if (seen.has(word.name) || meaningText(word) === '') return
    seen.add(word.name)
    result.push(word)
  })
  return result
}

/** A set can be quizzed when it has at least 4 distinct meanings (so 3 distractors that differ from the answer always exist). */
export function canQuiz(words: Word[]): boolean {
  return new Set(quizWords(words).map(meaningText)).size >= MIN_DISTINCT_MEANINGS
}

export function sanitizeQuizLength(value: unknown): QuizLength {
  if (value === 'all') return 'all'
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return n === 10 || n === 20 ? n : DEFAULT_LENGTH
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

const optionText = (word: Word, direction: QuizDirection) => (direction === 'word-to-meaning' ? meaningText(word) : word.name)

function makeQuestion(word: Word, pool: Word[], direction: QuizDirection, rng: () => number): QuizQuestion {
  const answerMeaning = meaningText(word)
  const correct = optionText(word, direction)

  // A word with the same meaning would be an equally right answer, and options must not repeat their text
  const seenTexts = new Set<string>([correct])
  const candidates = pool.filter((other) => {
    if (other.name === word.name || meaningText(other) === answerMeaning) return false
    const text = optionText(other, direction)
    if (seenTexts.has(text)) return false
    seenTexts.add(text)
    return true
  })

  const tag = posTag(word)
  const sameTag = tag === null ? [] : candidates.filter((other) => posTag(other) === tag)
  const rest = candidates.filter((other) => sameTag.indexOf(other) === -1)
  const distractors = shuffle(sameTag, rng)
    .concat(shuffle(rest, rng))
    .slice(0, OPTION_COUNT - 1)

  const options = shuffle([correct].concat(distractors.map((other) => optionText(other, direction))), rng)
  return {
    word,
    direction,
    prompt: direction === 'word-to-meaning' ? word.name : answerMeaning,
    options,
    answerIndex: options.indexOf(correct),
  }
}

/** A random sample of the set, one question per word. Empty when the set cannot be quizzed. */
export function buildQuiz(input: { words: Word[]; length: QuizLength; direction: QuizDirection; rng?: () => number }): QuizQuestion[] {
  const rng = input.rng ?? Math.random
  const pool = quizWords(input.words)
  if (!canQuiz(pool)) return []
  const count = input.length === 'all' ? pool.length : Math.min(input.length, pool.length)
  return shuffle(pool, rng)
    .slice(0, count)
    .map((word) => makeQuestion(word, pool, input.direction, rng))
}
```

- [ ] **Step 4: Run the tests**

Run: `yarn test src/utils/quiz`
Expected: all PASS. If the part-of-speech test fails for the verb question, the preference order is wrong (same-tag candidates must come before the rest); if the duplicate-meaning test fails, the candidate filter is wrong — fix the code, not the test.

- [ ] **Step 5: Lint, type-check, commit**

Run: `npx eslint src/utils/quiz && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: no eslint errors; tsc count `4` (the four pre-existing errors).

```bash
npx prettier --write src/utils/quiz
git add src/utils/quiz
git commit -m "feat: add multiple-choice question generation"
```

(The pre-commit hook runs eslint/prettier; if it fails the commit did not happen — fix and commit again before continuing.)

---

### Task 2: Quiz session and the SRS effect

**Files:**

- Create: `src/utils/quiz/session.ts`, `src/utils/quiz/effect.ts`
- Modify: `src/utils/srs/queue.ts` (export `isDue`)
- Test: `src/utils/quiz/session.test.ts`, `src/utils/quiz/effect.test.ts`

**Interfaces:**

- Consumes: `QuizQuestion` (Task 1); `Word`; `ICardProgress` from `@/utils/db/record`; `Grade` from `@/utils/srs/scheduler`.
- Produces:

  - `queue.ts`: `isDue(card: ICardProgress, now: number): boolean` (a non-numeric `due` counts as due now; `buildQueue` and `nextDueTime` keep using the same rule).
  - `session.ts`: `type QuizResult = { word: Word; correct: boolean }`, `type QuizSession = { questions: QuizQuestion[]; index: number; selected: number | null; results: QuizResult[] }`, `createQuizSession(questions): QuizSession`, `currentQuestion(session): QuizQuestion | undefined`, `isComplete(session): boolean`, `choose(session, optionIndex: number): QuizSession`, `next(session): QuizSession`, `quizSummary(session): { total: number; correct: number; missed: Word[] }`.
  - `effect.ts`: `srsEffect(correct: boolean, card: ICardProgress | undefined, now: number): Grade | null`.

- [ ] **Step 1: Write the failing tests for `srsEffect`**

Create `src/utils/quiz/effect.test.ts`:

```ts
import { srsEffect } from './effect'
import type { ICardProgress } from '@/utils/db/record'
import { describe, expect, it } from 'vitest'

const NOW = new Date(2026, 9, 12, 15, 30).getTime()
const card = (over: Partial<ICardProgress> = {}): ICardProgress => ({
  dict: 'd',
  word: 'w',
  state: 'review',
  due: NOW - 1000,
  interval: 3,
  ease: 2.5,
  reps: 1,
  lapses: 0,
  firstSeen: 1,
  lastReviewed: 2,
  ...over,
})

describe('srsEffect', () => {
  it('a wrong answer is always "again", even for a card that was never studied', () => {
    expect(srsEffect(false, undefined, NOW)).toBe('again')
    expect(srsEffect(false, card(), NOW)).toBe('again')
    expect(srsEffect(false, card({ due: NOW + 99999 }), NOW)).toBe('again')
  })

  it('a correct answer is "good" only when the card is due', () => {
    expect(srsEffect(true, card({ due: NOW - 1 }), NOW)).toBe('good')
    expect(srsEffect(true, card({ due: NOW }), NOW)).toBe('good')
  })

  it('a correct answer on a new or not-yet-due card writes nothing', () => {
    expect(srsEffect(true, undefined, NOW)).toBeNull()
    expect(srsEffect(true, card({ due: NOW + 1 }), NOW)).toBeNull()
  })

  it('a corrupt (non-numeric) due counts as due now', () => {
    expect(srsEffect(true, card({ due: NaN }), NOW)).toBe('good')
  })
})
```

- [ ] **Step 2: Write the failing tests for the session**

Create `src/utils/quiz/session.test.ts`:

```ts
import type { QuizQuestion } from './questions'
import { choose, createQuizSession, currentQuestion, isComplete, next, quizSummary } from './session'
import { describe, expect, it } from 'vitest'

const question = (name: string, answerIndex = 1): QuizQuestion => ({
  word: { name, trans: ['x'], usphone: '', ukphone: '' },
  direction: 'word-to-meaning',
  prompt: name,
  options: ['o0', 'o1', 'o2', 'o3'],
  answerIndex,
})

describe('quiz session', () => {
  it('starts on the first question with nothing selected', () => {
    const s = createQuizSession([question('a'), question('b')])
    expect(currentQuestion(s)?.word.name).toBe('a')
    expect(s).toMatchObject({ index: 0, selected: null, results: [] })
    expect(isComplete(s)).toBe(false)
  })

  it('choose records the result once and keeps the question until next', () => {
    const s = choose(createQuizSession([question('a'), question('b')]), 1)
    expect(s.selected).toBe(1)
    expect(s.results).toEqual([{ word: s.questions[0].word, correct: true }])
    expect(currentQuestion(s)?.word.name).toBe('a')
  })

  it('a wrong choice is recorded as incorrect', () => {
    const s = choose(createQuizSession([question('a')]), 3)
    expect(s.results[0].correct).toBe(false)
  })

  it('a second choice on the same question is ignored (double click / key repeat)', () => {
    const answered = choose(createQuizSession([question('a')]), 3)
    expect(choose(answered, 1)).toBe(answered)
  })

  it('an out-of-range or fractional option index is ignored', () => {
    const s = createQuizSession([question('a')])
    expect(choose(s, 4)).toBe(s)
    expect(choose(s, -1)).toBe(s)
    expect(choose(s, 1.5)).toBe(s)
  })

  it('next is ignored until the question was answered, then moves on once', () => {
    const s = createQuizSession([question('a'), question('b')])
    expect(next(s)).toBe(s)
    const moved = next(choose(s, 1))
    expect(currentQuestion(moved)?.word.name).toBe('b')
    expect(moved.selected).toBeNull()
    // a repeated "next" on the new, unanswered question changes nothing
    expect(next(moved)).toBe(moved)
  })

  it('completes after the last question and ignores further input', () => {
    let s = createQuizSession([question('a')])
    s = next(choose(s, 1))
    expect(isComplete(s)).toBe(true)
    expect(currentQuestion(s)).toBeUndefined()
    expect(choose(s, 1)).toBe(s)
    expect(next(s)).toBe(s)
  })

  it('summarises the score and lists the missed words in the order asked', () => {
    let s = createQuizSession([question('a'), question('b'), question('c')])
    s = next(choose(s, 1)) // a right
    s = next(choose(s, 0)) // b wrong
    s = next(choose(s, 2)) // c wrong
    const summary = quizSummary(s)
    expect(summary.total).toBe(3)
    expect(summary.correct).toBe(1)
    expect(summary.missed.map((w) => w.name)).toEqual(['b', 'c'])
  })

  it('does not mutate the previous session', () => {
    const s = createQuizSession([question('a')])
    const before = JSON.stringify(s)
    choose(s, 1)
    expect(JSON.stringify(s)).toBe(before)
  })
})
```

- [ ] **Step 3: Run to verify both fail**

Run: `yarn test src/utils/quiz/effect.test.ts src/utils/quiz/session.test.ts`
Expected: FAIL — cannot find modules `./effect` and `./session`.

- [ ] **Step 4: Export `isDue` from `queue.ts`**

In `src/utils/srs/queue.ts` replace

```ts
const dueOf = (card: ICardProgress) => (Number.isFinite(card.due) ? card.due : 0)
```

with

```ts
const dueOf = (card: ICardProgress) => (Number.isFinite(card.due) ? card.due : 0)

/** Whether a card is due at `now` (a non-numeric `due` counts as due now). */
export function isDue(card: ICardProgress, now: number): boolean {
  return dueOf(card) <= now
}
```

and in `buildQueue` change `else if (dueOf(card) <= input.now) due.push({ word, due: dueOf(card) })` to `else if (isDue(card, input.now)) due.push({ word, due: dueOf(card) })`.

- [ ] **Step 5: Implement `effect.ts` and `session.ts`**

Create `src/utils/quiz/effect.ts`:

```ts
import type { ICardProgress } from '@/utils/db/record'
import { isDue } from '@/utils/srs/queue'
import type { Grade } from '@/utils/srs/scheduler'

/**
 * The SRS grade an answer should record, or null when nothing should be written.
 * Wrong → again (this also introduces a never-studied word as a learning card).
 * Correct → good, but only for a card that is currently due; otherwise the answer only counts toward the quiz score.
 */
export function srsEffect(correct: boolean, card: ICardProgress | undefined, now: number): Grade | null {
  if (!correct) return 'again'
  return card !== undefined && isDue(card, now) ? 'good' : null
}
```

Create `src/utils/quiz/session.ts`:

```ts
import type { QuizQuestion } from './questions'
import type { Word } from '@/typings'

export type QuizResult = { word: Word; correct: boolean }
export type QuizSession = { questions: QuizQuestion[]; index: number; selected: number | null; results: QuizResult[] }

export function createQuizSession(questions: QuizQuestion[]): QuizSession {
  return { questions, index: 0, selected: null, results: [] }
}

export function currentQuestion(session: QuizSession): QuizQuestion | undefined {
  return session.questions[session.index]
}

export function isComplete(session: QuizSession): boolean {
  return session.index >= session.questions.length
}

/** Answers the current question. Ignored when finished, already answered, or the index is not one of the options. */
export function choose(session: QuizSession, optionIndex: number): QuizSession {
  const question = currentQuestion(session)
  if (!question || session.selected !== null) return session
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return session
  return {
    ...session,
    selected: optionIndex,
    results: session.results.concat({ word: question.word, correct: optionIndex === question.answerIndex }),
  }
}

/** Moves to the next question. Ignored until the current question has been answered. */
export function next(session: QuizSession): QuizSession {
  if (isComplete(session) || session.selected === null) return session
  return { ...session, index: session.index + 1, selected: null }
}

export function quizSummary(session: QuizSession): { total: number; correct: number; missed: Word[] } {
  return {
    total: session.results.length,
    correct: session.results.filter((r) => r.correct).length,
    missed: session.results.filter((r) => !r.correct).map((r) => r.word),
  }
}
```

- [ ] **Step 6: Run all tests, lint, type-check, commit**

Run: `yarn test && npx eslint src/utils && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: all tests PASS (the existing queue tests prove `isDue` did not change behaviour); no eslint errors; tsc count `4`.

```bash
npx prettier --write src/utils/quiz src/utils/srs/queue.ts
git add src/utils/quiz src/utils/srs/queue.ts
git commit -m "feat: add quiz session reducer and SRS effect of quiz answers"
```

---

### Task 3: Quiz page (store, data hook, setup, questions, result, route)

**Files:**

- Create: `src/store/quiz.ts`, `src/hooks/useDictionaryWords.ts`, `src/pages/Quiz/index.tsx`, `src/pages/Quiz/Setup.tsx`, `src/pages/Quiz/QuizRun.tsx`
- Modify: `src/index.tsx`

**Interfaces:**

- Consumes: `buildQuiz`, `canQuiz`, `quizWords`, `sanitizeQuizLength`, `QuizDirection`, `QuizLength`, `QuizQuestion` (Task 1); `createQuizSession`, `currentQuestion`, `isComplete`, `choose`, `next`, `quizSummary`, `QuizSession` (Task 2); `srsEffect` (Task 2); `getDictProgress`, `reviewCard` from `@/utils/db/card-progress` (P2); `lookupDictionary`, `dictionaryByIdAtom`, `customDictionariesLoadedAtom`, `isCustomDictPending` from `@/store/customDicts` (P1); `wordListFetcher`; `Layout`, `Button`.
- Produces: route `/quiz/:dictId`; atoms `quizLengthAtom`, `quizDirectionAtom`; hook `useDictionaryWords(id): { dict: Dictionary | undefined; words: Word[] | undefined; error: unknown }`.

This task is UI; there is no unit test for the components (all the logic they call is covered in Tasks 1–2). It is verified by type-check, lint, the existing suite and the manual pass in Task 4.

- [ ] **Step 1: Settings atoms**

Create `src/store/quiz.ts`:

```ts
import type { QuizDirection, QuizLength } from '@/utils/quiz/questions'
import { atomWithStorage } from 'jotai/utils'

/** Number of questions. Always pass the value through `sanitizeQuizLength` before using it. */
export const quizLengthAtom = atomWithStorage<QuizLength>('quizLength', 10)

export const quizDirectionAtom = atomWithStorage<QuizDirection>('quizDirection', 'word-to-meaning')
```

- [ ] **Step 2: Data hook**

Create `src/hooks/useDictionaryWords.ts`:

```ts
import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending, lookupDictionary } from '@/store/customDicts'
import type { Dictionary, Word } from '@/typings'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'

/**
 * Resolves a dictionary id (built-in or custom) and loads its words.
 * Unknown ids redirect to the Gallery; a custom id is given time to load before it is judged unknown.
 */
export function useDictionaryWords(id: string): { dict: Dictionary | undefined; words: Word[] | undefined; error: unknown } {
  const navigate = useNavigate()
  const dictionaryById = useAtomValue(dictionaryByIdAtom)
  const customLoaded = useAtomValue(customDictionariesLoadedAtom)
  const dict = lookupDictionary(dictionaryById, id)
  const pending = isCustomDictPending(id, customLoaded)

  useEffect(() => {
    if (!dict && !pending) navigate('/gallery', { replace: true })
  }, [dict, pending, navigate])

  const { data: words, error } = useSWR(dict ? dict.url : null, wordListFetcher)
  return { dict, words, error }
}
```

- [ ] **Step 3: Setup screen**

Create `src/pages/Quiz/Setup.tsx`:

```tsx
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import type { QuizDirection, QuizLength } from '@/utils/quiz/questions'

type Props = {
  dictName: string
  available: boolean
  wordCount: number
  length: QuizLength
  onLengthChange: (value: QuizLength) => void
  direction: QuizDirection
  onDirectionChange: (value: QuizDirection) => void
  onStart: () => void
  onBack: () => void
}

const LENGTHS: { value: QuizLength; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'All' },
]

export default function QuizSetup({
  dictName,
  available,
  wordCount,
  length,
  onLengthChange,
  direction,
  onDirectionChange,
  onStart,
  onBack,
}: Props) {
  return (
    <Layout>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{dictName}</h1>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>

        {!available ? (
          <p className="rounded-lg bg-white p-6 text-gray-600 shadow dark:bg-gray-800 dark:text-gray-300">
            This set cannot be quizzed yet: it needs at least 4 words with different meanings ({wordCount} usable words found).
          </p>
        ) : (
          <div className="space-y-5 rounded-lg bg-white p-6 text-sm text-gray-700 shadow dark:bg-gray-800 dark:text-gray-300">
            <div className="flex items-center justify-between gap-4">
              <span>Questions</span>
              <div className="flex gap-2" role="radiogroup" aria-label="Number of questions">
                {LENGTHS.map((option) => (
                  <Button
                    key={String(option.value)}
                    size="sm"
                    variant={length === option.value ? 'default' : 'outline'}
                    role="radio"
                    aria-checked={length === option.value}
                    onClick={() => onLengthChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-4">
              <span>Show the meaning first (pick the word)</span>
              <input
                type="checkbox"
                checked={direction === 'meaning-to-word'}
                onChange={(e) => onDirectionChange(e.target.checked ? 'meaning-to-word' : 'word-to-meaning')}
              />
            </label>
            <Button onClick={onStart}>Start quiz</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
```

- [ ] **Step 4: Question / result screen**

Create `src/pages/Quiz/QuizRun.tsx`:

```tsx
import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import { reviewCard } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { srsEffect } from '@/utils/quiz/effect'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { choose, createQuizSession, currentQuestion, isComplete, next, quizSummary } from '@/utils/quiz/session'
import type { QuizSession } from '@/utils/quiz/session'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

type Props = {
  dictId: string
  questions: QuizQuestion[]
  progress: ICardProgress[]
  onRestart: () => void
  onBack: () => void
}

export default function QuizRun({ dictId, questions, progress, onRestart, onBack }: Props) {
  const [session, setSession] = useState(() => createQuizSession(questions))
  // The guards read this ref (updated synchronously) so a double click or a repeating key cannot answer twice
  const sessionRef = useRef(session)
  const update = useCallback((nextSession: QuizSession) => {
    sessionRef.current = nextSession
    setSession(nextSession)
  }, [])
  const cards = useMemo(() => new Map(progress.map((card): [string, ICardProgress] => [card.word, card])), [progress])
  const [error, setError] = useState('')

  const onChoose = useCallback(
    (optionIndex: number) => {
      const before = sessionRef.current
      const question = currentQuestion(before)
      const after = choose(before, optionIndex)
      if (!question || after === before) return
      update(after)

      const correct = optionIndex === question.answerIndex
      const grade = srsEffect(correct, cards.get(question.word.name), Date.now())
      if (grade) {
        reviewCard(dictId, question.word.name, grade).catch((e) => setError(e instanceof Error ? e.message : 'Could not save your answer'))
      }
    },
    [cards, dictId, update],
  )

  const onNext = useCallback(() => update(next(sessionRef.current)), [update])

  useHotkeys('1', () => onChoose(0), [onChoose])
  useHotkeys('2', () => onChoose(1), [onChoose])
  useHotkeys('3', () => onChoose(2), [onChoose])
  useHotkeys('4', () => onChoose(3), [onChoose])
  useHotkeys('enter,space', onNext, { preventDefault: true }, [onNext])

  const question = currentQuestion(session)

  if (isComplete(session) || !question) {
    const summary = quizSummary(session)
    return (
      <Layout>
        <div className="flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm text-gray-500">Quiz finished</p>
            <p className="text-4xl font-medium text-gray-800 dark:text-gray-100">
              {summary.correct} / {summary.total}
            </p>
          </div>

          {summary.missed.length > 0 ? (
            <div className="space-y-2 rounded-lg bg-white p-6 shadow dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Missed words</p>
              <ul className="max-h-72 space-y-2 overflow-y-auto">
                {summary.missed.map((word) => (
                  <li key={word.name} className="text-gray-800 dark:text-gray-100">
                    <span className="font-medium">{word.name}</span>
                    <span className="text-gray-500"> — {word.trans.join('; ')}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-emerald-600">No mistakes. Well done!</p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button onClick={onRestart}>Try again</Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  const answered = session.selected !== null
  const correctSoFar = session.results.filter((r) => r.correct).length

  return (
    <Layout>
      <div className="flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            {session.index + 1} / {session.questions.length} · {correctSoFar} correct
          </span>
          <Button size="sm" variant="outline" onClick={onBack}>
            Exit
          </Button>
        </div>

        <div className="flex min-h-[10rem] w-full items-center justify-center rounded-xl bg-white p-8 text-center shadow dark:bg-gray-800">
          <span
            className={`${question.direction === 'word-to-meaning' ? 'text-5xl' : 'text-2xl'} font-medium text-gray-800 dark:text-gray-100`}
          >
            {question.prompt}
          </span>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2">
          {question.options.map((option, index) => {
            const isAnswer = index === question.answerIndex
            const isChosen = index === session.selected
            const style = !answered
              ? 'bg-white text-gray-800 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
              : isAnswer
              ? 'bg-emerald-500 text-white'
              : isChosen
              ? 'bg-red-500 text-white'
              : 'bg-white text-gray-400 dark:bg-gray-800'
            return (
              <button
                key={index}
                disabled={answered}
                onClick={() => onChoose(index)}
                className={`rounded-lg px-4 py-3 text-left shadow transition-colors ${style}`}
              >
                <span className="mr-2 text-xs opacity-70">{index + 1}</span>
                {option}
              </button>
            )
          })}
        </div>

        <p className="sr-only" aria-live="polite">
          {answered
            ? session.selected === question.answerIndex
              ? 'Correct'
              : `Wrong. The answer is ${question.options[question.answerIndex]}`
            : question.prompt}
        </p>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button disabled={!answered} onClick={onNext}>
          {session.index + 1 === session.questions.length ? 'Finish' : 'Next'} (Enter)
        </Button>
      </div>
    </Layout>
  )
}
```

- [ ] **Step 5: Route container**

Create `src/pages/Quiz/index.tsx`:

```tsx
import QuizRun from './QuizRun'
import QuizSetup from './Setup'
import Layout from '@/components/Layout'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { quizDirectionAtom, quizLengthAtom } from '@/store/quiz'
import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { buildQuiz, canQuiz, quizWords, sanitizeQuizLength } from '@/utils/quiz/questions'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

// Keyed by id so moving between two sets in place starts from a clean state
export default function QuizRoute() {
  const { dictId = '' } = useParams()
  return <Quiz key={dictId} id={dictId} />
}

function Quiz({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { dict, words, error } = useDictionaryWords(id)
  const [lengthStored, setLength] = useAtom(quizLengthAtom)
  const [direction, setDirection] = useAtom(quizDirectionAtom)
  const length = sanitizeQuizLength(lengthStored)

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [progress, setProgress] = useState<ICardProgress[]>([])
  // Bumped on every start so QuizRun remounts with a fresh session ("Try again")
  const [round, setRound] = useState(0)

  const usable = useMemo(() => (words ? quizWords(words) : []), [words])
  const available = useMemo(() => (words ? canQuiz(words) : false), [words])

  // `default` is the key of the first history entry: there is nothing to go back to, so fall back to the sets page
  const onBack = useCallback(() => (location.key === 'default' ? navigate('/my-sets') : navigate(-1)), [location.key, navigate])

  const start = useCallback(async () => {
    if (!words) return
    let rows: ICardProgress[] = []
    try {
      rows = await getDictProgress(id)
    } catch {
      // Without the progress rows answers still count toward the score; wrong answers are saved as usual
    }
    setProgress(rows)
    setRound((r) => r + 1)
    setQuestions(buildQuiz({ words, length, direction }))
  }, [words, id, length, direction])

  const message = (text: string, tone = 'text-gray-500') => (
    <Layout>
      <p className={`m-auto ${tone}`}>{text}</p>
    </Layout>
  )

  if (!dict) return message('Loading…')
  if (error) return message('Could not load the words of this set.', 'text-red-600')
  if (!words) return message('Loading…')

  if (questions && questions.length > 0) {
    return <QuizRun key={round} dictId={id} questions={questions} progress={progress} onRestart={start} onBack={() => setQuestions(null)} />
  }

  return (
    <QuizSetup
      dictName={dict.name}
      available={available}
      wordCount={usable.length}
      length={length}
      onLengthChange={setLength}
      direction={direction}
      onDirectionChange={setDirection}
      onStart={start}
      onBack={onBack}
    />
  )
}
```

- [ ] **Step 6: Add the route**

In `src/index.tsx` add below the other lazy pages:

```tsx
const QuizPage = lazy(() => import('./pages/Quiz'))
```

and inside the non-mobile routes, after the `/study/:dictId` route:

```tsx
<Route path="/quiz/:dictId" element={<QuizPage />} />
```

- [ ] **Step 7: Verify**

Run: `npx prettier --write src/store/quiz.ts src/hooks/useDictionaryWords.ts src/pages/Quiz src/index.tsx && npx eslint src && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn test`
Expected: no eslint errors; tsc count `4`; all tests PASS. If `tsc` objects to `Button` receiving `role`/`aria-checked`, they are standard HTML attributes of `ButtonHTMLAttributes` and must be accepted; if not, wrap the buttons in plain `<button>` elements with the same classes.

- [ ] **Step 8: Commit**

```bash
git add src/store/quiz.ts src/hooks/useDictionaryWords.ts src/pages/Quiz src/index.tsx
git commit -m "feat: add multiple-choice quiz page"
```

---

### Task 4: Entry points and end-to-end verification

**Files:**

- Modify: `src/pages/MySets/index.tsx`, `src/pages/Typing/components/DictChapterButton/index.tsx`

**Interfaces:**

- Consumes: route `/quiz/:dictId` (Task 3); `isCustomDictId` from `@/utils/db/custom-dict` (P1).
- Produces: user-visible buttons only.

- [ ] **Step 1: "Quiz" button in `/my-sets`**

In `src/pages/MySets/index.tsx`, inside each set's button group, add right after the existing Study button:

```tsx
<Button size="sm" onClick={() => navigate(`/quiz/${encodeURIComponent(dict.id)}`)}>
  Quiz
</Button>
```

- [ ] **Step 2: "Quiz" link in the typing page's dictionary menu**

In `src/pages/Typing/components/DictChapterButton/index.tsx`, directly after the existing "Study with flashcards" `Tooltip` block (the one guarded by `isCustomDictId(currentDictInfo.id) && !isReviewMode`), add:

```tsx
{
  isCustomDictId(currentDictInfo.id) && !isReviewMode && (
    <Tooltip content="Take a multiple-choice quiz">
      <NavLink
        className="block rounded-lg px-3 py-1 text-lg transition-colors duration-300 ease-in-out hover:bg-indigo-400 hover:text-white focus:outline-none dark:text-white dark:text-opacity-60 dark:hover:text-opacity-100"
        to={`/quiz/${encodeURIComponent(currentDictInfo.id)}`}
      >
        Quiz
      </NavLink>
    </Tooltip>
  )
}
```

- [ ] **Step 3: Static checks**

Run: `npx prettier --write src/pages/MySets/index.tsx src/pages/Typing/components/DictChapterButton/index.tsx && npx eslint . && npx tsc --noEmit 2>&1 | grep -c "error TS" && yarn test && yarn build`
Expected: no eslint errors; tsc count `4`; all tests PASS; the production build finishes.

- [ ] **Step 4: Manual pass in the browser (`yarn dev`, http://localhost:5173)**

Prepare data in the browser console (the dev server serves the modules): create a set of 30 words with parts of speech, a set of 3 words, and a set of 12 words, e.g.

```js
const cd = await import('/src/utils/db/custom-dict.ts')
const mk = (n, t) => ({ name: n, trans: [t], usphone: '', ukphone: '' })
await cd.createCustomDict({ name: 'Q30', words: Array.from({ length: 30 }, (_, i) => mk('w' + i, (i % 2 ? 'n. ' : 'v. ') + 'nghĩa ' + i)) })
await cd.createCustomDict({ name: 'Q3', words: [mk('a', 'x'), mk('b', 'y'), mk('c', 'z')] })
await cd.createCustomDict({ name: 'Q12', words: Array.from({ length: 12 }, (_, i) => mk('t' + i, 'nghĩa ' + i)) })
```

Then check each item and fix anything that fails:

1. `/my-sets` shows a **Quiz** button next to Study on each set; the typing page shows a **Quiz** link when a custom set is selected and not for a built-in dictionary.
2. Open the quiz of `Q30`: setup shows Questions `10 | 20 | All` and the "meaning first" checkbox; **Start quiz** → a question with a word prompt and 4 option buttons numbered 1–4; the header reads `1 / 10 · 0 correct`.
3. Press **2** (or click an option): the right option turns green, a wrong choice turns red and the other options dim; **Next (Enter)** is enabled; pressing a number again changes nothing; pressing **Enter** goes to question 2 and pressing Enter again does nothing (not answered yet).
4. Hold a number key / double-click an option → only one answer is counted (header counts `n correct` consistently) and no question is skipped.
5. Part-of-speech preference: in `Q30` the meanings of the options of a `n.` question are all `n.` (and the same for `v.`), since 15 words of each kind exist.
6. Answer everything → result screen shows `x / 10` and the missed words with their meanings; **Try again** starts a fresh quiz with different questions; **Back** returns to where you came from (`/my-sets` when opened from there).
7. Choose length **20** on `Q12` → the quiz has **12** questions; choose **All** on `Q30` → 30 questions. Tamper with `localStorage.quizLength` (`"abc"`, `0`, `9999`) and reload → the setup falls back to 10.
8. Tick "Show the meaning first": prompts are meanings and options are words.
9. `Q3` (3 words) → the quiz page says the set cannot be quizzed (needs at least 4 words with different meanings) and has no Start button.
10. SRS effect: in DevTools → IndexedDB → RecordDB → `cardProgress` start empty. Answer one question **wrong** → a row for that word appears (`state: learning`). Study that set in the flashcards so some cards are due (or insert a row with `due` in the past), then answer that word **correctly** in a quiz → its row gets `reps` +1 and moves to `review`; answer a never-studied word **correctly** → no row is created.
11. `/quiz/custom%3Anope` redirects to `/gallery`.

The console must show no new errors (the existing Youdao audio CORS error is expected).

- [ ] **Step 5: Record deviations and commit**

If the manual pass revealed a deviation from the spec, add a short "Findings from P3 implementation" note at the end of `docs/superpowers/specs/2026-10-12-study-modes-design.md`.

```bash
git add src/pages/MySets/index.tsx src/pages/Typing/components/DictChapterButton/index.tsx docs/superpowers/specs/2026-10-12-study-modes-design.md
git commit -m "feat: add Quiz entry points in My Sets and the typing page"
```

(`git add` of the spec file is harmless when it did not change.)

---

## Self-review

**Spec coverage (P3 section):**

- Word → meaning and meaning → word with a toggle, 4 options → Tasks 1 (`buildQuiz` both directions) and 3 (Setup checkbox).
- Distractors from the same set, preferring the same part-of-speech prefix → Task 1 (`posTag`, same-tag-first order, tested).
- "Fewer than 4 words → unavailable with a message" → Task 1 (`canQuiz`, made precise in Decision 1) and Task 3 (Setup message).
- Length 10 / 20 / all → Task 1 (`sanitizeQuizLength`, `buildQuiz`) and Task 3 (radio buttons).
- Result screen lists missed words → Task 2 (`quizSummary`) and Task 3 (`QuizRun` result).
- SRS effect (wrong → `again`; correct → `good` only if due) → Task 2 (`srsEffect`) and Task 3 (`onChoose` calls `reviewCard`).
- Route `/quiz/:dictId` and entry points → Tasks 3 and 4.

**Placeholder scan:** none; every code step contains full code. The one conditional is the note in Task 3 Step 7 about `Button` attributes, with the exact fallback.

**Type consistency:** `QuizDirection`, `QuizLength`, `QuizQuestion`, `buildQuiz`, `canQuiz`, `quizWords`, `sanitizeQuizLength` (Task 1) are used with the same names and signatures in Tasks 2–3; `QuizSession`, `createQuizSession`, `currentQuestion`, `isComplete`, `choose`, `next`, `quizSummary` (Task 2) match their uses in `QuizRun`; `srsEffect(correct, card, now)` matches its call; `isDue` (Task 2) is exported from `queue.ts` and used by `effect.ts`; `useDictionaryWords` (Task 3) returns the shape the container destructures.
