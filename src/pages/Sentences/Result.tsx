import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { SentenceResult, SentenceSummary } from '@/utils/sentences/session'
import type { CSSProperties } from 'react'

// Each child of a `.stagger` container enters one step after the previous one
const staggerStep = (i: number) => ({ '--i': i } as CSSProperties)

/** The typing time as `m:ss`. */
function formatTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** Mistakes of one result: wrong keys, plus one for a peek. */
function mistakesOf(result: SentenceResult): number {
  return result.wrong + (result.peeked ? 1 : 0)
}

type Props = {
  summary: SentenceSummary
  canPractiseMistakes: boolean
  onPractiseMistakes: () => void
  onTryAgain: () => void
  onBack: () => void
}

export default function SentencesResult({ summary, canPractiseMistakes, onPractiseMistakes, onTryAgain, onBack }: Props) {
  const stats = [
    { label: 'Speed', value: `${Math.round(summary.wpm)} WPM` },
    { label: 'Accuracy', value: `${Math.round(summary.accuracy * 100)}%` },
    { label: 'Time', value: formatTime(summary.ms) },
    { label: 'Completed', value: String(summary.completed) },
  ]

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-2xl">
        <div className="stagger flex w-full flex-col items-center gap-6">
          <Card className="w-full space-y-4" style={staggerStep(0)}>
            <p className="text-sm text-muted-foreground">Sentences finished</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="num text-2xl font-semibold tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {summary.missed.length > 0 ? (
            <Card className="w-full space-y-2" style={staggerStep(1)}>
              <p className="text-sm font-medium text-muted-foreground">Sentences to review</p>
              <ul className="space-y-3">
                {summary.missed.map((result, index) => (
                  <li key={index} className="space-y-0.5">
                    <p className="font-medium">
                      {result.item.text}{' '}
                      <span className="num text-sm text-muted-foreground">
                        {mistakesOf(result)} {mistakesOf(result) === 1 ? 'mistake' : 'mistakes'}
                      </span>
                    </p>
                    {result.item.trans && <p className="text-sm text-muted-foreground">{result.item.trans}</p>}
                  </li>
                ))}
              </ul>
              {summary.missedMore > 0 && <p className="text-sm text-muted-foreground">and {summary.missedMore} more</p>}
            </Card>
          ) : (
            <p className="font-medium text-accent" style={staggerStep(1)}>
              No mistakes. Well done!
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-3" style={staggerStep(2)}>
            {canPractiseMistakes && (
              <Button className="h-12 px-6 text-base shadow-2" onClick={onPractiseMistakes}>
                Practise mistakes
              </Button>
            )}
            <Button variant={canPractiseMistakes ? 'outline' : 'default'} className="h-12 px-6 text-base shadow-2" onClick={onTryAgain}>
              Try again
            </Button>
            <Button variant="outline" className="h-12 px-6 text-base" onClick={onBack}>
              Back to setup
            </Button>
          </div>
        </div>
      </ScrollCenter>
    </ModeFrame>
  )
}
