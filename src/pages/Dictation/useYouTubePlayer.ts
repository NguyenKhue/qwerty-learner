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
  loadModule?(name: string): void
  setOption?(module: string, option: string, value: unknown): void
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
      events?: { onReady?: () => void; onError?: (event: { data: number }) => void; onStateChange?: (event: { data: number }) => void }
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
/** The player state reported when the video starts playing. */
const PLAYING = 1

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
 * plays it at the chosen speed and pauses at its end, then calls `onSegmentEnd`. YouTube's subtitles are off unless the learner
 * turns them on, since they would show the sentence. `blocked` means the video cannot be embedded; `error` that the player could not load (for example offline).
 */
export function useYouTubePlayer(
  videoId: string,
  onSegmentEnd: () => void,
  settings: { speed: number; captions: boolean } = { speed: 1, captions: false },
): { containerRef: RefObject<HTMLDivElement>; state: PlayerState; playSegment(start: number, end: number): void; pause(): void } {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const pollRef = useRef<number | undefined>(undefined)
  const onEndRef = useRef(onSegmentEnd)
  onEndRef.current = onSegmentEnd
  const [state, setState] = useState<PlayerState>('loading')
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  /** Applies the learner's speed and subtitle choice to the player (YouTube's subtitles stay off unless asked for). */
  const applySettings = useCallback((player: YTPlayer) => {
    const { speed, captions } = settingsRef.current
    player.setPlaybackRate(speed)
    try {
      if (captions) {
        player.loadModule?.('captions')
        player.setOption?.('captions', 'track', { languageCode: 'en' })
      } else {
        player.unloadModule?.('captions')
      }
    } catch {
      // Subtitles that cannot be switched leave the exercise as it is
    }
  }, [])

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
          playerVars: {
            controls: 0,
            disablekb: 1,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            cc_load_policy: settingsRef.current.captions ? 1 : 0,
            cc_lang_pref: 'en',
            fs: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              if (playerRef.current) applySettings(playerRef.current)
              setState('ready')
            },
            // A video whose owner turned subtitles on by default shows them again once it plays: apply the choice again then
            onStateChange: (event) => {
              if (!cancelled && event.data === PLAYING && playerRef.current) applySettings(playerRef.current)
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
  }, [videoId, stopPolling, applySettings])

  // A change made in the settings menu applies at once
  useEffect(() => {
    if (state === 'ready' && playerRef.current) applySettings(playerRef.current)
  }, [state, settings.speed, settings.captions, applySettings])

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
