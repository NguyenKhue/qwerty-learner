import QuizRun from './QuizRun'
import QuizSetup from './Setup'
import Layout from '@/components/Layout'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { quizDirectionAtom, quizLengthAtom } from '@/store/quiz'
import { getDictProgress } from '@/utils/db/card-progress'
import type { ICardProgress } from '@/utils/db/record'
import { buildQuiz, canQuiz, distinctMeaningCount, sanitizeQuizLength } from '@/utils/quiz/questions'
import type { QuizQuestion } from '@/utils/quiz/questions'
import { useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

// Keyed by id so moving between two sets in place starts from a clean state
export default function QuizRoute() {
  const { dictId = '' } = useParams()
  return <Quiz key={dictId} id={dictId} />
}

function Quiz({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { dict, words, error } = useDictionaryWords(id)
  const [lengthStored, setLength] = useAtom(quizLengthAtom)
  const [direction, setDirection] = useAtom(quizDirectionAtom)
  const length = sanitizeQuizLength(lengthStored)

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null)
  const [progress, setProgress] = useState<ICardProgress[]>([])
  // Bumped on every start so QuizRun remounts with a fresh session ("Try again")
  const [round, setRound] = useState(0)

  const distinctMeanings = useMemo(() => (words ? distinctMeaningCount(words) : 0), [words])
  const available = useMemo(() => (words ? canQuiz(words) : false), [words])

  // `default` is the key of the first history entry: there is nothing to go back to, so fall back to the sets page
  const onBack = useCallback(() => (location.key === 'default' ? navigate('/my-sets') : navigate(-1)), [location.key, navigate])

  const start = useCallback(async () => {
    if (!words) return
    let rows: ICardProgress[] = []
    try {
      rows = await getDictProgress(id)
    } catch {
      // Without the progress rows answers still count toward the score; wrong answers are saved as usual
    }
    setProgress(rows)
    setRound((r) => r + 1)
    setQuestions(buildQuiz({ words, length, direction }))
  }, [words, id, length, direction])

  const message = (text: string, tone = 'text-gray-500') => (
    <Layout>
      <p className={`m-auto ${tone}`}>{text}</p>
    </Layout>
  )

  if (!dict) return message('Loading…')
  if (error && !words) return message('Could not load the words of this set.', 'text-red-600')
  if (!words) return message('Loading…')

  if (questions && questions.length > 0) {
    return <QuizRun key={round} dictId={id} questions={questions} progress={progress} onRestart={start} onBack={() => setQuestions(null)} />
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
