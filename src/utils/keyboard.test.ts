import { isActivatableButton } from './keyboard'
import { describe, expect, it } from 'vitest'

describe('isActivatableButton', () => {
  it('is true for an enabled button only', () => {
    const button = document.createElement('button')
    expect(isActivatableButton(button)).toBe(true)
    button.disabled = true
    expect(isActivatableButton(button)).toBe(false)
  })

  it('is false for other elements and for no target', () => {
    expect(isActivatableButton(document.createElement('div'))).toBe(false)
    expect(isActivatableButton(document.createElement('span'))).toBe(false)
    expect(isActivatableButton(document.body)).toBe(false)
    expect(isActivatableButton(null)).toBe(false)
  })
})
