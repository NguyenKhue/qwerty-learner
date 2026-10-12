import { CHAPTER_LENGTH } from '@/constants'
import { describe, expect, it } from 'vitest'

describe('test tooling', () => {
  it('resolves the @ alias', () => {
    expect(CHAPTER_LENGTH).toBe(20)
  })

  it('provides a fake IndexedDB', () => {
    expect(typeof indexedDB).toBe('object')
    expect(typeof IDBKeyRange).toBe('function')
  })
})
