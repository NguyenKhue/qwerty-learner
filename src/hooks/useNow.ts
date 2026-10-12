import { useEffect, useState } from 'react'

/**
 * The current time, refreshed when the tab regains focus or visibility and after `getDelay(now)` milliseconds.
 * `getDelay` must be stable (memoised) and is evaluated with the time of each run, so a stale value cannot make it fire every second.
 */
export function useNow(getDelay: (now: number) => number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = window.setTimeout(refresh, getDelay(Date.now()))
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [getDelay, now])
  return now
}
