import Result from './Result'
import Run from './Run'
import Setup from './Setup'
import { InlineLoading } from '@/components/Loading'
import { ModeFrame, PageMessage } from '@/components/ModePage'
import { useCurrentDictId } from '@/hooks/useCurrentDictId'
import { useExampleWords } from '@/hooks/useExampleWords'
import { useSetProgress } from '@/hooks/useSetProgress'
import { sentencesLengthAtom, sentencesModeAtom } from '@/store/sentences'
import { canGoBack } from '@/utils/history'
import { buildPool, poolFor } from '@/utils/sentences/pool'
import { buildRun, sanitizeMode, sanitizeSentenceLength } from '@/utils/sentences/run'
import { retryItems, summarize } from '@/utils/sentences/session'
import type { SentenceSession, SentenceSummary } from '@/utils/sentences/session'
import type { SentenceItem } from '@/utils/sentences/types'
import { useAtom } from 'jotai'
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
  const [modeStored, setMode] = useAtom(sentencesModeAtom)
  const length = sanitizeSentenceLength(lengthStored)
  const mode = sanitizeMode(modeStored)

  const [stage, setStage] = useState<Stage>('setup')
  const [items, setItems] = useState<SentenceItem[]>([])
  // Bumped on every start so Run remounts with a fresh session ("Try again")
  const [round, setRound] = useState(0)
  const [summary, setSummary] = useState<SentenceSummary | null>(null)
  const [mistakes, setMistakes] = useState<SentenceItem[]>([])

  const pool = useMemo(() => (words ? buildPool(words) : []), [words])
  const playable = useMemo(() => poolFor(pool, mode).length, [pool, mode])

  // Nothing earlier in this app's history (a bookmark, or a redirect in a new tab): fall back to the dashboard
  const onBack = useCallback(() => (canGoBack() ? navigate(-1) : navigate('/')), [navigate])

  // "Try again" builds a new run from the pool; "Practise mistakes" starts one over the given items
  const start = useCallback(
    (source?: SentenceItem[]) => {
      setRound((r) => r + 1)
      setItems(source ? source.slice() : buildRun(poolFor(pool, mode), length, Math.random))
      setStage('run')
    },
    [pool, mode, length],
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
  if (!words) return message('Loading…')

  if (stage === 'run') {
    return <Run key={round} items={items} mode={mode} onModeChange={setMode} onExit={() => setStage('setup')} onFinish={onFinish} />
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
      playable={playable}
      length={length}
      onLengthChange={setLength}
      mode={mode}
      onModeChange={setMode}
      onStart={() => start()}
      onBack={onBack}
    />
  )
}
