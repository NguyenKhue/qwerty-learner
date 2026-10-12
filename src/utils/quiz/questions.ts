import type { Word } from '@/typings'

export type QuizDirection = 'word-to-meaning' | 'meaning-to-word'
export type QuizLength = 10 | 20 | 'all'
export type QuizQuestion = { word: Word; direction: QuizDirection; prompt: string; options: string[]; answerIndex: number }

export const OPTION_COUNT = 4
export const MIN_DISTINCT_MEANINGS = 4
const DEFAULT_LENGTH: QuizLength = 10
// Buckets up to this size are shuffled and scanned; bigger ones are sampled at random so a question costs O(1), not O(set size)
const SMALL_BUCKET = 64
const MAX_SAMPLE_TRIES = 60

/** The usable meanings of a word. Tolerates the shapes found in some built-in files: null, a plain string, null entries. */
function transList(word: Word): string[] {
  const raw: unknown = word.trans
  const list: unknown[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  return list
    .filter((meaning): meaning is string => typeof meaning === 'string')
    .map((meaning) => meaning.trim())
    .filter(Boolean)
}

/** All meanings of a word as one string (the text of a "meaning" option). */
export function meaningText(word: Word): string {
  return transList(word).join('; ')
}

/** Leading part-of-speech tag of the first meaning (`n.`, `adj.`, `vt.` …), lower-case; `vt`/`vi` count as `v`. */
export function posTag(word: Word): string | null {
  const first = transList(word)[0]
  if (first === undefined) return null
  const match = /^([A-Za-z]{1,6})\./.exec(first)
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

/** How many different meanings the askable words of a set have. */
export function distinctMeaningCount(words: Word[]): number {
  return new Set(quizWords(words).map(meaningText)).size
}

/** A set can be quizzed when it has at least 4 distinct meanings (so 3 distractors that differ from the answer always exist). */
export function canQuiz(words: Word[]): boolean {
  return distinctMeaningCount(words) >= MIN_DISTINCT_MEANINGS
}

export function sanitizeQuizLength(value: unknown): QuizLength {
  if (value === 'all') return 'all'
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return n === 10 || n === 20 ? n : DEFAULT_LENGTH
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

// Everything a question needs about a word, computed once instead of once per question
type Entry = { word: Word; meaning: string; tag: string | null }

const optionText = (entry: Entry, direction: QuizDirection) => (direction === 'word-to-meaning' ? entry.meaning : entry.word.name)

/**
 * Takes up to `need` distractors from `bucket`. A candidate is rejected when it is the answer itself, has the same meaning as the
 * answer (it would be an equally right option) or repeats an option text that is already used (`used` is updated).
 */
function draw(bucket: Entry[], need: number, answer: Entry, direction: QuizDirection, used: Set<string>, rng: () => number): Entry[] {
  const chosen: Entry[] = []
  const tryTake = (candidate: Entry) => {
    if (chosen.length >= need || candidate.word.name === answer.word.name || candidate.meaning === answer.meaning) return
    const text = optionText(candidate, direction)
    if (used.has(text)) return
    used.add(text)
    chosen.push(candidate)
  }

  if (bucket.length <= SMALL_BUCKET) {
    shuffle(bucket, rng).forEach(tryTake)
    return chosen
  }
  for (let tries = 0; tries < MAX_SAMPLE_TRIES && chosen.length < need; tries++) {
    tryTake(bucket[Math.floor(rng() * bucket.length)])
  }
  // Rare: the random draws kept hitting rejected candidates, so scan the whole bucket to be sure to find enough
  const start = Math.floor(rng() * bucket.length)
  for (let k = 0; k < bucket.length && chosen.length < need; k++) tryTake(bucket[(start + k) % bucket.length])
  return chosen
}

function makeQuestion(entry: Entry, all: Entry[], byTag: Map<string, Entry[]>, direction: QuizDirection, rng: () => number): QuizQuestion {
  const correct = optionText(entry, direction)
  const used = new Set<string>([correct])
  const need = OPTION_COUNT - 1

  // Same part of speech first, then anything else
  const sameTag = entry.tag === null ? [] : byTag.get(entry.tag) ?? []
  const distractors = draw(sameTag, need, entry, direction, used, rng)
  const all3 =
    distractors.length < need ? distractors.concat(draw(all, need - distractors.length, entry, direction, used, rng)) : distractors

  const options = shuffle([correct].concat(all3.map((other) => optionText(other, direction))), rng)
  return {
    word: entry.word,
    direction,
    prompt: direction === 'word-to-meaning' ? entry.word.name : entry.meaning,
    options,
    answerIndex: options.indexOf(correct),
  }
}

/** A random sample of the set, one question per word. Empty when the set cannot be quizzed. */
export function buildQuiz(input: { words: Word[]; length: QuizLength; direction: QuizDirection; rng?: () => number }): QuizQuestion[] {
  const rng = input.rng ?? Math.random
  const entries: Entry[] = quizWords(input.words).map((word) => ({ word, meaning: meaningText(word), tag: posTag(word) }))
  if (new Set(entries.map((entry) => entry.meaning)).size < MIN_DISTINCT_MEANINGS) return []

  const byTag = new Map<string, Entry[]>()
  entries.forEach((entry) => {
    if (entry.tag === null) return
    const bucket = byTag.get(entry.tag)
    if (bucket) bucket.push(entry)
    else byTag.set(entry.tag, [entry])
  })

  const count = input.length === 'all' ? entries.length : Math.min(input.length, entries.length)
  return shuffle(entries, rng)
    .slice(0, count)
    .map((entry) => makeQuestion(entry, entries, byTag, input.direction, rng))
}
