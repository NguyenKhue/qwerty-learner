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
