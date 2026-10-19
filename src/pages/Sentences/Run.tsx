import TypingLine from './TypingLine'
import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import { Button } from '@/components/ui/button'
import { isActivatableButton } from '@/utils/keyboard'
import { advance, createSession, currentItem, isComplete, peekSentence, summarize, typeKey } from '@/utils/sentences/session'
import type { SentenceSession } from '@/utils/sentences/session'
import { isDone } from '@/utils/sentences/turn'
import type { SentenceItem } from '@/utils/sentences/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

type Props = {
  items: SentenceItem[]
  onExit: () => void
  onFinish: (session: SentenceSession) => void
}

/** A text field feeds the session through its own input event, so the global listener must leave every key to it. */
function isTextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

/** After a mouse or touch click the button must not keep the focus: the next Space is a typed character, not a second click. */
function releaseFocus(e: MouseEvent<HTMLButtonElement>) {
  if (e.detail > 0) e.currentTarget.blur()
}

/** Types one sentence per turn, then hands the whole session to the caller once every sentence is done. */
export default function Run({ items, onExit, onFinish }: Props) {
  const [session, setSession] = useState<SentenceSession>(() => createSession(items))
  // The listener and the timer read this ref, updated synchronously, so a burst of keys never works off a stale render
  const sessionRef = useRef(session)
  const updateSession = useCallback((next: SentenceSession) => {
    sessionRef.current = next
    setSession(next)
  }, [])
  const finished = useRef(false)
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)

  const item = currentItem(session)
  const stats = useMemo(() => summarize(session), [session])
  const turnDone = item !== undefined && isDone(session.turn)

  const requestExit = useCallback(() => {
    const current = sessionRef.current
    const typedSomething = current.results.length > 0 || current.turn.startedAt !== null
    if (typedSomething && !window.confirm('Leave this run?')) return
    onExit()
  }, [onExit])

  // The parent owns the result screen; onFinish runs once, as soon as the last sentence is recorded
  useEffect(() => {
    if (!isComplete(session) || finished.current) return
    finished.current = true
    onFinish(sessionRef.current)
  }, [session, onFinish])

  // One listener for the whole screen: characters feed the turn, everything else is left to the page
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // AltGr (reported as Ctrl+Alt on Windows) types a character on many layouts, so it is not a shortcut
      const altGraph = e.getModifierState('AltGraph')
      if (((e.ctrlKey || e.altKey) && !altGraph) || e.metaKey || e.repeat) return
      if (e.key === 'Escape') {
        e.preventDefault()
        requestExit()
        return
      }
      // A focused text field feeds the session itself; a focused enabled button keeps Space/Enter to activate it
      if (isTextTarget(e.target)) return
      if (isActivatableButton(e.target) && (e.key === ' ' || e.key === 'Enter')) return
      if (e.key.length !== 1) return
      if (e.key === ' ' || e.key === "'" || e.key === '/') e.preventDefault()
      updateSession(typeKey(sessionRef.current, e.key, Date.now()))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestExit, updateSession])

  // Hold the finished sentence for a moment so its last character is seen, then move on; a second trigger is harmless
  useEffect(() => {
    if (!turnDone) return
    const timer = window.setTimeout(() => updateSession(advance(sessionRef.current)), 400)
    return () => window.clearTimeout(timer)
  }, [turnDone, session.index, updateSession])

  if (!item) return null

  const position = session.index + 1
  // The word to recall stays hidden until the learner peeks; a screen reader hears the same blank
  const masked = !session.turn.peeked
  const spoken = masked ? `${item.text.slice(0, item.target.start)}blank${item.text.slice(item.target.end)}` : item.text

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-3xl gap-6">
        <div className="flex w-full flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {position} / {session.items.length} · {Math.round(stats.accuracy * 100)}% · {Math.round(stats.wpm)} wpm
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {masked && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  releaseFocus(e)
                  updateSession(peekSentence(sessionRef.current))
                }}
              >
                Peek
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={requestExit}>
              Exit
            </Button>
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <TypingLine text={item.text} typed={session.turn.typed} lastWrong={session.turn.lastWrong} target={item.target} masked={masked} />
          {item.trans && <p className="text-center text-muted-foreground">{item.trans}</p>}
          {masked && (
            <p className="text-xs text-muted-foreground">Type the whole sentence: recall the hidden word, or press Peek to reveal it</p>
          )}
        </div>

        {coarse && (
          <input
            type="text"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Type here"
            placeholder="Type here"
            className="w-full rounded-md border border-border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
            onInput={(e) => {
              for (const ch of e.currentTarget.value) updateSession(typeKey(sessionRef.current, ch, Date.now()))
              e.currentTarget.value = ''
            }}
          />
        )}

        <p className="sr-only" aria-live="polite">
          {spoken}
        </p>
      </ScrollCenter>
    </ModeFrame>
  )
}
