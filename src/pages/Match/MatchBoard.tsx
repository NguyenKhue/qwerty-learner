import Layout from '@/components/Layout'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { formatDuration, readBest, updateBest, writeBest } from '@/utils/match/best'
import type { Tile } from '@/utils/match/board'
import { clearMismatch, createGame, elapsed, isFinished, isTileMatched, select } from '@/utils/match/game'
import type { GameState } from '@/utils/match/game'
import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  dictId: string
  tiles: Tile[]
  onBestChange: (best: number | null) => void
  onRestart: () => void
  onBack: () => void
}

const MISMATCH_FLASH_MS = 700

export default function MatchBoard({ dictId, tiles, onBestChange, onRestart, onBack }: Props) {
  const [game, setGame] = useState(() => createGame(tiles, Date.now()))
  // Handlers read this ref (updated synchronously) so two clicks in the same tick are both applied in order
  const gameRef = useRef(game)
  const update = useCallback((next: GameState) => {
    gameRef.current = next
    setGame(next)
  }, [])
  const [now, setNow] = useState(() => Date.now())
  const [result, setResult] = useState<{ time: number; best: number | null; isNewBest: boolean } | null>(null)
  const saved = useRef(false)

  const finished = isFinished(game)

  // The clock: computed from timestamps, so a throttled background tab does not lose time
  useEffect(() => {
    if (finished) return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [finished])

  // A wrong guess is flashed for a moment and then cleared (a click clears it sooner)
  useEffect(() => {
    if (!game.mismatch) return
    const timer = window.setTimeout(() => update(clearMismatch(gameRef.current)), MISMATCH_FLASH_MS)
    return () => window.clearTimeout(timer)
  }, [game.mismatch, update])

  // Record the best time once, when the last pair is matched
  useEffect(() => {
    if (!finished || saved.current) return
    saved.current = true
    const time = elapsed(game, Date.now())
    const { best, isNewBest } = updateBest(readBest(dictId), time)
    if (isNewBest && best !== null) {
      writeBest(dictId, best)
      onBestChange(best)
    }
    setResult({ time, best, isNewBest })
  }, [finished, game, dictId, onBestChange])

  const onTile = (tileId: string) => update(select(gameRef.current, tileId, Date.now()))

  if (finished && result) {
    return (
      <Layout>
        <ScrollCenter className="max-w-xl gap-6">
          <div className="w-full rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm text-gray-500">All pairs matched</p>
            <p className="text-4xl font-medium text-gray-800 dark:text-gray-100">{formatDuration(result.time)}</p>
            <p className="mt-2 text-sm text-gray-500">
              {game.mistakes} {game.mistakes === 1 ? 'mistake' : 'mistakes'}
              {result.best !== null && ` · best ${formatDuration(result.best)}`}
            </p>
            {result.isNewBest && <p className="mt-2 text-emerald-600">New best time!</p>}
          </div>
          <div className="flex gap-3">
            <Button onClick={onRestart}>Play again</Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </ScrollCenter>
      </Layout>
    )
  }

  return (
    <Layout>
      <ScrollCenter className="max-w-4xl gap-6">
        <div className="flex w-full items-center justify-between text-sm text-gray-500">
          <span>
            {formatDuration(elapsed(game, now))} · {game.matched.length} / {game.tiles.length / 2} matched · {game.mistakes}{' '}
            {game.mistakes === 1 ? 'mistake' : 'mistakes'}
          </span>
          <Button size="sm" variant="outline" onClick={onBack}>
            Exit
          </Button>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3">
          {game.tiles.map((tile) => {
            const matched = isTileMatched(game, tile)
            const selected = game.selected === tile.id
            const wrong = game.mismatch !== null && game.mismatch.indexOf(tile.id) !== -1
            const style = wrong
              ? 'bg-red-500 text-white'
              : selected
              ? 'bg-indigo-500 text-white'
              : 'bg-white text-gray-800 hover:bg-indigo-50 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700'
            return (
              <button
                key={tile.id}
                disabled={matched}
                aria-hidden={matched}
                aria-pressed={selected}
                onClick={() => onTile(tile.id)}
                // Matched tiles stay in the grid (invisible) so the layout does not jump
                className={`min-h-[4.5rem] rounded-lg px-4 py-3 text-center shadow transition-colors ${
                  tile.kind === 'word' ? 'text-xl font-medium' : 'text-base'
                } ${style} ${matched ? 'invisible' : ''}`}
              >
                {tile.text}
              </button>
            )
          })}
        </div>
      </ScrollCenter>
    </Layout>
  )
}
