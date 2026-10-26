import { SoundIcon } from './SoundIcon'
import usePronunciationSound from '@/hooks/usePronunciation'
import type { Word } from '@/typings'
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react'
import React from 'react'

export const WordPronunciationIcon = React.forwardRef<
  WordPronunciationIconRef,
  {
    word: Word
    lang: string
    className?: string
    iconClassName?: string
    /** Plays the word on its own once for each new value, as soon as its sound has loaded (null: never). */
    autoPlay?: string | null
  }
>(({ word, lang, className, iconClassName, autoPlay = null }, ref) => {
  const currentWord = () => {
    if (lang === 'hapin') {
      if (/[\u0400-\u04FF]/.test(word.notation || '')) {
        // Kazakh written in the Cyrillic alphabet
        return word.notation || ''
      } else {
        // Kazakh written in the legacy Arabic-based script
        return word.trans[2]
      }
    } else {
      return word.name
    }
  }
  const { play, stop, isPlaying, ready } = usePronunciationSound(currentWord())

  const playSound = useCallback(() => {
    stop()
    play()
  }, [play, stop])

  useEffect(() => {
    return stop
  }, [word, stop])

  // Playing before the sound has loaded is silently ignored, so the automatic play waits for it
  const played = useRef<string | null>(null)
  useEffect(() => {
    if (autoPlay === null || !ready || played.current === autoPlay) return
    played.current = autoPlay
    playSound()
  }, [autoPlay, ready, playSound])

  useImperativeHandle(
    ref,
    () => ({
      play: playSound,
    }),
    [playSound],
  )

  return (
    <SoundIcon
      animated={isPlaying}
      onClick={playSound}
      className={`cursor-pointer text-muted-foreground ${className}`}
      iconClassName={iconClassName}
    />
  )
})

WordPronunciationIcon.displayName = 'WordPronunciationIcon'

export type WordPronunciationIconRef = {
  play: () => void
}
