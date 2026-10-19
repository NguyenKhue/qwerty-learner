import Result from './Result'
import Run from './Run'
import Setup from './Setup'
import { InlineLoading } from '@/components/Loading'
import { ModeFrame, PageMessage } from '@/components/ModePage'
import { useCardProgress } from '@/hooks/useCardProgress'
import { useCurrentDictId } from '@/hooks/useCurrentDictId'
import { useExampleWords } from '@/hooks/useExampleWords'
import { useSetProgress } from '@/hooks/useSetProgress'
import { sentencesLengthAtom, sentencesScopeAtom } from '@/store/sentences'
import { extraNewCardsAtom, newCardsPerDayAtom } from '@/store/study'
import { canGoBack } from '@/utils/history'
import { buildPool } from '@/utils/sentences/pool'
import { buildRun, sanitizeScope, sanitizeSentenceLength, scopeWordCount } from '@/utils/sentences/run'
import { retryItems, summarize } from '@/utils/sentences/session'
import type { SentenceSession, SentenceSummary } from '@/utils/sentences/session'
import type { SentenceItem } from '@/utils/sentences/types'
import { buildQueue, extraNewToday, sanitizeNewPerDay } from '@/utils/srs/queue'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Keyed by id so moving between two sets in place starts from a clean state
export default function SentencesRoute() {
  const id = useCurrentDictId()
  if (id === null) return <InlineLoading />
  return <Sentences key={id} id={id} />
}

type Stage = 'setup' | 'run' | 'result'

function Sentences({ id }: { id: string }) {
  const navigate = useNavigate()
  const { dict, words, error } = useExampleWords(id)
  const progress = useSetProgress(id, words)
  const [lengthStored, setLength] = useAtom(sentencesLengthAtom)
  const length = sanitizeSentenceLength(lengthStored)
  const [scopeStored, setScope] = useAtom(sentencesScopeAtom)
  const scope = sanitizeScope(scopeStored)
  // The same daily limits as Flashcards decide which words are new today; the cards are only read, never written
  const cards = useCardProgress(id)
  const newPerDay = sanitizeNewPerDay(useAtomValue(newCardsPerDayAtom))
  const extraNewBySet = useAtomValue(extraNewCardsAtom)

  const [stage, setStage] = useState<Stage>('setup')
  const [items, setItems] = useState<SentenceItem[]>([])
  // Bumped on every start so Run remounts with a fresh session ("Try again")
  const [round, setRound] = useState(0)
  const [summary, setSummary] = useState<SentenceSummary | null>(null)
  const [mistakes, setMistakes] = useState<SentenceItem[]>([])

  const pool = useMemo(() => (words ? buildPool(words) : []), [words])

  /** The words due or new right now, most urgent first, exactly as the flashcard queue lists them. */
  const dueAndNew = useCallback((): string[] => {
    if (!words || !cards) return []
    const now = Date.now()
    return buildQueue({ words, progress: cards, now, newPerDay, extraNew: extraNewToday(extraNewBySet[id], now) }).map(
      (entry) => entry.word.name,
    )
  }, [words, cards, newPerDay, extraNewBySet, id])
  // Worked out again whenever the setup screen is shown, so "today" and the due times are current
  const priority = useMemo(() => (scope === 'due' ? dueAndNew() : undefined), [scope, dueAndNew, stage]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = useMemo(() => scopeWordCount(pool), [pool])
  const playable = useMemo(() => scopeWordCount(pool, priority), [pool, priority])

  // Nothing earlier in this app's history (a bookmark, or a redirect in a new tab): fall back to the dashboard
  const onBack = useCallback(() => (canGoBack() ? navigate(-1) : navigate('/')), [navigate])

  // "Try again" builds a new run from the pool; "Practise mistakes" starts one over the given items
  const start = useCallback(
    (source?: SentenceItem[]) => {
      setRound((r) => r + 1)
      setItems(
        source ? source.slice() : buildRun(pool, scope === 'due' ? 'all' : length, Math.random, scope === 'due' ? dueAndNew() : undefined),
      )
      setStage('run')
    },
    [pool, length, scope, dueAndNew],
  )

  const onFinish = useCallback((session: SentenceSession) => {
    setSummary(summarize(session))
    setMistakes(retryItems(session))
    setStage('result')
  }, [])

  const message = (text: string, tone: 'muted' | 'error' = 'muted') => (
    <ModeFrame>
      <PageMessage text={text} tone={tone} />
    </ModeFrame>
  )

  if (!dict) return message('Loading…')
  if (error && !words) return message('Could not load the words of this set.', 'error')
  if (!words || !cards) return message('Loading…')

  if (stage === 'run') {
    return <Run key={round} items={items} onExit={() => setStage('setup')} onFinish={onFinish} />
  }

  if (stage === 'result' && summary) {
    return (
      <Result
        summary={summary}
        canPractiseMistakes={mistakes.length > 0}
        onPractiseMistakes={() => start(mistakes)}
        onTryAgain={() => start()}
        onBack={() => setStage('setup')}
      />
    )
  }

  return (
    <Setup
      progress={progress}
      dictName={dict.name}
      total={total}
      playable={playable}
      scope={scope}
      onScopeChange={setScope}
      length={length}
      onLengthChange={setLength}
      onStart={() => start()}
      onBack={onBack}
    />
  )
}
