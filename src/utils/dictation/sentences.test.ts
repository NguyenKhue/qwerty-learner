import { parseJson3 } from './captions'
import type { TimedWord } from './captions'
import auto from './fixtures/auto.json3.json'
import manual from './fixtures/manual.json3.json'
import { buildSentences } from './sentences'
import { describe, expect, it } from 'vitest'

/** Words starting every `stepMs`, from `fromMs`. */
const run = (text: string, fromMs = 0, stepMs = 200): TimedWord[] =>
  text.split(' ').map((w, i) => ({ startMs: fromMs + i * stepMs, text: w }))

describe('buildSentences', () => {
  it('splits punctuated text at the end of each sentence and keeps abbreviations together', () => {
    const sentences = buildSentences(parseJson3(JSON.stringify(manual)), 10000)
    expect(sentences.map((s) => s.en)).toEqual(['Thanks for coming today.', 'Mr. Smith will start.', 'Is that okay?'])
  })

  it('splits unpunctuated text at a pause longer than 0.7 s, not at a shorter one', () => {
    const words = [...run('we went to the market', 0), ...run('and bought some fresh bread', 1600)]
    expect(buildSentences(words, 5000).map((s) => s.en)).toEqual(['we went to the market', 'and bought some fresh bread'])
    const close = [...run('we went to the market', 0), ...run('and bought some fresh bread', 1300)]
    expect(buildSentences(close, 5000)).toHaveLength(1)
  })

  it('makes sentences out of the auto subtitles fixture', () => {
    const sentences = buildSentences(parseJson3(JSON.stringify(auto)), 20000)
    expect(sentences.map((s) => s.en)).toEqual(["so today we're going to talk about how memory works", 'and why we forget things'])
    expect(sentences[0].start).toBe(2)
  })

  it('never lets a sentence pass 25 words or 10 seconds', () => {
    const long = run(Array.from({ length: 40 }, (_, i) => `word${i}`).join(' '))
    const cut = buildSentences(long, 20000)
    expect(cut[0].en.split(' ')).toHaveLength(25)
    const slow = run(Array.from({ length: 22 }, (_, i) => `slow${i}`).join(' '), 0, 500)
    buildSentences(slow, 30000).forEach((s) => expect(s.end - s.start).toBeLessThanOrEqual(10))
  })

  it('gives every sentence an end after its start, at the latest when the next one starts', () => {
    const words = [...run('one two three four', 0), ...run('five six seven eight', 3000)]
    const sentences = buildSentences(words, 4000)
    sentences.forEach((s) => expect(s.end).toBeGreaterThan(s.start))
    expect(sentences[0].end).toBeLessThanOrEqual(sentences[1].start)
    expect(sentences[1].end).toBeLessThanOrEqual(4)
  })

  it('drops sentences that are too short or cannot be typed', () => {
    const words = [...run('hi there', 0), ...run('we had a lovely time', 2000), ...run('at the café today', 5000)]
    expect(buildSentences(words, 8000).map((s) => s.en)).toEqual(['we had a lovely time'])
  })
})
