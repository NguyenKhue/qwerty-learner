import { DataError } from './rpc'
import { createLiveRunner, retryDelay } from './useLive'
import { describe, expect, it, vi } from 'vitest'

/** Lets every pending promise reaction run (the spy library adds a few of its own). */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('createLiveRunner', () => {
  it('runs the query and hands over its answer', async () => {
    const onValue = vi.fn()
    const runner = createLiveRunner(() => Promise.resolve(5), onValue)
    runner.refresh()
    await flush()
    expect(onValue).toHaveBeenCalledWith(5)
  })

  it('ignores the answer of an older run when a newer run was started', async () => {
    const first = deferred<string>()
    const second = deferred<string>()
    const answers = [first, second]
    const onValue = vi.fn()
    const runner = createLiveRunner(() => answers.shift()!.promise, onValue)
    runner.refresh()
    runner.refresh()
    second.resolve('new')
    await flush()
    first.resolve('old')
    await flush()
    expect(onValue).toHaveBeenCalledTimes(1)
    expect(onValue).toHaveBeenCalledWith('new')
  })

  it('does not hand over anything after it was stopped', async () => {
    const pending = deferred<number>()
    const onValue = vi.fn()
    const runner = createLiveRunner(() => pending.promise, onValue)
    runner.refresh()
    runner.stop()
    pending.resolve(1)
    await flush()
    expect(onValue).not.toHaveBeenCalled()
  })

  it('reports a failed query to onError and keeps going', async () => {
    const onValue = vi.fn()
    const onError = vi.fn()
    const query = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(2)
    const runner = createLiveRunner(query, onValue, onError)
    runner.refresh()
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
    runner.refresh()
    await flush()
    expect(onValue).toHaveBeenCalledWith(2)
  })
})

describe('retryDelay', () => {
  it('asks again, with growing waits capped at 5 s, when the server could not be reached', () => {
    expect(retryDelay(0, new DataError('UNREACHABLE', 'x'))).toBe(500)
    expect(retryDelay(2, new TypeError('Failed to fetch'))).toBe(2000)
    expect(retryDelay(10, new DataError('UNREACHABLE', 'x'))).toBe(5000)
  })

  it('does not ask again when the server answered with an error', () => {
    expect(retryDelay(0, new DataError('BAD_REQUEST', 'x'))).toBeNull()
    expect(retryDelay(0, new DataError('INTERNAL', 'x'))).toBeNull()
  })
})
