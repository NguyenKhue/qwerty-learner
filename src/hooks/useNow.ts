import { nextRefreshDelay } from '@/utils/srs/queue'
import { useEffect, useState } from 'react'

/** The current time, refreshed when the tab regains focus or visibility and when the next card falls due or the day changes. */
export function useNow(nextDue: number | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = window.setTimeout(refresh, nextRefreshDelay(Date.now(), nextDue))
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
  }, [nextDue, now])
  return now
}
