import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDuration, readBest, updateBest, writeBest } from '@/utils/match/best'
import type { Tile } from '@/utils/match/board'
import { clearMismatch, createGame, elapsed, isFinished, isTileMatched, select } from '@/utils/match/game'
import type { GameState } from '@/utils/match/game'
import { cn } from '@/utils/ui'
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  dictId: string
  tiles: Tile[]
  onBestChange: (best: number | null) => void
  onRestart: () => void
  onBack: () => void
}

const MISMATCH_FLASH_MS = 700

const STAT_CHIP = 'inline-flex items-center rounded-full bg-muted px-3 py-1 text-sm font-medium num'

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
      <ModeFrame>
        <ScrollCenter className="max-w-xl gap-6">
          <Card className="w-full animate-enter-up">
            <p className="text-sm text-muted-foreground">All pairs matched</p>
            <p className="num mt-1 text-5xl font-semibold tracking-tight">{formatDuration(result.time)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {game.mistakes} {game.mistakes === 1 ? 'mistake' : 'mistakes'}
              {result.best !== null && ` · best ${formatDuration(result.best)}`}
            </p>
            {result.isNewBest && <p className="mt-2 font-medium text-accent">New best time!</p>}
          </Card>
          <div className="flex gap-3">
            <Button className="h-12 px-6 text-base shadow-2" onClick={onRestart}>
              Play again
            </Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
        </ScrollCenter>
      </ModeFrame>
    )
  }

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-4xl gap-6">
        <div className="flex w-full items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={STAT_CHIP}>{formatDuration(elapsed(game, now))}</span>
            <span className={STAT_CHIP}>
              {game.matched.length} / {game.tiles.length / 2} matched
            </span>
            <span className={STAT_CHIP}>
              {game.mistakes} {game.mistakes === 1 ? 'mistake' : 'mistakes'}
            </span>
          </div>
          <Button variant="outline" onClick={onBack}>
            Exit
          </Button>
        </div>

        {/* Each tile sits in a wrapper that carries the entrance stagger, so the tile's own pop and shake never fight it */}
        <div className="stagger grid w-full grid-cols-2 gap-3 md:grid-cols-3">
          {game.tiles.map((tile, index) => {
            const matched = isTileMatched(game, tile)
            const selected = game.selected === tile.id
            const wrong = game.mismatch !== null && game.mismatch.indexOf(tile.id) !== -1
            return (
              <div key={tile.id} className="h-full" style={{ '--i': Math.min(index, 12) } as CSSProperties}>
                <button
                  disabled={matched}
                  aria-hidden={matched}
                  aria-pressed={selected}
                  onClick={() => onTile(tile.id)}
                  // Matched tiles stay in the grid (dimmed) so the layout does not jump
                  className={cn(
                    'h-full min-h-[56px] w-full rounded-xl border border-border bg-card p-3 text-center text-card-foreground shadow-1 transition-[transform,box-shadow,border-color,opacity] duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tile.kind === 'word' ? 'text-lg font-medium' : 'text-sm',
                    matched && 'pointer-events-none opacity-50 shadow-none [animation:pop_var(--dur-base)_var(--ease-out)]',
                    !matched && !wrong && 'hover:-translate-y-0.5 hover:shadow-2',
                    selected && !matched && '-translate-y-0.5 border-primary ring-2 ring-ring',
                    wrong && 'animate-shake border-destructive',
                  )}
                >
                  {tile.text}
                </button>
              </div>
            )
          })}
        </div>
      </ScrollCenter>
    </ModeFrame>
  )
}
