import {
  hasReplacementChars,
  normalizeWords,
  parseCsvRows,
  parseWordsCsv,
  parseWordsFile,
  parseWordsJson,
  rowsToWords,
  splitMeanings,
  splitTrans,
} from './parse'
import { describe, expect, it } from 'vitest'

describe('splitTrans', () => {
  it('splits on ; ； and newlines, trims, drops empties', () => {
    expect(splitTrans(' a ; b；c\n\n d ;')).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('normalizeWords', () => {
  it('merges duplicate names, unions meanings and reports them', () => {
    const { words, duplicates } = normalizeWords([
      { name: 'run', trans: ['v. chạy'], usphone: 'a', ukphone: 'b' },
      { name: ' run ', trans: ['v. chạy', 'n. cuộc chạy'], usphone: '', ukphone: '' },
      { name: 'Run', trans: ['x'], usphone: '', ukphone: '' },
    ])
    expect(words.map((w) => w.name)).toEqual(['run', 'Run'])
    expect(words[0].trans).toEqual(['v. chạy', 'n. cuộc chạy'])
    expect(words[0].usphone).toBe('a')
    expect(duplicates).toEqual(['run'])
  })
})

describe('parseCsvRows', () => {
  it('handles quotes, commas, newlines inside quotes, CRLF and a BOM', () => {
    const rows = parseCsvRows('﻿a,"b\nc"\r\nd,"e ""x"", f"')
    expect(rows).toEqual([
      { cells: ['a', 'b\nc'], line: 1 },
      { cells: ['d', 'e "x", f'], line: 3 },
    ])
  })

  it('returns no rows for an empty string and ignores a trailing newline', () => {
    expect(parseCsvRows('')).toEqual([])
    expect(parseCsvRows('a,b\n')).toEqual([{ cells: ['a', 'b'], line: 1 }])
  })
})

describe('parseWordsCsv', () => {
  it('parses a header row and splits meanings on ;', () => {
    const r = parseWordsCsv('name,trans,usphone,ukphone\nstrict,adj. nghiêm ngặt; adj. khắt khe,strɪkt,strɪkt\n')
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([{ name: 'strict', trans: ['adj. nghiêm ngặt', 'adj. khắt khe'], usphone: 'strɪkt', ukphone: 'strɪkt' }])
  })

  it('works without a header and with only name and trans columns', () => {
    const r = parseWordsCsv('cat,con mèo\ndog,con chó')
    expect(r.words.map((w) => [w.name, w.trans, w.usphone, w.ukphone])).toEqual([
      ['cat', ['con mèo'], '', ''],
      ['dog', ['con chó'], '', ''],
    ])
  })

  it('imports an Excel-style file (BOM, CRLF, quoted commas)', () => {
    const r = parseWordsCsv('﻿name,trans\r\n"hello, world","xin chào; chào"\r\n')
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([{ name: 'hello, world', trans: ['xin chào', 'chào'], usphone: '', ukphone: '' }])
  })

  it('reports bad rows with the correct line, even after a multi-line cell', () => {
    const r = parseWordsCsv('name,trans\n"a\nb",x\nbad,\n,orphan\nok,fine')
    expect(r.words.map((w) => w.name)).toEqual(['a\nb', 'ok'])
    expect(r.errors).toEqual([
      { line: 4, message: '"bad" has no meaning' },
      { line: 5, message: 'Missing word' },
    ])
  })

  it('merges duplicates and reports them', () => {
    const r = parseWordsCsv('a,x\na,y')
    expect(r.words).toEqual([{ name: 'a', trans: ['x', 'y'], usphone: '', ukphone: '' }])
    expect(r.duplicates).toEqual(['a'])
  })

  it('yields no words and no errors for a header-only or empty file', () => {
    expect(parseWordsCsv('name,trans,usphone,ukphone\n')).toEqual({ words: [], errors: [], duplicates: [] })
    expect(parseWordsCsv('')).toEqual({ words: [], errors: [], duplicates: [] })
  })
})

describe('parseWordsJson', () => {
  it('accepts the built-in dictionary format and keeps notation', () => {
    const r = parseWordsJson(JSON.stringify([{ name: 'cancel', trans: ['huỷ'], usphone: "'kænsl", ukphone: "'kænsl", notation: 'x' }]))
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([{ name: 'cancel', trans: ['huỷ'], usphone: "'kænsl", ukphone: "'kænsl", notation: 'x' }])
  })

  it('keeps valid meanings, accepts a plain string trans, and rejects the rest per item', () => {
    const r = parseWordsJson(
      JSON.stringify([
        { name: 'a', trans: ['ok', 5, null, '  '], usphone: 1 },
        { name: 'b', trans: 'single' },
        { name: 'c', trans: [] },
        { trans: ['no name'] },
        'junk',
      ]),
    )
    expect(r.words).toEqual([
      { name: 'a', trans: ['ok'], usphone: '', ukphone: '' },
      { name: 'b', trans: ['single'], usphone: '', ukphone: '' },
    ])
    expect(r.errors).toEqual([
      { line: 3, message: '"c" has no meaning' },
      { line: 4, message: 'Missing word' },
      { line: 5, message: 'Not an object' },
    ])
  })

  it('reports invalid JSON and non-array JSON', () => {
    expect(parseWordsJson('{nope').errors).toEqual([{ line: 1, message: 'Invalid JSON' }])
    expect(parseWordsJson('{"a":1}').errors).toEqual([{ line: 1, message: 'JSON must be an array of words' }])
  })
})

describe('parseWordsFile', () => {
  it('chooses the parser by extension', () => {
    expect(parseWordsFile('x.JSON', '[{"name":"a","trans":["b"]}]').words).toHaveLength(1)
    expect(parseWordsFile('x.csv', 'a,b').words).toHaveLength(1)
    expect(parseWordsFile('x.txt', 'a,b').words).toHaveLength(1)
  })
})

describe('rowsToWords', () => {
  it('skips blank rows, numbers rows from 1 and reports problems', () => {
    const r = rowsToWords([
      { name: 'a', trans: 'x\ny', usphone: '', ukphone: '' },
      { name: '', trans: '', usphone: '', ukphone: '' },
      { name: 'b', trans: '', usphone: '', ukphone: '' },
      { name: '', trans: 'orphan', usphone: '', ukphone: '' },
    ])
    expect(r.words).toEqual([{ name: 'a', trans: ['x', 'y'], usphone: '', ukphone: '' }])
    expect(r.errors).toEqual([
      { line: 3, message: '"b" has no meaning' },
      { line: 4, message: 'Missing word' },
    ])
  })
})

describe('parseWordsCsv delimiter detection', () => {
  it('imports a semicolon-separated CSV (Excel in vi-VN / European locales)', () => {
    const r = parseWordsCsv('name;trans\r\napple;quả táo\r\n"a; b";"x; y"\r\n')
    expect(r.errors).toEqual([])
    expect(r.words).toEqual([
      { name: 'apple', trans: ['quả táo'], usphone: '', ukphone: '' },
      { name: 'a; b', trans: ['x', 'y'], usphone: '', ukphone: '' },
    ])
  })

  it('keeps comma CSVs that contain a semicolon in the meanings working', () => {
    const r = parseWordsCsv('name,trans\napple,quả táo; trái táo')
    expect(r.words).toEqual([{ name: 'apple', trans: ['quả táo', 'trái táo'], usphone: '', ukphone: '' }])
  })
})

describe('editor rows keep meanings that contain ;', () => {
  it('splitMeanings only splits on newlines', () => {
    expect(splitMeanings('a; b\n\n c ')).toEqual(['a; b', 'c'])
  })

  it('rowsToWords does not split a meaning on ; (copied built-in sets stay unchanged)', () => {
    const r = rowsToWords([{ name: 'cancel', trans: 'huỷ, thu hồi; xoá bỏ\nnghĩa khác', usphone: '', ukphone: '' }])
    expect(r.words[0].trans).toEqual(['huỷ, thu hồi; xoá bỏ', 'nghĩa khác'])
  })
})

describe('parseWordsCsv robustness', () => {
  it('reports an unterminated quote instead of swallowing the rest of the file', () => {
    const r = parseWordsCsv('name,trans\nok,fine\na,"x\nb,y\nc,z')
    expect(r.words.map((w) => w.name)).toEqual(['ok'])
    expect(r.errors).toEqual([{ line: 3, message: 'Unterminated quote: the rest of the file was read as one cell' }])
  })

  it('treats word / headword / term as header names too', () => {
    expect(parseWordsCsv('Word,Meaning\ncat,con mèo').words.map((w) => w.name)).toEqual(['cat'])
    expect(parseWordsCsv('headword,trans\ncat,con mèo').words.map((w) => w.name)).toEqual(['cat'])
    expect(parseWordsCsv('term;trans\ncat;con mèo').words.map((w) => w.name)).toEqual(['cat'])
  })
})

describe('hasReplacementChars', () => {
  it('detects text that was decoded with the wrong encoding', () => {
    expect(hasReplacementChars('qu\uFFFD t\uFFFDo')).toBe(true)
    expect(hasReplacementChars('quả táo')).toBe(false)
  })
})
