import { buildPool, isPlayable, normalizeSentence, normalizeTypedChar, poolFor } from './pool'
import type { Word } from '@/typings'
import { describe, expect, it } from 'vitest'

const word = (name: string, examples?: Word['examples']): Word => ({ name, trans: [], usphone: '', ukphone: '', examples })

describe('normalizeTypedChar', () => {
  it('maps curly quotes, dashes and non-breaking spaces to their plain equivalents', () => {
    expect(normalizeTypedChar('’')).toBe("'")
    expect(normalizeTypedChar('‘')).toBe("'")
    expect(normalizeTypedChar('“')).toBe('"')
    expect(normalizeTypedChar('”')).toBe('"')
    expect(normalizeTypedChar('–')).toBe('-')
    expect(normalizeTypedChar('—')).toBe('-')
    expect(normalizeTypedChar('\u00a0')).toBe(' ')
  })

  it('returns any other character unchanged', () => {
    expect(normalizeTypedChar('a')).toBe('a')
    expect(normalizeTypedChar('à')).toBe('à')
    expect(normalizeTypedChar('.')).toBe('.')
  })
})

describe('normalizeSentence', () => {
  it('trims and normalises every character', () => {
    expect(normalizeSentence('  It’s “fine” — really  ')).toBe(`It's "fine" - really`)
  })

  it('keeps whitespace-only text empty', () => {
    expect(normalizeSentence('   ')).toBe('')
  })
})

describe('isPlayable', () => {
  it('accepts a normal printable sentence', () => {
    expect(isPlayable('Enable strict mode.')).toBe(true)
  })

  it('rejects empty or whitespace-only text', () => {
    expect(isPlayable('')).toBe(false)
    expect(isPlayable('   ')).toBe(false)
  })

  it('accepts exactly 200 characters and rejects 201', () => {
    expect(isPlayable('a'.repeat(200))).toBe(true)
    expect(isPlayable('a'.repeat(201))).toBe(false)
  })

  it('rejects characters outside printable ASCII', () => {
    expect(isPlayable('Xin chào')).toBe(false)
    expect(isPlayable('a\tb')).toBe(false)
    expect(isPlayable('a\nb')).toBe(false)
  })

  it('accepts a sentence whose only non-ASCII characters are equivalent dashes or quotes', () => {
    expect(isPlayable('a — b')).toBe(true)
    expect(isPlayable('It’s “fine”')).toBe(true)
  })
})

describe('buildPool', () => {
  it('keeps only playable examples and normalises the text and translation', () => {
    const strict = word('strict', [{ text: 'Be strict.', trans: 'Hãy nghiêm.' }, { text: 'Xin chào', trans: 'x' }, { text: '  ' }])
    const plain = word('plain')
    expect(buildPool([strict, plain])).toEqual([{ word: strict, text: 'Be strict.', trans: 'Hãy nghiêm.', target: { start: 3, end: 9 } }])
  })

  it('omits the trans key when an example has no translation', () => {
    const [item] = buildPool([word('plain', [{ text: 'Hello.' }])])
    expect(item.text).toBe('Hello.')
    expect('trans' in item).toBe(false)
  })

  it('drops a translation that is empty after trimming', () => {
    const [item] = buildPool([word('plain', [{ text: 'Hi.', trans: '   ' }])])
    expect('trans' in item).toBe(false)
  })

  it('normalises curly characters in the kept text', () => {
    expect(buildPool([word('quote', [{ text: 'It’s fine — really' }])])[0].text).toBe("It's fine - really")
  })

  it('keeps the order of words and of their examples', () => {
    const words = [word('a', [{ text: 'A one.' }, { text: 'A two.' }]), word('b', [{ text: 'B one.' }])]
    expect(buildPool(words).map((item) => item.text)).toEqual(['A one.', 'A two.', 'B one.'])
  })
})

describe('buildPool target', () => {
  it('records where the headword is in the sentence, and leaves it out when it is not found', () => {
    const pool = buildPool([word('strict', [{ text: 'Be strict about it.' }]), word('plain', [{ text: 'Nothing to see here.' }])])
    expect(pool[0].target).toEqual({ start: 3, end: 9 })
    expect(pool[1].target).toBeUndefined()
    expect('target' in pool[1]).toBe(false)
  })

  it('finds an inflected form of the headword', () => {
    expect(buildPool([word('embody', [{ text: 'It embodies trust.' }])])[0].target).toEqual({ start: 3, end: 11 })
  })
})

describe('poolFor', () => {
  const pool = buildPool([
    word('strict', [{ text: 'Be strict.', trans: 'Hãy nghiêm.' }]),
    word('plain', [{ text: 'Hello.', trans: 'Xin chào.' }]),
    word('bare', [{ text: 'Bare bare.' }]),
  ])

  it("keeps every item for 'copy' (the same array instance)", () => {
    expect(poolFor(pool, 'copy')).toBe(pool)
  })

  it("keeps only items whose target was found for 'word'", () => {
    expect(poolFor(pool, 'word').map((item) => item.word.name)).toEqual(['strict', 'bare'])
  })

  it("keeps only items with a translation for 'sentence'", () => {
    expect(poolFor(pool, 'sentence').map((item) => item.word.name)).toEqual(['strict', 'plain'])
  })
})
