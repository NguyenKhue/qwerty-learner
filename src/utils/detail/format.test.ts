import { parseDetail } from './format'
import { describe, expect, it } from 'vitest'

describe('parseDetail', () => {
  const text = [
    'Unified - Loại từ: Tính từ (Adjective) - động từ gốc là Unify.',
    'Mẹo nhớ: "Thống nhất". Chỉ nhiều thành phần: gộp lại.',
    '',
    '1. Trong IT / Kỹ thuật: Hệ thống thống nhất',
    'Unified platform/API: Nền tảng/API thống nhất.',
    'Một dòng thường không có nhãn',
    'Câu mẫu: The company merged apps. (Công ty đã gộp.)',
  ].join('\n')

  it('splits lines, drops blank ones and labels the part before the first colon', () => {
    const lines = parseDetail(text)
    expect(lines).toHaveLength(6)
    expect(lines[0]).toEqual({ label: 'Unified - Loại từ', text: 'Tính từ (Adjective) - động từ gốc là Unify.' })
    expect(lines[1]).toEqual({ label: 'Mẹo nhớ', text: '"Thống nhất". Chỉ nhiều thành phần: gộp lại.' })
    expect(lines[2].label).toBe('1. Trong IT / Kỹ thuật')
    expect(lines[3]).toEqual({ label: 'Unified platform/API', text: 'Nền tảng/API thống nhất.' })
    expect(lines[5].label).toBe('Câu mẫu')
  })

  it('gives a line without a label no label property', () => {
    const line = parseDetail(text)[4]
    expect(line).toEqual({ text: 'Một dòng thường không có nhãn' })
    expect('label' in line).toBe(false)
  })

  it('does not treat a long sentence with a colon, or a time like 10:30, as a label', () => {
    const long = 'Đây là một câu rất dài không phải là một nhãn ngắn gọn gì cả, và nó có dấu hai chấm: ở giữa câu.'
    expect(parseDetail(long)).toEqual([{ text: long }])
    expect(parseDetail('Họp lúc 10:30 hôm nay')).toEqual([{ text: 'Họp lúc 10:30 hôm nay' }])
  })

  it('keeps a label with nothing after it, trims lines and handles CRLF and empty input', () => {
    expect(parseDetail('Ví dụ:')).toEqual([{ label: 'Ví dụ', text: '' }])
    expect(parseDetail('  Mẹo nhớ:  abc  \r\n\r\n x ')).toEqual([{ label: 'Mẹo nhớ', text: 'abc' }, { text: 'x' }])
    expect(parseDetail('')).toEqual([])
    expect(parseDetail('   \n  ')).toEqual([])
  })
})
