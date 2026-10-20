import { listAtom, metaAtom } from './meta'
import { call } from './rpc'
import { createStore } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./rpc', () => ({ call: vi.fn().mockResolvedValue(null) }))

beforeEach(() => {
  vi.mocked(call).mockClear()
  vi.mocked(call).mockResolvedValue(null)
})

describe('listAtom', () => {
  it('reads an empty list for a key that is not in the data file', () => {
    const store = createStore()
    expect(store.get(listAtom('flags'))).toEqual([])
  })

  it('reads the list the gate loaded from the data file', () => {
    const store = createStore()
    store.set(metaAtom, { flags: JSON.stringify(['a', 'b']) })
    expect(store.get(listAtom('flags'))).toEqual(['a', 'b'])
  })

  it('treats a value that is not a list of strings as an empty list', () => {
    const store = createStore()
    const flags = listAtom('flags')
    store.set(metaAtom, { flags: 'not json' })
    expect(store.get(flags)).toEqual([])
    store.set(metaAtom, { flags: JSON.stringify({ a: 1 }) })
    expect(store.get(flags)).toEqual([])
    store.set(metaAtom, { flags: JSON.stringify(['a', 3, null, 'b']) })
    expect(store.get(flags)).toEqual(['a', 'b'])
  })

  it('shows a written list at once and saves it to the data file as JSON, once', () => {
    const store = createStore()
    const flags = listAtom('flags')
    store.set(flags, ['x'])
    expect(store.get(flags)).toEqual(['x'])
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith('meta.set', 'flags', JSON.stringify(['x']))
  })

  it('applies an update function to the latest list, also for two writes in a row', () => {
    const store = createStore()
    const flags = listAtom('flags')
    store.set(flags, (list) => list.concat('a'))
    store.set(flags, (list) => list.concat('b'))
    expect(store.get(flags)).toEqual(['a', 'b'])
    expect(vi.mocked(call).mock.calls.map((c) => c[2])).toEqual([JSON.stringify(['a']), JSON.stringify(['a', 'b'])])
  })

  it('keeps the other keys when one is written', () => {
    const store = createStore()
    store.set(metaAtom, { other: 'keep', flags: '[]' })
    store.set(listAtom('flags'), ['z'])
    expect(store.get(metaAtom)).toEqual({ other: 'keep', flags: JSON.stringify(['z']) })
  })

  it('keeps the value on screen and does not throw when the save fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(call).mockRejectedValue(new Error('down'))
    const store = createStore()
    const flags = listAtom('flags')
    expect(() => store.set(flags, ['x'])).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(store.get(flags)).toEqual(['x'])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
