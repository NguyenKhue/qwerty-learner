import MatchBoard from './MatchBoard'
import { InlineLoading } from '@/components/Loading'
import { ModeFrame, ModePage, PageMessage } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCurrentDictId } from '@/hooks/useCurrentDictId'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { formatDuration, readBest } from '@/utils/match/best'
import { buildBoard, canPlay } from '@/utils/match/board'
import type { Tile } from '@/utils/match/board'
import { useCallback, useMemo, useState } from 'react'

// Keyed by id so moving between two sets in place starts from a clean state
export default function MatchRoute() {
  const id = useCurrentDictId()
  if (id === null) return <InlineLoading />
  return <Match key={id} id={id} />
}

function Match({ id }: { id: string }) {
  const { dict, words, error } = useDictionaryWords(id)
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  // Bumped on every start so MatchBoard remounts with a fresh game ("Play again")
  const [round, setRound] = useState(0)
  const [best, setBest] = useState<number | null>(() => readBest(id))

  const playable = useMemo(() => (words ? canPlay(words) : false), [words])

  const start = useCallback(() => {
    if (!words) return
    const board = buildBoard({ words })
    if (board.length === 0) return
    setRound((r) => r + 1)
    setTiles(board)
  }, [words])

  const message = (text: string, tone: 'muted' | 'error' = 'muted') => (
    <ModeFrame>
      <PageMessage text={text} tone={tone} />
    </ModeFrame>
  )

  if (!dict) return message('Loading…')
  if (error && !words) return message('Could not load the words of this set.', 'error')
  if (!words) return message('Loading…')

  if (tiles) {
    return <MatchBoard key={round} dictId={id} tiles={tiles} onBestChange={setBest} onRestart={start} onBack={() => setTiles(null)} />
  }

  return (
    <ModeFrame>
      <ModePage title="Match" subtitle={dict.name}>
        {playable ? (
          <Card className="space-y-4">
            <p>Match 6 words with their meanings as fast as you can.</p>
            {best !== null && (
              <div>
                <p className="text-sm text-muted-foreground">Best time</p>
                <p className="num text-5xl font-semibold tracking-tight">{formatDuration(best)}</p>
              </div>
            )}
            <Button className="h-12 px-6 text-base shadow-2" onClick={start}>
              Start
            </Button>
          </Card>
        ) : (
          <Card className="text-muted-foreground">This set cannot be played yet: it needs at least 6 words with different meanings.</Card>
        )}
      </ModePage>
    </ModeFrame>
  )
}
