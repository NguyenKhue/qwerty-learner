import { useYouTubePlayer } from './useYouTubePlayer'
import { ModeFrame } from '@/components/ModePage'
import ScrollCenter from '@/components/ScrollCenter'
import TypingLine from '@/pages/Sentences/TypingLine'
import type { DictationItem } from '@/utils/dictation/items'
import { typeDictationKey } from '@/utils/dictation/session'
import { isActivatableButton } from '@/utils/keyboard'
import { advance, createSession, currentItem, isComplete, peekSentence, summarize } from '@/utils/sentences/session'
import type { SentenceSession } from '@/utils/sentences/session'
import { isDone } from '@/utils/sentences/turn'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import IconEye from '~icons/tabler/eye'
import IconEyeOff from '~icons/tabler/eye-off'
import IconReplay from '~icons/tabler/rotate-clockwise'
import IconX from '~icons/tabler/x'

type Props = {
  videoId: string
  items: DictationItem[]
  /** Number of sentences of the whole video, for the position shown. */
  total: number
  onExit: () => void
  onFinish: (session: SentenceSession<DictationItem>) => void
  /** Called after each sentence with the session so far (not called for a practice run). */
  onProgress?: (session: SentenceSession<DictationItem>) => void
}

const SOURCE_LABEL = { ai: 'AI translation', youtube: 'YouTube translation' } as const

/** A text field feeds the session through its own input event, so the global listener must leave every key to it. */
function isTextTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

/** After a mouse or touch click the button must not keep the focus: the next Space is a typed character, not a second click. */
function releaseFocus(e: MouseEvent<HTMLButtonElement>) {
  if (e.detail > 0) e.currentTarget.blur()
}

/** A round icon button on the video, like YouTube's own controls; its name is in `label` (tooltip and screen readers). */
function VideoControl({
  label,
  large = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  large?: boolean
  disabled?: boolean
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`pointer-events-auto flex items-center justify-center rounded-full bg-background/70 text-foreground shadow-2 backdrop-blur transition-[transform,background-color] duration-fast hover:scale-105 hover:bg-background/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 disabled:opacity-40 ${
        large ? 'h-16 w-16' : 'h-11 w-11'
      }`}
    >
      {children}
    </button>
  )
}

