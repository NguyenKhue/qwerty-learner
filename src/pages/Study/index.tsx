import StudyOverview from './Overview'
import StudySession from './StudySession'
import type { SessionSummary } from './StudySession'
import Layout from '@/components/Layout'
import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending, lookupDictionary } from '@/store/customDicts'
import { newCardsPerDayAtom, studyReverseAtom } from '@/store/study'
import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { buildQueue, nextDueTime, nextRefreshDelay, sanitizeNewPerDay } from '@/utils/srs/queue'
import type { QueueItem } from '@/utils/srs/queue'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

// Keyed by id so moving between two sets in place starts from a clean state
export default function StudyRoute() {
  const { dictId = '' } = useParams()
  // React Router has already decoded the param
  return <Study key={dictId} id={dictId} />
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
  const [progress, setProgress] = useState<ICardProgress[] | null>(null)
  const [progressError, setProgressError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)

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

  const message = (text: string, tone = 'text-gray-500') => (
    <Layout>
      <p className={`m-auto ${tone}`}>{text}</p>
    </Layout>
  )

  if (!dict) return message('Loading…')
  if (wordsError) return message('Could not load the words of this set.', 'text-red-600')
  if (progressError) return message(progressError, 'text-red-600')
  if (!words || !progress) return message('Loading…')

  if (queue) {
    return <StudySession dictId={id} queue={queue} progress={progress} reverse={reverse} onFinish={onFinish} />
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
      onStart={onStart}
      onBack={() => navigate('/my-sets')}
    />
  )
}
