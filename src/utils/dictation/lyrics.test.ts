import { alignLines, parseLyricLines } from './lyrics'
import { dictationText } from './normalize'
import type { DictationSentence } from './types'
import { describe, expect, it } from 'vitest'

/** Two invented sentences, each 0.5 s per character, with a four-second gap between them. */
const sentences: DictationSentence[] = [
  { start: 0, end: 10, en: 'we walk to the river' },
  { start: 14, end: 27.5, en: 'the water is cold and clear' },
]

describe('parseLyricLines', () => {
  it('strips LRC tags and drops empty lines, section markers and lines that cannot be typed', () => {
    const text = [
      '[ar:Somebody]',
      '[00:12.34]we walk to the river at night',
      '[00:15.00][00:16.00]the water is cold and clear',
      '',
      '[Chorus]',
      '(x2)',
      '[00:20.00]',
      'café at night',
    ].join('\n')
    expect(parseLyricLines(text)).toEqual(['we walk to the river at night', 'the water is cold and clear'])
    expect(dictationText('café at night')).toBeNull()
  })
})

describe('alignLines', () => {
  it('gives a line the times of the words that matched it', () => {
    const { sentences: placed, report } = alignLines(sentences, ['we walk'])
    expect(placed).toEqual([{ start: 0, end: 4, en: 'we walk' }])
    expect(report.lines[0].score).toBe(1)
    expect(report.unmatchedCaptionWords).toBe(9)
  })

  it('fills a run of unmatched lines evenly into the gap and reports the placed times', () => {
    const { sentences: placed, report } = alignLines(sentences, ['we walk to the river', 'la la', 'hum hum', 'the water is cold and clear'])
    expect(placed).toEqual([
      { start: 0, end: 10, en: 'we walk to the river' },
      { start: 10, end: 12, en: 'la la' },
      { start: 12, end: 14, en: 'hum hum' },
      { start: 14, end: 27.5, en: 'the water is cold and clear' },
    ])
    expect(report).toMatchObject({
      lineCount: 4,
      previousSentenceCount: 2,
      matchedLineCount: 2,
      lowConfidence: [1, 2],
      unmatchedCaptionWords: 0,
    })
    expect(report.lines.map((line) => line.score)).toEqual([1, 0, 0, 1])
    placed.forEach((line, index) => {
      expect(line.end).toBeGreaterThanOrEqual(line.start)
      if (index > 0) expect(line.start).toBeGreaterThanOrEqual(placed[index - 1].end)
    })
  })

  it('times each line by its own words when one caption sentence holds several lines', () => {
    const captions: DictationSentence[] = [{ start: 0, end: 20, en: 'we walk to the river the water is foreign and clear' }]
    const { sentences: placed, report } = alignLines(captions, ['we walk to the river', 'the water is cold and clear'])
    expect(placed[0].start).toBe(0)
    expect(placed[1].start).toBeGreaterThan(placed[0].start)
    expect(placed[1].start).toBeGreaterThanOrEqual(placed[0].end)
    expect(placed[1].end).toBe(20)
    expect(report.lines.map((line) => line.score)).toEqual([1, 0.83])
    expect(report.lowConfidence).toEqual([])
    expect(report.unmatchedCaptionWords).toBe(1)
  })

  it('keeps the report free of the lyric text', () => {
    const { report } = alignLines(sentences, ['we walk to the river', 'the water is cold and clear'])
    const json = JSON.stringify(report)
    expect(json).not.toContain('river')
    expect(json).not.toContain('water')
    expect(report.lines).toHaveLength(2)
  })

  it('throws when no line matches the video', () => {
    expect(() => alignLines(sentences, ['completely different words here'])).toThrow()
  })
})
