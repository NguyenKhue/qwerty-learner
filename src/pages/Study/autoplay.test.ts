import { autoPlayKey } from './autoplay'
import { describe, expect, it } from 'vitest'

describe('autoPlayKey', () => {
  it('plays the word as soon as a card shows the word on its front', () => {
    expect(autoPlayKey({ word: 'exchange', reverse: false, revealed: false, enabled: true })).toBe('exchange')
  })

  it('keeps the same key when the card is flipped, so the word is not played twice', () => {
    const front = autoPlayKey({ word: 'exchange', reverse: false, revealed: false, enabled: true })
    expect(autoPlayKey({ word: 'exchange', reverse: false, revealed: true, enabled: true })).toBe(front)
  })

  it('waits for the flip when the meaning is shown first: playing earlier would give the word away', () => {
    expect(autoPlayKey({ word: 'exchange', reverse: true, revealed: false, enabled: true })).toBeNull()
    expect(autoPlayKey({ word: 'exchange', reverse: true, revealed: true, enabled: true })).toBe('exchange')
  })

  it('plays nothing when pronunciation is turned off or there is no card', () => {
    expect(autoPlayKey({ word: 'exchange', reverse: false, revealed: false, enabled: false })).toBeNull()
    expect(autoPlayKey({ word: undefined, reverse: false, revealed: false, enabled: true })).toBeNull()
  })
})
