import { __resetEventsForTests, emit, getConnectionState, notifyLocal, onConnectionState, setEventSourceFactory, subscribe } from './events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Fake = {
  onopen: (() => void) | null
  onerror: (() => void) | null
  handlers: Record<string, (e: { data: string }) => void>
  addEventListener(name: string, fn: (e: { data: string }) => void): void
  close(): void
  closed: boolean
}
function fakeSource(): Fake {
  const source: Fake = {
    onopen: null,
    onerror: null,
    handlers: {},
    closed: false,
    addEventListener(name, fn) {
      source.handlers[name] = fn
    },
    close() {
      source.closed = true
    },
  }
  return source
}

let created: Fake[] = []
beforeEach(() => {
  __resetEventsForTests()
  created = []
  setEventSourceFactory(() => {
    const source = fakeSource()
    created.push(source)
    return source
  })
})

describe('subscribe and emit', () => {
  it('calls a subscriber when one of its topics is announced and not for another topic', () => {
    const fn = vi.fn()
    subscribe(['a', 'b'], fn)
    emit(['b'])
    emit(['c'])
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("calls a subscriber of '*' for every announcement and a stopped subscriber for none", () => {
    const all = vi.fn()
    const stopped = vi.fn()
    subscribe('*', all)
    subscribe(['a'], stopped)()
    emit(['a'])
    emit(['z'])
    expect(all).toHaveBeenCalledTimes(2)
    expect(stopped).not.toHaveBeenCalled()
  })

  it('calls a subscriber once even when several of its topics are announced together', () => {
    const fn = vi.fn()
    subscribe(['a', 'b'], fn)
    emit(['a', 'b'])
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('delivers a local notification on the next microtask, not synchronously', async () => {
    const fn = vi.fn()
    subscribe(['a'], fn)
    notifyLocal(['a'])
    expect(fn).not.toHaveBeenCalled()
    await Promise.resolve()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('the live connection', () => {
  it('opens the stream only when the first subscriber arrives, and once', () => {
    expect(created).toHaveLength(0)
    subscribe(['a'], () => undefined)
    subscribe(['b'], () => undefined)
    expect(created).toHaveLength(1)
  })

  it('announces the topics of a change event to the subscribers', () => {
    const fn = vi.fn()
    subscribe(['wordRecords'], fn)
    created[0].handlers.change({ data: JSON.stringify({ topics: ['wordRecords', 'reviewLog'] }) })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("treats a change event for '*' as a change of everything", () => {
    const fn = vi.fn()
    subscribe(['wordRecords'], fn)
    created[0].handlers.change({ data: JSON.stringify({ topics: ['*'] }) })
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('ignores an event whose data is not what it expects', () => {
    const fn = vi.fn()
    subscribe('*', fn)
    created[0].handlers.change({ data: 'not json' })
    created[0].handlers.change({ data: JSON.stringify({ nope: 1 }) })
    expect(fn).not.toHaveBeenCalled()
  })

  it('follows the connection state and tells the listeners of every change', () => {
    const states: string[] = []
    onConnectionState((state) => states.push(state))
    subscribe(['a'], () => undefined)
    expect(getConnectionState()).toBe('connecting')
    created[0].onopen?.()
    created[0].onerror?.()
    created[0].onopen?.()
    expect(states).toEqual(['open', 'down', 'open'])
  })

  it('refreshes every subscriber when the stream comes back, because changes may have been missed', () => {
    const fn = vi.fn()
    subscribe(['a'], fn)
    created[0].onopen?.()
    created[0].onerror?.()
    fn.mockClear()
    created[0].onopen?.()
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
