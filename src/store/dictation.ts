import type { DictationSpeed } from '@/utils/dictation/settings'
import { atomWithStorage } from 'jotai/utils'

/** Playback speed of dictation videos. Always pass the value through `sanitizeSpeed` before using it. */
export const dictationSpeedAtom = atomWithStorage<DictationSpeed>('dictationSpeed', 1)

/** Whether YouTube's own subtitles are shown on the video (off by default: they would give the sentence away). */
export const dictationCaptionsAtom = atomWithStorage<boolean>('dictationCaptions', false)
