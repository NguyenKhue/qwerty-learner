import { createLiveRunner } from './useLive'
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
