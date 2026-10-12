import QuizRun from './QuizRun'
import QuizSetup from './Setup'
import { InlineLoading } from '@/components/Loading'
import { ModeFrame, PageMessage } from '@/components/ModePage'
import { useCurrentDictId } from '@/hooks/useCurrentDictId'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { quizDirectionAtom, quizLengthAtom } from '@/store/quiz'
import { canGoBack } from '@/utils/history'
import { buildQuiz, canQuiz, distinctMeaningCount, sanitizeQuizLength } from '@/utils/quiz/questions'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Keyed by id so moving between two sets in place starts from a clean state
export default function QuizRoute() {
  const id = useCurrentDictId()
  if (id === null) return <InlineLoading />
  return <Quiz key={id} id={id} />
}

function Quiz({ id }: { id: string }) {
  const navigate = useNavigate()
  const { dict, words, error } = useDictionaryWords(id)
  const [lengthStored, setLength] = useAtom(quizLengthAtom)
  const [direction, setDirection] = useAtom(quizDirectionAtom)
  const length = sanitizeQuizLength(lengthStored)

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  // Bumped on every start so QuizRun remounts with a fresh session ("Try again")
  const [round, setRound] = useState(0)

  const distinctMeanings = useMemo(() => (words ? distinctMeaningCount(words) : 0), [words])
  const available = useMemo(() => (words ? canQuiz(words) : false), [words])

  // Nothing earlier in this app's history (a bookmark, or a redirect in a new tab): fall back to the dashboard
  const onBack = useCallback(() => (canGoBack() ? navigate(-1) : navigate('/')), [navigate])

  const start = useCallback(() => {
    if (!words) return
    setRound((r) => r + 1)
    setQuestions(buildQuiz({ words, length, direction }))
  }, [words, length, direction])

  const message = (text: string, tone: 'muted' | 'error' = 'muted') => (
    <ModeFrame>
      <PageMessage text={text} tone={tone} />
    </ModeFrame>
  )

  if (!dict) return message('Loading…')
  if (error && !words) return message('Could not load the words of this set.', 'error')
  if (!words) return message('Loading…')

  if (questions && questions.length > 0) {
    return <QuizRun key={round} dictId={id} questions={questions} onRestart={start} onBack={() => setQuestions(null)} />
  }

  return (
    <QuizSetup
      dictName={dict.name}
      available={available}
      distinctMeanings={distinctMeanings}
      length={length}
      onLengthChange={setLength}
      direction={direction}
      onDirectionChange={setDirection}
      onStart={start}
      onBack={onBack}
    />
  )
}
