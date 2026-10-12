import StudyOverview from './Overview'
import StudySession from './StudySession'
import type { SessionSummary } from './StudySession'
import Layout from '@/components/Layout'
import { customDictionariesLoadedAtom, dictionaryByIdAtom, isCustomDictPending } from '@/store/customDicts'
import { newCardsPerDayAtom, studyReverseAtom } from '@/store/study'
import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { sanitizeNewPerDay } from '@/utils/srs/queue'
import type { QueueItem } from '@/utils/srs/queue'
import { wordListFetcher } from '@/utils/wordListFetcher'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useSWR from 'swr'

// Keyed by id so moving between two sets in place starts from a clean state
export default function StudyRoute() {
  const { dictId = '' } = useParams()
  const id = decodeURIComponent(dictId)
  return <Study key={id} id={id} />
}

function Study({ id }: { id: string }) {
  const navigate = useNavigate()
  const dictionaryById = useAtomValue(dictionaryByIdAtom)
  const customLoaded = useAtomValue(customDictionariesLoadedAtom)
  const [newPerDayStored, setNewPerDay] = useAtom(newCardsPerDayAtom)
  const [reverse, setReverse] = useAtom(studyReverseAtom)
  const newPerDay = sanitizeNewPerDay(newPerDayStored)

  const dict = dictionaryById[id]
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
      onStart={setQueue}
      onBack={() => navigate('/my-sets')}
    />
  )
}
