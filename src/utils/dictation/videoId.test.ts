import { isVideoId, parseVideoId } from './videoId'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'

describe('parseVideoId', () => {
  it('reads the id from every common YouTube link form', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseVideoId(`https://youtu.be/${ID}`)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(parseVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseVideoId(`youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('accepts a bare id and ignores extra query parameters', () => {
    expect(parseVideoId(ID)).toBe(ID)
    expect(parseVideoId(`  ${ID}  `)).toBe(ID)
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`)).toBe(ID)
    expect(parseVideoId(`https://youtu.be/${ID}?si=abc`)).toBe(ID)
  })

  it('refuses anything that is not exactly one YouTube video id', () => {
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('dQw4w9WgXc')).toBeNull()
    expect(parseVideoId('https://youtu.be/abc; rm -rf ~')).toBeNull()
    expect(parseVideoId(`https://youtu.be/${ID}; rm -rf ~`)).toBeNull()
    expect(parseVideoId('https://www.youtube.com/playlist?list=PL1234567890')).toBeNull()
    expect(parseVideoId(`https://vimeo.com/watch?v=${ID}`)).toBeNull()
    expect(parseVideoId(`https://evil.com/youtube.com/watch?v=${ID}`)).toBeNull()
  })
})

describe('isVideoId', () => {
  it('accepts only the 11-character id alphabet', () => {
    expect(isVideoId(ID)).toBe(true)
    expect(isVideoId('a_b-c1234567'.slice(0, 11))).toBe(true)
    expect(isVideoId('../etc/pass')).toBe(false)
    expect(isVideoId(`${ID}x`)).toBe(false)
  })
})
