import { extractExamplesFromDetail } from './fromDetail'
import { describe, expect, it } from 'vitest'

describe('extractExamplesFromDetail', () => {
  it('reads the labelled lines with a translation in trailing parentheses', () => {
    const detail = [
      'Meaning one.',
      'Câu mẫu: English sentence. (Bản dịch).',
      'Another line.',
      'Câu mẫu: Second sentence. (Bản dịch hai).',
    ].join('\n')
    expect(extractExamplesFromDetail(detail)).toEqual([
      { text: 'English sentence.', trans: 'Bản dịch' },
      { text: 'Second sentence.', trans: 'Bản dịch hai' },
    ])
  })

  it('takes the whole inner text when the translation has nested parentheses', () => {
    const detail = 'Câu mẫu: Parse it. (Nghĩa là (JSON) ở đây).'
    expect(extractExamplesFromDetail(detail)).toEqual([{ text: 'Parse it.', trans: 'Nghĩa là (JSON) ở đây' }])
  })

  it('keeps the whole line as text when there is no translation', () => {
    expect(extractExamplesFromDetail('Câu mẫu: English sentence.')).toEqual([{ text: 'English sentence.' }])
  })

  it('only reads Câu mẫu lines, case-insensitively, and ignores explanation lines labelled Ví dụ or Example', () => {
    const detail = ['Other line', 'Ví dụ: Giải thích bằng tiếng Việt', 'Example: C', 'CÂU MẪU: A (B)', 'not a label: D'].join('\n')
    expect(extractExamplesFromDetail(detail)).toEqual([{ text: 'A', trans: 'B' }])
    expect(extractExamplesFromDetail('no label here')).toEqual([])
  })
})
