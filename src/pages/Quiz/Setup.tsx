import { ModeFrame, ModePage, Panel } from '@/components/ModePage'
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
    <ModeFrame>
      <ModePage title={dictName} onBack={onBack}>
        {!available ? (
          <Panel className="text-muted-foreground">
            This set cannot be quizzed yet: it needs at least 4 words with different meanings (found {distinctMeanings}).
          </Panel>
        ) : (
          <Panel className="space-y-5 text-sm">
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
            <label className="flex min-h-[44px] items-center justify-between gap-4">
              <span>Show the meaning first (pick the word)</span>
              <input
                type="checkbox"
                checked={direction === 'meaning-to-word'}
                onChange={(e) => onDirectionChange(e.target.checked ? 'meaning-to-word' : 'word-to-meaning')}
                className="h-5 w-5 accent-[rgb(var(--primary))]"
              />
            </label>
            <Button onClick={onStart}>Start quiz</Button>
          </Panel>
        )}
      </ModePage>
    </ModeFrame>
  )
}