/** Plays one sentence of the video, then the learner types it from blanks; the next sentence plays once it is typed. */
export default function DictationRun({ videoId, items, total, onExit, onFinish, onProgress }: Props) {
  const [session, setSession] = useState(() => createSession(items))
  const sessionRef = useRef(session)
  const updateSession = useCallback((next: SentenceSession<DictationItem>) => {
    sessionRef.current = next
    setSession(next)
  }, [])
  const finished = useRef(false)
  const [playing, setPlaying] = useState(false)
  /** The index of the sentence whose text is shown, if any. */
  const [revealedAt, setRevealedAt] = useState<number | null>(null)
  const [coarse] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)
  const { containerRef, state: playerState, playSegment, pause } = useYouTubePlayer(videoId, () => setPlaying(false))

  const item = currentItem(session)
  const stats = useMemo(() => summarize(session), [session])
  const turnDone = item !== undefined && isDone(session.turn)

  const play = useCallback(() => {
    const current = currentItem(sessionRef.current)
    if (!current) return
    setPlaying(true)
    playSegment(current.start, current.end)
  }, [playSegment])

  // Each sentence plays as soon as its turn starts and the player is ready
  useEffect(() => {
    if (playerState === 'ready') play()
  }, [playerState, session.index, play])

  // No confirmation: progress is saved after every sentence, so leaving loses at most the sentence being typed (and a blocked
  // or auto-dismissed dialog would otherwise make Exit do nothing)
  const requestExit = useCallback(() => {
    pause()
    onExit()
  }, [onExit, pause])

  useEffect(() => {
    if (!isComplete(session) || finished.current) return
    finished.current = true
    pause()
    onFinish(sessionRef.current)
  }, [session, onFinish, pause])

  // Progress is saved after every sentence, so leaving in the middle loses nothing
  const savedResults = useRef(0)
  useEffect(() => {
    if (session.results.length === savedResults.current) return
    savedResults.current = session.results.length
    onProgress?.(session)
  }, [session, onProgress])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const altGraph = e.getModifierState('AltGraph')
      if (((e.ctrlKey || e.altKey) && !altGraph) || e.metaKey || e.repeat) return
      if (e.key === 'Escape') {
        e.preventDefault()
        requestExit()
        return
      }
      if (isTextTarget(e.target)) return
      if (isActivatableButton(e.target) && (e.key === ' ' || e.key === 'Enter')) return
      if (e.key.length !== 1) return
      if (e.key === ' ' || e.key === "'" || e.key === '/') e.preventDefault()
      updateSession(typeDictationKey(sessionRef.current, e.key, Date.now()))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [requestExit, updateSession])

  useEffect(() => {
    if (!turnDone) return
    const timer = window.setTimeout(() => updateSession(advance(sessionRef.current)), 400)
    return () => window.clearTimeout(timer)
  }, [turnDone, session.index, updateSession])

  if (!item) return null

  // Show/Hide toggles the sentence for this turn; the first time it is shown counts one mistake (a peek), hiding it again is free
  const masked = revealedAt !== session.index
  const playerMessage =
    playerState === 'blocked'
      ? 'The owner of this video does not allow it to be played here. Choose another video.'
      : playerState === 'error'
      ? 'The YouTube player could not load. Check the internet connection and try again.'
      : null

  return (
    <ModeFrame>
      <ScrollCenter className="max-w-3xl gap-5">
        <p className="num w-full text-sm text-muted-foreground">
          {item.index + 1} / {total} · {Math.round(stats.accuracy * 100)}% · {Math.round(stats.wpm)} wpm
        </p>

        <div className="group relative w-full">
          {/* The player never takes the keyboard focus: typing always goes to the sentence */}
          <div ref={containerRef} className="pointer-events-none aspect-video w-full overflow-hidden rounded-xl bg-muted" aria-hidden />
          {/* The controls sit in the middle of the video, as on YouTube: hidden while a sentence plays, back on hover or pause */}
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center gap-5 transition-opacity duration-300 focus-within:opacity-100 group-hover:opacity-100 ${
              playing ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <VideoControl
              label={masked ? 'Show the sentence' : 'Hide the sentence'}
              onClick={(e) => {
                releaseFocus(e)
                if (!masked) {
                  setRevealedAt(null)
                  return
                }
                if (!sessionRef.current.turn.peeked) updateSession(peekSentence(sessionRef.current))
                setRevealedAt(sessionRef.current.index)
              }}
            >
              {masked ? <IconEye className="h-5 w-5" /> : <IconEyeOff className="h-5 w-5" />}
            </VideoControl>
            <VideoControl
              large
              label="Replay the sentence"
              disabled={playerState !== 'ready'}
              onClick={(e) => {
                releaseFocus(e)
                play()
              }}
            >
              <IconReplay className="h-8 w-8" />
            </VideoControl>
            <VideoControl label="Exit" onClick={requestExit}>
              <IconX className="h-5 w-5" />
            </VideoControl>
          </div>
        </div>
        {playerMessage && (
          <p role="alert" className="text-center text-sm text-destructive">
            {playerMessage}
          </p>
        )}

        <div className="flex w-full flex-col items-center gap-3">
          <TypingLine
            text={item.text}
            typed={session.turn.typed}
            lastWrong={session.turn.lastWrong}
            target={{ start: 0, end: item.text.length }}
            masked={masked}
          />
          {!masked && <p className="text-center text-sm text-muted-foreground">{item.en}</p>}
          {item.vi && (
            <p className="text-center text-muted-foreground">
              {item.vi}
              {item.viSource && <span className="ml-2 align-middle text-xs opacity-70">· {SOURCE_LABEL[item.viSource]}</span>}
            </p>
          )}
          {masked && <p className="text-xs text-muted-foreground">Type what you hear. Case and punctuation do not matter.</p>}
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
              for (const ch of e.currentTarget.value) updateSession(typeDictationKey(sessionRef.current, ch, Date.now()))
              e.currentTarget.value = ''
            }}
          />
        )}

        <p className="sr-only" aria-live="polite">
          {masked ? `Sentence ${item.index + 1}: listen and type it` : item.en}
        </p>
      </ScrollCenter>
    </ModeFrame>
  )
}
