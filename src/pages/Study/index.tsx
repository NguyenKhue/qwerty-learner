import StudyOverview from './Overview'
import StudySession from './StudySession'
import type { SessionSummary } from './StudySession'
import { InlineLoading } from '@/components/Loading'
import { ModeFrame, PageMessage } from '@/components/ModePage'
import { useCurrentDictId } from '@/hooks/useCurrentDictId'
import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending, lookupDictionary } from '@/store/customDicts'
import { newCardsPerDayAtom, studyReverseAtom } from '@/store/study'
import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { fetchDetailMap } from '@/utils/detail/sidecar'
import { canGoBack } from '@/utils/history'
import { type ProgressSummary, progressSummary } from '@/utils/progress/status'
import { buildQueue, nextDueTime, nextRefreshDelay, sanitizeNewPerDay } from '@/utils/srs/queue'
import type { QueueItem } from '@/utils/srs/queue'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useSWR from 'swr'

// Keyed by id so moving between two sets in place starts from a clean state
export default function StudyRoute() {
  const id = useCurrentDictId()
  if (id === null) return <InlineLoading />
  return <Study key={id} id={id} />
}

function Study({ id }: { id: string }) {
  const navigate = useNavigate()
  const dictionaryById = useAtomValue(dictionaryByIdAtom)
  const customLoaded = useAtomValue(customDictionariesLoadedAtom)
  const [newPerDayStored, setNewPerDay] = useAtom(newCardsPerDayAtom)
  const [reverse, setReverse] = useAtom(studyReverseAtom)
  const newPerDay = sanitizeNewPerDay(newPerDayStored)

  const dict = lookupDictionary(dictionaryById, id)
  const pending = isCustomDictPending(id, customLoaded)

  useEffect(() => {
    if (!dict && !pending) navigate('/gallery', { replace: true })
  }, [dict, pending, navigate])

  const { data: words, error: wordsError } = useSWR(dict ? dict.url : null, wordListFetcher)
  // The sidecar only enriches the back of a flashcard, so it is fetched in the background and never blocks the session
  const { data: detailMap } = useSWR(dict?.detailUrl ? dict.detailUrl : null, fetchDetailMap)
  const [progress, setProgress] = useState<ICardProgress[] | null>(null)
  const [progressError, setProgressError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  // How the set stood when the session began, so the overview afterwards can show the gain
  const [before, setBefore] = useState<ProgressSummary | null>(null)

  const reloadProgress = useCallback(async () => {
    try {
      setProgress(await getDictProgress(id))
      setNow(Date.now())
      setProgressError('')
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : 'Could not read your progress')
    }
  }, [id])

  useEffect(() => {
    reloadProgress()
  }, [reloadProgress])

  // Keep the overview's idea of "now" current: when the next card becomes due, at midnight, and when the tab becomes visible again
  useEffect(() => {
    if (queue) return
    const refresh = () => setNow(Date.now())
    const current = Date.now()
    const delay = nextRefreshDelay(current, nextDueTime(words ?? [], progress ?? [], current))
    const timer = window.setTimeout(refresh, delay)
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
  }, [queue, words, progress, now])

  // Build the queue at the moment Start is pressed so it never uses a stale "now"
  const onStart = useCallback(() => {
    if (!words || !progress) return
    const fresh = Date.now()
    const built = buildQueue({ words, progress, now: fresh, newPerDay })
    if (built.length === 0) {
      setNow(fresh)
      return
    }
    setBefore(progressSummary(words, progress))
    setQueue(built)
  }, [words, progress, newPerDay])

  const onFinish = useCallback(
    (result: SessionSummary) => {
      setQueue(null)
      setSummary(result)
      reloadProgress()
    },
    [reloadProgress],
  )

  const message = (text: string, tone: 'muted' | 'error' = 'muted') => (
    <ModeFrame>
      <PageMessage text={text} tone={tone} />
    </ModeFrame>
  )

  if (!dict) return message('Loading…')
  if (wordsError && !words) return message('Could not load the words of this set.', 'error')
  if (progressError) return message(progressError, 'error')
  if (!words || !progress) return message('Loading…')

  if (queue) {
    return <StudySession dictId={id} queue={queue} progress={progress} reverse={reverse} details={detailMap} onFinish={onFinish} />
  }

  return (
    <StudyOverview
      dictName={dict.name}
      words={words}
      progress={progress}
      now={now}
      newPerDay={newPerDay}
      onNewPerDayChange={setNewPerDay}
      reverse={reverse}
      onReverseChange={setReverse}
      summary={summary}
      before={before}
      onStart={onStart}
      // Nothing earlier in this app's history: fall back to the dashboard
      onBack={() => (canGoBack() ? navigate(-1) : navigate('/'))}
    />
  )
}
