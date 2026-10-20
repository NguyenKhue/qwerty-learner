// @vitest-environment node
import { handlers } from './index'
import { PROCEDURE_NAMES } from '@/data/contract'
import { describe, expect, it } from 'vitest'

describe('the procedure registry', () => {
  it('has a handler for every operation of the contract', () => {
    const missing = PROCEDURE_NAMES.filter((name) => typeof handlers[name] !== 'function')
    expect(missing).toEqual([])
  })

  it('has no handler for a name that is not in the contract', () => {
    const extra = Object.keys(handlers).filter((name) => (PROCEDURE_NAMES as string[]).indexOf(name) === -1)
    expect(extra).toEqual([])
  })
})
