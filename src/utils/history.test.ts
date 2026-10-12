import { canGoBack } from './history'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => window.history.replaceState(null, ''))

describe('canGoBack', () => {
  it('is false on the first entry of the session and when there is no router state', () => {
    window.history.replaceState(null, '')
    expect(canGoBack()).toBe(false)
    window.history.replaceState({ idx: 0 }, '')
    expect(canGoBack()).toBe(false)
  })
  it('is true once the router has pushed an entry, even after a replace redirect', () => {
    window.history.replaceState({ idx: 2, key: 'abc' }, '')
    expect(canGoBack()).toBe(true)
  })
  it('ignores a malformed idx', () => {
    window.history.replaceState({ idx: 'x' }, '')
    expect(canGoBack()).toBe(false)
  })
})
