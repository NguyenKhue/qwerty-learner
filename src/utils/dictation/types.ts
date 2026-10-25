/** One sentence of a video: when it is spoken (seconds), what is said, and its Vietnamese translation when there is one. */
export type DictationSentence = { start: number; end: number; en: string; vi?: string; viSource?: 'youtube' | 'ai' }

/** How far the learner got in a video. `position` is the index of the next sentence to type. */
export type VideoProgress = { position: number; correct: number; wrong: number; finished: boolean; updatedAt: number }

/** A prepared video as it is cached in the data folder. */
export type DictationVideo = {
  id: string
  title: string
  channel: string
  durationSec: number
  subtitleKind: 'manual' | 'auto'
  sentences: DictationSentence[]
  preparedAt: number
  /** Why some sentences have no Vietnamese, when that happened (for example the translation tool was missing). */
  note?: string
  progress?: VideoProgress
}

/** A prepared video in a list, without its sentences. */
export type DictationVideoSummary = Omit<DictationVideo, 'sentences'> & { sentenceCount: number }

export type DictationErrorCode = 'NO_YTDLP' | 'NO_SUBTITLES' | 'FETCH_FAILED' | 'TIMEOUT' | 'BAD_VIDEO'

/** Where the preparation of a video stands. A cached video is `ready`; a failed one stays `error` until it is prepared again. */
export type DictationStatus = {
  state: 'idle' | 'running' | 'ready' | 'error'
  step?: 'subtitles' | 'sentences' | 'translating'
  error?: { code: DictationErrorCode; message: string }
}
