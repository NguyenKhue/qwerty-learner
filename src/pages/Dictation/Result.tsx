import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DictationItem } from '@/utils/dictation/items'
import type { SentenceResult, SentenceSummary } from '@/utils/sentences/session'
import type { CSSProperties } from 'react'

const staggerStep = (i: number) => ({ '--i': i } as CSSProperties)

function formatTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

const mistakesOf = (result: SentenceResult<DictationItem>) => result.wrong + (result.peeked ? 1 : 0)

type Props = {
  summary: SentenceSummary<DictationItem>
  onPractiseMistakes: () => void
  onReplayVideo: () => void
  onBack: () => void
}

export default function DictationResult({ summary, onPractiseMistakes, onReplayVideo, onBack }: Props) {
  const stats = [
    { label: 'Speed', value: `${Math.round(summary.wpm)} WPM` },
    { label: 'Accuracy', value: `${Math.round(summary.accuracy * 100)}%` },
    { label: 'Time', value: formatTime(summary.ms) },
    { label: 'Sentences', value: String(summary.completed) },
  ]
  const hasMistakes = summary.missed.length > 0

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-2xl">
        <div className="stagger flex w-full flex-col items-center gap-6">
          <Card className="w-full space-y-4" style={staggerStep(0)}>
            <p className="text-sm text-muted-foreground">Dictation finished</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="num text-2xl font-semibold tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {hasMistakes ? (
            <Card className="w-full space-y-2" style={staggerStep(1)}>
              <p className="text-sm font-medium text-muted-foreground">Sentences to review</p>
              <ul className="space-y-3">
                {summary.missed.map((result, index) => (
                  <li key={index} className="space-y-0.5">
                    <p className="font-medium">
                      {result.item.en}{' '}
                      <span className="num text-sm text-muted-foreground">
                        {mistakesOf(result)} {mistakesOf(result) === 1 ? 'mistake' : 'mistakes'}
                      </span>
                    </p>
                    {result.item.vi && <p className="text-sm text-muted-foreground">{result.item.vi}</p>}
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
            {hasMistakes && (
              <Button className="h-12 px-6 text-base shadow-2" onClick={onPractiseMistakes}>
                Practise mistakes
              </Button>
            )}
            <Button variant={hasMistakes ? 'outline' : 'default'} className="h-12 px-6 text-base shadow-2" onClick={onReplayVideo}>
              Replay the video
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
