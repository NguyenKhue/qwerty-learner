import type { ReactNode } from 'react'

type Props = {
  flipped: boolean
  front: ReactNode
  back: ReactNode
  onFlip?: () => void
}

// The surface both faces share, so a flipping card looks exactly like a still one
const FACE = 'flex min-h-[18rem] flex-col justify-center rounded-xl border border-border bg-card p-8 text-card-foreground'
// Only the face turned towards the viewer stays painted; the other one is never shown
const BACKFACE = '[backface-visibility:hidden] [-webkit-backface-visibility:hidden]'
// Both faces sit in the same cell, so the card is as tall as the taller face
const CELL = '[grid-area:1/1]'

/**
 * A card that turns like a real one: the inner element carries the rotation and `preserve-3d`, both faces share one
 * grid cell and the hidden one is removed from the tab order and from pointer events.
 */
export default function FlipCard({ flipped, front, back, onFlip }: Props) {
  // The front is only clickable while it faces the viewer, so the back never turns the card over again
  const clickable = !flipped && Boolean(onFlip)

  return (
    <div className="w-full [perspective:1200px]">
      <div
        className={`relative grid transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none${
          flipped ? ' [transform:rotateY(180deg)]' : ''
        }`}
      >
        <div
          aria-hidden={flipped}
          onClick={clickable ? onFlip : undefined}
          className={`${CELL} ${FACE} ${BACKFACE} items-center text-center${
            flipped ? ' pointer-events-none' : clickable ? ' cursor-pointer' : ''
          }`}
        >
          {front}
        </div>
        <div
          aria-hidden={!flipped}
          className={`${CELL} ${FACE} ${BACKFACE} [transform:rotateY(180deg)]${flipped ? '' : ' pointer-events-none'}`}
        >
          {/* Long meanings scroll inside the card instead of growing it past the viewport */}
          <div className="max-h-[min(60vh,34rem)] overflow-y-auto text-left">{back}</div>
        </div>
      </div>
    </div>
  )
}
