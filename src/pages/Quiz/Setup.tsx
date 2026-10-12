import Layout from '@/components/Layout'
import { Button } from '@/components/ui/button'
import type { QuizDirection, QuizLength } from '@/utils/quiz/questions'

type Props = {
  dictName: string
  available: boolean
  distinctMeanings: number
  length: QuizLength
  onLengthChange: (value: QuizLength) => void
  direction: QuizDirection
  onDirectionChange: (value: QuizDirection) => void
  onStart: () => void
  onBack: () => void
}

const LENGTHS: { value: QuizLength; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'All' },
]

export default function QuizSetup({
  dictName,
  available,
  distinctMeanings,
  length,
  onLengthChange,
  direction,
  onDirectionChange,
  onStart,
  onBack,
}: Props) {
  return (
    <Layout>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{dictName}</h1>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>

        {!available ? (
          <p className="rounded-lg bg-white p-6 text-gray-600 shadow dark:bg-gray-800 dark:text-gray-300">
            This set cannot be quizzed yet: it needs at least 4 words with different meanings (found {distinctMeanings}).
          </p>
        ) : (
          <div className="space-y-5 rounded-lg bg-white p-6 text-sm text-gray-700 shadow dark:bg-gray-800 dark:text-gray-300">
            <div className="flex items-center justify-between gap-4">
              <span>Questions</span>
              <div className="flex gap-2" role="group" aria-label="Number of questions">
                {LENGTHS.map((option) => (
                  <Button
                    key={String(option.value)}
                    size="sm"
                    variant={length === option.value ? 'default' : 'outline'}
                    aria-pressed={length === option.value}
                    onClick={() => onLengthChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-4">
              <span>Show the meaning first (pick the word)</span>
              <input
                type="checkbox"
                checked={direction === 'meaning-to-word'}
                onChange={(e) => onDirectionChange(e.target.checked ? 'meaning-to-word' : 'word-to-meaning')}
              />
            </label>
            <Button onClick={onStart}>Start quiz</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
