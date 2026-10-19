import { ModeFrame, ModePage } from '@/components/ModePage'
import SetProgress from '@/components/SetProgress'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ProgressSummary } from '@/utils/progress/status'
import type { SentenceLength } from '@/utils/sentences/types'

type Props = {
  dictName: string
  playable: number
  length: SentenceLength
  onLengthChange: (value: SentenceLength) => void
  hide: boolean
  onHideChange: (value: boolean) => void
  onStart: () => void
  onBack: () => void
  progress?: ProgressSummary | null
}

const LENGTHS: { value: SentenceLength; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'All' },
]

export default function SentencesSetup({
  dictName,
  playable,
  length,
  onLengthChange,
  hide,
  onHideChange,
  onStart,
  onBack,
  progress,
}: Props) {
  return (
    <ModeFrame>
      <ModePage title={dictName} onBack={onBack}>
        {playable === 0 ? (
          <Card className="space-y-2 p-6 text-muted-foreground">
            <p>This set has no example sentences you can type yet.</p>
            <p>
              Sentences with characters outside the English keyboard or longer than 200 characters are skipped
              {hide ? ', and only sentences with a translation can be played while the sentence is hidden' : ''}.
            </p>
          </Card>
        ) : (
          <Card className="space-y-5 p-6 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>Sentences</span>
              <div className="flex gap-2" role="group" aria-label="Number of sentences">
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
              <span>Hide the sentence (type it from its translation)</span>
              <input
                type="checkbox"
                checked={hide}
                onChange={(e) => onHideChange(e.target.checked)}
                className="h-5 w-5 accent-[rgb(var(--primary))]"
              />
            </label>
            <p className="text-muted-foreground">{playable} sentences can be played</p>
            <Button className="h-12 w-full text-base shadow-2" onClick={onStart}>
              Start
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
