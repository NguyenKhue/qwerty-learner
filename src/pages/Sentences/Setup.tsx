import { ModeFrame, ModePage } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { SentenceLength, SentenceScope } from '@/utils/sentences/types'
import { Link } from 'react-router-dom'

type Props = {
  dictName: string
  /** Words of the set that have a sentence to type, whatever the scope. */
  total: number
  /** Words that have a sentence and are inside the chosen scope: what a run draws from. */
  playable: number
  scope: SentenceScope
  onScopeChange: (value: SentenceScope) => void
  length: SentenceLength
  onLengthChange: (value: SentenceLength) => void
  onStart: () => void
}

const LENGTHS: { value: SentenceLength; label: string }[] = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 'all', label: 'All' },
]

const SCOPES: { value: SentenceScope; label: string; description: string }[] = [
  { value: 'due', label: 'Today', description: 'Every word that is due for review or new today, the same list as Flashcards.' },
  { value: 'all', label: 'All words', description: 'Every word of the set that has a sentence.' },
]

export default function SentencesSetup({ dictName, total, playable, scope, onScopeChange, length, onLengthChange, onStart }: Props) {
  return (
    <ModeFrame>
      <ModePage title="Sentences" subtitle={dictName}>
        {total === 0 ? (
          <Card className="space-y-4 p-6">
            <div className="space-y-2">
              <p className="font-medium">{dictName} has no example sentences to type</p>
              <p className="text-sm text-muted-foreground">
                A sentence counts when it contains the word, fits the English keyboard and is at most 200 characters long. Pick another set
                or add examples to one of yours.
              </p>
            </div>
            <Button asChild>
              <Link to="/gallery">Change set</Link>
            </Button>
          </Card>
        ) : (
          <Card className="space-y-5 p-6 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span>Words</span>
              <div className="flex gap-2" role="group" aria-label="Which words">
                {SCOPES.map((option) => (
                  <Button
                    key={option.value}
                    className="h-11 min-w-[44px] px-4"
                    variant={scope === option.value ? 'default' : 'outline'}
                    aria-pressed={scope === option.value}
                    onClick={() => onScopeChange(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-muted-foreground">{SCOPES.find((option) => option.value === scope)?.description}</p>
            {scope === 'all' && (
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
            )}
            <p className="text-muted-foreground">
              Each sentence is shown with its key word hidden: type the whole sentence and recall the missing word.
            </p>
            <p className="text-muted-foreground">{playable === 1 ? '1 word to practise' : `${playable} words to practise`}</p>
            {playable === 0 && <p className="text-muted-foreground">No word is due or new today. Choose All words to practise anyway.</p>}
            <Button className="h-12 w-full text-base shadow-2" disabled={playable === 0} onClick={onStart}>
              Start
            </Button>
          </Card>
        )}
      </ModePage>
    </ModeFrame>
  )
}
