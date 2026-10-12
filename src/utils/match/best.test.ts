import { BEST_KEY_PREFIX, formatDuration, readBest, sanitizeBest, updateBest, writeBest } from './best'
import type { BestStorage } from './best'
import { afterEach, describe, expect, it } from 'vitest'

const memoryStorage = (initial: Record<string, string> = {}): BestStorage & { data: Record<string, string> } => {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }
}
const throwingStorage: BestStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
}

describe('sanitizeBest', () => {
  it('accepts a positive finite number, also as a numeric string', () => {
    expect(sanitizeBest(4200)).toBe(4200)
    expect(sanitizeBest('4200')).toBe(4200)
  })

  it('rejects everything else', () => {
    for (const bad of ['abc', '', '  ', 0, -5, NaN, Infinity, null, undefined, {}, [], true]) expect(sanitizeBest(bad)).toBeNull()
  })
})

describe('updateBest', () => {
  it('the first time is a new best', () => {
    expect(updateBest(null, 5000)).toEqual({ best: 5000, isNewBest: true })
  })

  it('only a strictly smaller time is a new best', () => {
    expect(updateBest(5000, 4000)).toEqual({ best: 4000, isNewBest: true })
    expect(updateBest(5000, 5000)).toEqual({ best: 5000, isNewBest: false })
    expect(updateBest(5000, 6000)).toEqual({ best: 5000, isNewBest: false })
  })

  it('rounds to whole milliseconds and never records less than 1 ms', () => {
    expect(updateBest(null, 1234.6)).toEqual({ best: 1235, isNewBest: true })
    expect(updateBest(null, 0)).toEqual({ best: 1, isNewBest: true })
  })

  it('ignores a time that is not a number', () => {
    expect(updateBest(5000, NaN)).toEqual({ best: 5000, isNewBest: false })
    expect(updateBest(null, Infinity)).toEqual({ best: null, isNewBest: false })
  })
})

describe('readBest / writeBest', () => {
  it('round-trips through a storage, per dictionary', () => {
    const storage = memoryStorage()
    expect(readBest('custom:a', storage)).toBeNull()
    expect(writeBest('custom:a', 4200, storage)).toBe(true)
    expect(storage.data[`${BEST_KEY_PREFIX}custom:a`]).toBe('4200')
    expect(readBest('custom:a', storage)).toBe(4200)
    expect(readBest('custom:b', storage)).toBeNull()
  })

  it('ignores garbage stored under the key', () => {
    expect(readBest('custom:a', memoryStorage({ [`${BEST_KEY_PREFIX}custom:a`]: 'abc' }))).toBeNull()
    expect(readBest('custom:a', memoryStorage({ [`${BEST_KEY_PREFIX}custom:a`]: '-5' }))).toBeNull()
  })

  it('does not throw when the storage is blocked', () => {
    expect(readBest('custom:a', throwingStorage)).toBeNull()
    expect(writeBest('custom:a', 4200, throwingStorage)).toBe(false)
  })
})

describe('default storage (localStorage)', () => {
  afterEach(() => localStorage.clear())

  it('uses localStorage when no storage is given', () => {
    expect(writeBest('custom:z', 3100)).toBe(true)
    expect(localStorage.getItem(`${BEST_KEY_PREFIX}custom:z`)).toBe('3100')
    expect(readBest('custom:z')).toBe(3100)
  })
})

describe('formatDuration', () => {
  it('formats minutes, seconds and tenths', () => {
    expect(formatDuration(0)).toBe('0:00.0')
    expect(formatDuration(5400)).toBe('0:05.4')
    expect(formatDuration(59999)).toBe('0:59.9')
    expect(formatDuration(65400)).toBe('1:05.4')
    expect(formatDuration(600000)).toBe('10:00.0')
  })

  it('shows zero for a negative or non-numeric duration', () => {
    expect(formatDuration(-1)).toBe('0:00.0')
    expect(formatDuration(NaN)).toBe('0:00.0')
  })
})
