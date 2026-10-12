import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])
  return matches
}

/** Like `useMediaQuery`, but once the query has matched it stays true, so shrinking the window never tears down something that is already running. */
export function useLatchedMediaQuery(query: string): boolean {
  const matches = useMediaQuery(query)
  const [latched, setLatched] = useState(matches)
  useEffect(() => {
    if (matches) setLatched(true)
  }, [matches])
  return matches || latched
}
