import { subscribe } from './events'
import { useEffect, useRef, useState } from 'react'

/**
 * Runs a query and hands over its latest answer. `refresh` may be called at any time (a change was announced); an answer of an older
 * run never overwrites the answer of a newer one, and nothing is handed over after `stop`.
 */
export function createLiveRunner<T>(query: () => Promise<T>, onValue: (value: T) => void, onError?: (error: unknown) => void) {
  let run = 0
  let stopped = false
  return {
    refresh() {
      const mine = ++run
      query().then(
        (value) => {
          if (!stopped && mine === run) onValue(value)
        },
        (error) => {
          if (!stopped && mine === run) onError?.(error)
        },
      )
    },
    stop() {
      stopped = true
    },
  }
}

const sameDeps = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

/**
 * The live replacement of Dexie's `useLiveQuery`: the answer of `query`, run again whenever the data server announces a change to one
 * of `topics`. `undefined` until the first answer, and again right after `deps` change (so a screen never shows another set's data).
 */
export function useLive<T>(query: () => Promise<T>, topics: string[], deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined)
  const lastDeps = useRef<unknown[]>(deps)
  const topicKey = topics.join('|')

  useEffect(() => {
    if (!sameDeps(lastDeps.current, deps)) {
      lastDeps.current = deps
      setValue(undefined)
    }
    const runner = createLiveRunner(query, setValue)
    runner.refresh()
    const stop = subscribe(topics, runner.refresh)
    return () => {
      stop()
      runner.stop()
    }
    // The query and topics are described by `deps` and `topicKey`, as with useLiveQuery
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicKey, ...deps])

  return value
}
