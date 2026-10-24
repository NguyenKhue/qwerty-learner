import StudyOverview from './Overview'
import StudySession from './StudySession'
import type { SessionSummary } from './StudySession'
import { InlineLoading } from '@/components/Loading'
import { ModeFrame, PageMessage } from '@/components/ModePage'
import { subscribe } from '@/data/events'
import { DataError } from '@/data/rpc'
import { retryDelay } from '@/data/useLive'
import { useCurrentDictId } from '@/hooks/useCurrentDictId'
import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending, lookupDictionary } from '@/store/customDicts'
import { extraNewCardsAtom, newCardsPerDayAtom, studyReverseAtom } from '@/store/study'
import { getDictProgress, getHardWordsToday } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { fetchWordExtras, sidecarUrlOf } from '@/utils/detail/sidecar'
import { canGoBack } from '@/utils/history'
import { type ProgressSummary, progressSummary } from '@/utils/progress/status'
import shuffle from '@/utils/shuffle'
import { practiceWords } from '@/utils/srs/practice'
import type { PracticeScope } from '@/utils/srs/practice'
import { buildQueue, extraNewToday, nextDueTime, nextRefreshDelay, sanitizeNewPerDay } from '@/utils/srs/queue'
import type { QueueItem } from '@/utils/srs/queue'
import { startOfLocalDay } from '@/utils/srs/time'
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
  const [extraNewBySet, setExtraNewBySet] = useAtom(extraNewCardsAtom)

  const dict = lookupDictionary(dictionaryById, id)
  const pending = isCustomDictPending(id, customLoaded)

  useEffect(() => {
    if (!dict && !pending) navigate('/gallery', { replace: true })
  }, [dict, pending, navigate])

  const { data: words, error: wordsError } = useSWR(dict ? dict.url : null, wordListFetcher)
  // The sidecar only enriches the back of a flashcard, so it is fetched in the background and never blocks the session
  const { data: extrasMap } = useSWR((dict ? sidecarUrlOf(dict) : undefined) ?? null, fetchWordExtras)
  const [progress, setProgress] = useState<ICardProgress[] | null>(null)
  const [progressError, setProgressError] = useState('')
  // Counts the failed reads in a row so that every failure schedules the next try, even when its message is the same
  const [failures, setFailures] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  // How the set stood when the session began, so the overview afterwards can show the gain
  const [before, setBefore] = useState<ProgressSummary | null>(null)
  const [hardToday, setHardToday] = useState<Set<string>>(() => new Set())
  const [practicing, setPracticing] = useState(false)
  const extraNew = extraNewToday(extraNewBySet[id], now)

  const reloadProgress = useCallback(async () => {
    try {
      const [rows, hard] = await Promise.all([getDictProgress(id), getHardWordsToday(id)])
      setProgress(rows)
      setHardToday(hard)
      setNow(Date.now())
      setProgressError('')
      setFailures(0)
    } catch (e) {
      setProgressError(e instanceof Error ? e.message : 'Could not read your progress')
      setFailures((n) => n + 1)
    }
  }, [id])

  useEffect(() => {
    reloadProgress()
  }, [reloadProgress])

  // After the computer sleeps the first read can fail: ask again instead of leaving the page on an error, and read again when the page
  // wakes up ('*' is announced then) or when another tab changed this set's cards
  useEffect(() => {
    if (failures === 0) return
    const timer = window.setTimeout(reloadProgress, retryDelay(failures - 1, new DataError('UNREACHABLE', '')) ?? 5000)
    return () => window.clearTimeout(timer)
  }, [failures, reloadProgress])
  useEffect(() => subscribe(['cards:' + id, 'reviewLog'], reloadProgress), [id, reloadProgress])

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
    const built = buildQueue({ words, progress, now: fresh, newPerDay, extraNew: extraNewToday(extraNewBySet[id], fresh) })
    if (built.length === 0) {
      setNow(fresh)
      return
    }
    setBefore(progressSummary(words, progress))
    setPracticing(false)
    setQueue(built)
  }, [words, progress, newPerDay, extraNewBySet, id])

  // "Learn more" raises today's new-card limit of this set only, then starts the session with the extra cards
  const onLearnMore = useCallback(
    (count: number) => {
      if (!words || !progress) return
      const fresh = Date.now()
      const extra = extraNewToday(extraNewBySet[id], fresh) + count
      setExtraNewBySet((prev) => ({ ...prev, [id]: { day: startOfLocalDay(fresh), count: extra } }))
      const built = buildQueue({ words, progress, now: fresh, newPerDay, extraNew: extra })
      if (built.length === 0) return
      setBefore(progressSummary(words, progress))
      setPracticing(false)
      setQueue(built)
    },
    [words, progress, newPerDay, extraNewBySet, id, setExtraNewBySet],
  )

  // Practice goes through the chosen cards in a shuffled order without touching the schedule
  const onPractice = useCallback(
    (scope: PracticeScope) => {
      if (!words || !progress) return
      const picked = practiceWords({ words, progress, hardToday, now: Date.now(), scope })
      if (picked.length === 0) return
      setBefore(null)
      setPracticing(true)
      setQueue(shuffle(picked).map((word): QueueItem => ({ word, kind: 'due' })))
    },
    [words, progress, hardToday],
  )

  const onFinish = useCallback(
    (result: SessionSummary) => {
      setQueue(null)
      setPracticing(false)
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
    return (
      <StudySession
        dictId={id}
        queue={queue}
        progress={progress}
        reverse={reverse}
        extras={extrasMap}
        practice={practicing}
        onFinish={onFinish}
      />
    )
  }

  return (
    <StudyOverview
      dictName={dict.name}
      words={words}
      progress={progress}
      now={now}
      newPerDay={newPerDay}
      extraNew={extraNew}
      hardToday={hardToday}
      onNewPerDayChange={setNewPerDay}
      reverse={reverse}
      onReverseChange={setReverse}
      summary={summary}
      before={before}
      onStart={onStart}
      onLearnMore={onLearnMore}
      onPractice={onPractice}
      // Nothing earlier in this app's history: fall back to the dashboard
      onBack={() => (canGoBack() ? navigate(-1) : navigate('/'))}
    />
  )
}
