import { ModeFrame, ModePage } from '@/components/ModePage'
import SetProgress from '@/components/SetProgress'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ProgressSummary } from '@/utils/progress/status'
import type { SentenceLength, SentenceMode } from '@/utils/sentences/types'

type Props = {
  dictName: string
  playable: number
  length: SentenceLength
  onLengthChange: (value: SentenceLength) => void
  mode: SentenceMode
  onModeChange: (value: SentenceMode) => void
  onStart: () => void
  onBack: () => void
  progress?: ProgressSummary | null
}

const LENGTHS: { value: SentenceLength; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'All' },
]

const MODES: { value: SentenceMode; label: string; description: string }[] = [
  {
    value: 'word',
    label: 'Hide word',
    description: 'The sentence is shown with its key word hidden: type the whole sentence and recall the missing word.',
  },
  { value: 'copy', label: 'Copy', description: 'The sentence is shown: copy it.' },
  { value: 'sentence', label: 'Hide sentence', description: 'Only the translation is shown: type the sentence from memory.' },
]

export default function SentencesSetup({
  dictName,
  playable,
  length,
  onLengthChange,
  mode,
  onModeChange,
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
              {mode === 'word' ? ', and only sentences where the word was found in the sentence can be played in Hide word mode' : ''}
              {mode === 'sentence' ? ', and only sentences with a translation can be played in Hide sentence mode' : ''}.
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
            <div className="flex items-center justify-between gap-4">
              <span>Mode</span>
              <div className="flex gap-2" role="group" aria-label="Mode">
                {MODES.map((option) => (
                  <Button
                    key={option.value}
                    className="h-11 min-w-[44px] px-4"
                    variant={mode === option.value ? 'default' : 'outline'}
                    aria-pressed={mode === option.value}
                    onClick={() => onModeChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground">{MODES.find((option) => option.value === mode)?.description}</p>
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
