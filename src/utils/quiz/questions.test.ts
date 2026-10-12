import { OPTION_COUNT, buildQuiz, canQuiz, distinctMeaningCount, meaningText, posTag, quizWords, sanitizeQuizLength } from './questions'
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

describe('malformed word data (as found in some built-in dictionaries)', () => {
  const bad = [
    { name: 'a', trans: null },
    { name: 'b', trans: 'một nghĩa' },
    { name: 'c' },
    { name: 'd', trans: [null] },
    word('e', 'n. ok'),
  ] as unknown as Word[]

  it('never throws and counts a plain-string trans as one meaning', () => {
    expect(() => quizWords(bad)).not.toThrow()
    expect(quizWords(bad).map((w) => w.name)).toEqual(['b', 'e'])
    expect(meaningText(bad[1])).toBe('một nghĩa')
    expect(meaningText(bad[0])).toBe('')
    expect(posTag(bad[0])).toBeNull()
    expect(posTag(bad[3])).toBeNull()
    expect(() => canQuiz(bad)).not.toThrow()
  })
})

describe('distinctMeaningCount', () => {
  it('counts distinct meanings among the usable words', () => {
    expect(distinctMeaningCount([word('a', 'x'), word('b', 'x'), word('c', 'y'), word('d')])).toBe(2)
    expect(distinctMeaningCount([])).toBe(0)
  })
})

describe('large sets', () => {
  it('builds a full quiz for thousands of words in well under a few seconds', () => {
    const big = Array.from({ length: 6000 }, (_, i) => word(`w${i}`, `${['n', 'v', 'adj'][i % 3]}. meaning ${i}`))
    const started = Date.now()
    const questions = buildQuiz({ words: big, length: 'all', direction: 'word-to-meaning', rng: seeded(11) })
    expect(questions).toHaveLength(6000)
    expect(questions.every((q) => new Set(q.options).size === OPTION_COUNT)).toBe(true)
    expect(Date.now() - started).toBeLessThan(2000)
  })
})
