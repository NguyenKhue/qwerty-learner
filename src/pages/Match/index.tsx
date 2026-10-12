import MatchBoard from './MatchBoard'
import { ModeFrame, ModePage, PageMessage, Panel } from '@/components/ModePage'
import { Button } from '@/components/ui/button'
import { useDictionaryWords } from '@/hooks/useDictionaryWords'
import { currentDictInfoAtom } from '@/store'
import { formatDuration, readBest } from '@/utils/match/best'
import { buildBoard, canPlay } from '@/utils/match/board'
import type { Tile } from '@/utils/match/board'
import { useAtomValue } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Keyed by id so moving between two sets in place starts from a clean state
export default function MatchRoute() {
  const dict = useAtomValue(currentDictInfoAtom)
  return <Match key={dict.id} id={dict.id} />
}

function Match({ id }: { id: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { dict, words, error } = useDictionaryWords(id)
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  // Bumped on every start so MatchBoard remounts with a fresh game ("Play again")
  const [round, setRound] = useState(0)
  const [best, setBest] = useState<number | null>(() => readBest(id))

  const playable = useMemo(() => (words ? canPlay(words) : false), [words])

  // `default` is the key of the first history entry: there is nothing to go back to, so fall back to the dashboard
  const onBack = useCallback(() => (location.key === 'default' ? navigate('/') : navigate(-1)), [location.key, navigate])

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
      <ModePage title={dict.name} onBack={onBack}>
        {playable ? (
          <Panel className="space-y-4">
            <p>Match 6 words with their meanings as fast as you can.</p>
            {best !== null && <p className="text-sm text-muted-foreground">Best time: {formatDuration(best)}</p>}
            <Button onClick={start}>Start</Button>
          </Panel>
        ) : (
          <Panel className="text-muted-foreground">This set cannot be played yet: it needs at least 6 words with different meanings.</Panel>
        )}
      </ModePage>
    </ModeFrame>
  )
}
