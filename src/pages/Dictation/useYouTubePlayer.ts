import { segmentWindow, shouldStop } from './segment'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** The small part of the YouTube IFrame Player API this page uses. */
type YTPlayer = {
  seekTo(seconds: number, allowSeekAhead: boolean): void
  playVideo(): void
  pauseVideo(): void
  getCurrentTime(): number
  setPlaybackRate(rate: number): void
  unloadModule?(name: string): void
  destroy(): void
}
type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      width?: string
      height?: string
      playerVars?: Record<string, number | string>
      events?: { onReady?: () => void; onError?: (event: { data: number }) => void }
    },
  ) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const API_URL = 'https://www.youtube.com/iframe_api'
const LOAD_TIMEOUT_MS = 15000
const POLL_MS = 100
/** Player errors that mean the owner does not allow the video to be embedded. */
const EMBED_BLOCKED = [101, 150]

let apiPromise: Promise<YTNamespace> | null = null

/** Loads the IFrame Player API once per page; a failed load can be tried again. */
function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    const timer = window.setTimeout(() => reject(new Error('The YouTube player did not load')), LOAD_TIMEOUT_MS)
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT) resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = API_URL
    script.async = true
    script.onerror = () => {
      window.clearTimeout(timer)
      script.remove()
      reject(new Error('The YouTube player could not be loaded'))
    }
    document.head.appendChild(script)
  }).catch((error: unknown) => {
    apiPromise = null
    throw error
  })
  return apiPromise
}

export type PlayerState = 'loading' | 'ready' | 'blocked' | 'error'

/**
 * An embedded YouTube player that plays one sentence at a time: `playSegment` seeks to the sentence (with a short margin),
 * plays it at normal speed and pauses at its end, then calls `onSegmentEnd`. Subtitles are turned off, since they would show the
 * sentence. `blocked` means the video cannot be embedded; `error` that the player could not load (for example offline).
 */
export function useYouTubePlayer(
  videoId: string,
  onSegmentEnd: () => void,
): { containerRef: RefObject<HTMLDivElement>; state: PlayerState; playSegment(start: number, end: number): void; pause(): void } {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const pollRef = useRef<number | undefined>(undefined)
  const onEndRef = useRef(onSegmentEnd)
  onEndRef.current = onSegmentEnd
  const [state, setState] = useState<PlayerState>('loading')

  const stopPolling = useCallback(() => {
    window.clearInterval(pollRef.current)
    pollRef.current = undefined
  }, [])

  useEffect(() => {
    let cancelled = false
    setState('loading')
    // The API replaces the element it is given, so it gets a child that React does not manage
    const host = document.createElement('div')
    containerRef.current?.appendChild(host)
    loadApi()
      .then((YT) => {
        if (cancelled) return
        playerRef.current = new YT.Player(host, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { controls: 0, disablekb: 1, rel: 0, playsinline: 1, iv_load_policy: 3, cc_load_policy: 0, fs: 0 },
          events: {
            onReady: () => {
              if (cancelled) return
              const player = playerRef.current
              player?.setPlaybackRate(1)
              try {
                player?.unloadModule?.('captions')
              } catch {
                // Subtitles that cannot be turned off only make the exercise easier
              }
              setState('ready')
            },
            onError: (event) => {
              if (!cancelled) setState(EMBED_BLOCKED.indexOf(event.data) !== -1 ? 'blocked' : 'error')
            },
          },
        })
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
      stopPolling()
      playerRef.current?.destroy()
      playerRef.current = null
      host.remove()
    }
  }, [videoId, stopPolling])

  const playSegment = useCallback(
    (start: number, end: number) => {
      const player = playerRef.current
      if (!player) return
      const { from, to } = segmentWindow(start, end)
      stopPolling()
      player.seekTo(from, true)
      player.playVideo()
      pollRef.current = window.setInterval(() => {
        if (!shouldStop(player.getCurrentTime(), to)) return
        player.pauseVideo()
        stopPolling()
        onEndRef.current()
      }, POLL_MS)
    },
    [stopPolling],
  )

  const pause = useCallback(() => {
    stopPolling()
    playerRef.current?.pauseVideo()
  }, [stopPolling])

  return { containerRef, state, playSegment, pause }
}
