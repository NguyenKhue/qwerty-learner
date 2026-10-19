/** A letter or digit: the only characters masked by `_` when the sentence is hidden. */
const BLANKABLE = /[A-Za-z0-9]/

/** Exactly one colour utility at a time, so none of them fight over the generated stylesheet order. */
function characterColour(done: boolean, current: boolean, lastWrong: boolean, inTarget: boolean): string {
  if (done) return 'text-primary'
  if (current && lastWrong) return 'text-destructive'
  return inTarget ? 'text-foreground' : 'text-muted-foreground'
}

type Props = {
  text: string
  typed: number
  lastWrong: boolean
  /** The word to recall: heavier, and shown as `_` while `masked`. */
  target: { start: number; end: number }
  masked: boolean
}

/**
 * One sentence rendered character by character. Typed characters take the primary colour, the character at the cursor is
 * underlined, and a wrong key is also bold and red. The target word is heavier. Colour is never the only signal: the cursor
 * and the wrong key carry an underline and a weight change, and the hidden word shows as `_` for its letters and digits while its
 * spaces and hyphens stay.
 */
export default function TypingLine({ text, typed, lastWrong, target, masked }: Props) {
  return (
    <p className="whitespace-pre-wrap break-words text-center font-mono text-xl leading-relaxed sm:text-2xl">
      {Array.from(text).map((ch, i) => {
        const done = i < typed
        const current = i === typed
        const inTarget = i >= target.start && i < target.end
        const blank = masked && inTarget && !done && BLANKABLE.test(ch)
        const classes = [
          'transition-colors',
          characterColour(done, current, lastWrong, inTarget),
          inTarget ? 'font-semibold' : '',
          current ? 'underline decoration-2 underline-offset-4' : '',
          current && lastWrong ? 'font-bold' : '',
        ]
        return (
          <span key={i} className={classes.filter(Boolean).join(' ')}>
            {blank ? '_' : ch}
          </span>
        )
      })}
      {lastWrong && <span className="sr-only"> wrong key</span>}
    </p>
  )
}
