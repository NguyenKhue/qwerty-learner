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
