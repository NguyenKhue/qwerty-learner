import MatchBoard from './MatchBoard'
import Layout from '@/components/Layout'
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

  const message = (text: string, tone = 'text-gray-500') => (
    <Layout>
      <p className={`m-auto ${tone}`}>{text}</p>
    </Layout>
  )

  if (!dict) return message('Loading…')
  if (error && !words) return message('Could not load the words of this set.', 'text-red-600')
  if (!words) return message('Loading…')

  if (tiles) {
    return <MatchBoard key={round} dictId={id} tiles={tiles} onBestChange={setBest} onRestart={start} onBack={() => setTiles(null)} />
  }

  return (
    <Layout>
      <div className="flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-800 dark:text-gray-200">{dict.name}</h1>
          <Button size="sm" variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
        {playable ? (
          <div className="space-y-4 rounded-lg bg-white p-6 text-gray-700 shadow dark:bg-gray-800 dark:text-gray-300">
            <p>Match 6 words with their meanings as fast as you can.</p>
            {best !== null && <p className="text-sm text-gray-500">Best time: {formatDuration(best)}</p>}
            <Button onClick={start}>Start</Button>
          </div>
        ) : (
          <p className="rounded-lg bg-white p-6 text-gray-600 shadow dark:bg-gray-800 dark:text-gray-300">
            This set cannot be played yet: it needs at least 6 words with different meanings.
          </p>
        )}
      </div>
    </Layout>
  )
}
