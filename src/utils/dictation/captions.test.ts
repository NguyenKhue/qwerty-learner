import { parseJson3 } from './captions'
import auto from './fixtures/auto.json3.json'
import manual from './fixtures/manual.json3.json'
import { describe, expect, it } from 'vitest'

const texts = (json: unknown) => parseJson3(JSON.stringify(json)).map((w) => w.text)

describe('parseJson3', () => {
  it('reads auto subtitles word by word, without sound tags, music notes or repeated lines', () => {
    expect(texts(auto)).toEqual("so today we're going to talk about how memory works and why we forget things".split(' '))
  })

  it('times auto subtitle words by their offsets, never going back in time', () => {
    const words = parseJson3(JSON.stringify(auto))
    expect(words[0]).toEqual({ startMs: 2000, text: 'so' })
    expect(words[1]).toEqual({ startMs: 2300, text: 'today' })
    words.forEach((word, i) => {
      if (i > 0) expect(word.startMs).toBeGreaterThanOrEqual(words[i - 1].startMs)
    })
  })

  it('spreads the words of a manual subtitle line evenly over its duration', () => {
    const words = parseJson3(JSON.stringify(manual))
    expect(words.slice(0, 6).map((w) => w.startMs)).toEqual([1000, 1500, 2000, 2500, 3000, 3500])
    expect(words.map((w) => w.text)).not.toContain('[Applause]')
    expect(words.map((w) => w.text).join(' ')).toBe('Hello everyone. Thanks for coming today. Mr. Smith will start. Is that okay? Yes.')
  })

  it('throws for a file that is not json3 subtitles', () => {
    expect(() => parseJson3('not json')).toThrow()
    expect(() => parseJson3('{"foo": 1}')).toThrow()
  })
})
