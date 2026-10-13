import { ModeFrame, ModePage } from '@/components/ModePage'
import SetProgress from '@/components/SetProgress'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ProgressSummary } from '@/utils/progress/status'
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
  progress?: ProgressSummary | null
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
  progress,
}: Props) {
  return (
    <ModeFrame>
      <ModePage title={dictName} onBack={onBack}>
        {!available ? (
          <Card className="p-6 text-muted-foreground">
            This set cannot be quizzed yet: it needs at least 4 words with different meanings (found {distinctMeanings}).
          </Card>
        ) : (
          <Card className="space-y-5 p-6 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>Questions</span>
              <div className="flex gap-2" role="group" aria-label="Number of questions">
                {LENGTHS.map((option) => (
                  <Button
                    key={String(option.value)}
                    className="h-11 min-w-[44px] px-4"
                    variant={length === option.value ? 'default' : 'outline'}
                    aria-pressed={length === option.value}
                    onClick={() => onLengthChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex min-h-[44px] items-center justify-between gap-4">
              <span>Show the meaning first (pick the word)</span>
              <input
                type="checkbox"
                checked={direction === 'meaning-to-word'}
                onChange={(e) => onDirectionChange(e.target.checked ? 'meaning-to-word' : 'word-to-meaning')}
                className="h-5 w-5 accent-[rgb(var(--primary))]"
              />
            </label>
            <Button className="h-12 w-full text-base shadow-2" onClick={onStart}>
              Start quiz
            </Button>
          </Card>
        )}
        {progress && (
          <Card>
            <SetProgress summary={progress} />
          </Card>
        )}
      </ModePage>
    </ModeFrame>
  )
}
