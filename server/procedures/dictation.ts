import type { DictationService } from '../dictation/service'
import { getVideo, listVideos, removeVideo, replaceSentences, saveProgress } from '../repo/videos'
import type { Ctx, Handler } from './support'
import { ProcedureError, argArray, argInteger, argObject, argString } from './support'
import type { DictationSentencePatch, ProcedureName } from '@/data/contract'
import { alignLines } from '@/utils/dictation/lyrics'
import { dictationText } from '@/utils/dictation/normalize'
import type { DictationSentence, DictationVideo } from '@/utils/dictation/types'
import { isVideoId } from '@/utils/dictation/videoId'

/** Reads argument 0 as a YouTube video id: nothing else may reach the cache, the jobs or a command. */
function videoIdArg(args: unknown[]): string {
  const id = argString(args, 0, 'videoId')
  if (!isVideoId(id)) throw new ProcedureError('BAD_REQUEST', 'Argument 0 (videoId) must be a YouTube video id')
  return id
}

function serviceOf(ctx: Ctx): DictationService {
  if (!ctx.dictation) throw new ProcedureError('INTERNAL', 'Dictation is not available on this server')
  return ctx.dictation
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Reads a sentence index: a whole number inside the video's sentence list. */
function sentenceIndexArg(args: unknown[], index: number, name: string, sentences: DictationSentence[]): number {
  const value = argInteger(args, index, name)
  if (value < 0 || value >= sentences.length)
    throw new ProcedureError('BAD_REQUEST', `Argument ${index} (${name}) must be an index in the sentence list`)
  return value
}

/** The cached video a write works on; it must exist and not be being prepared (a retranslation in progress is fine). */
function editableVideo(ctx: Ctx, id: string): DictationVideo {
  if (serviceOf(ctx).preparing(id)) throw new ProcedureError('CONFLICT', `Video ${id} is being prepared`)
  const video = getVideo(ctx.db, id)
  if (!video) throw new ProcedureError('NOT_FOUND', `Video ${id} is not prepared`)
  return video
}

/** Saves new sentences for a video, keeping its note, and translates the sentences that lost their Vietnamese. */
function saveSentences(ctx: Ctx, id: string, video: DictationVideo, sentences: DictationSentence[], translated: boolean): void {
  replaceSentences(ctx.db, id, sentences, video.note ?? null)
  if (translated) serviceOf(ctx).retranslate(id)
}

const wordsOf = (en: string): string[] => en.trim().split(/\s+/)

export const handlers: Partial<Record<ProcedureName, Handler>> = {
  'dictation.videos': (ctx) => listVideos(ctx.db),

  'dictation.get': (ctx, args) => getVideo(ctx.db, videoIdArg(args)),

  'dictation.prepare': (ctx, args) => {
    const id = videoIdArg(args)
    return serviceOf(ctx).prepare(id)
  },

  'dictation.status': (ctx, args) => {
    const id = videoIdArg(args)
    return serviceOf(ctx).status(id)
  },

  'dictation.saveProgress': (ctx, args) => {
    const id = videoIdArg(args)
    const raw = args[1] as Record<string, unknown> | null | undefined
    if (
      !raw ||
      typeof raw !== 'object' ||
      !isCount(raw.position) ||
      !isCount(raw.correct) ||
      !isCount(raw.wrong) ||
      typeof raw.finished !== 'boolean'
    ) {
      throw new ProcedureError(
        'BAD_REQUEST',
        'Argument 1 (progress) must have whole numbers position, correct, wrong and a boolean finished',
      )
    }
    if (!getVideo(ctx.db, id)) throw new ProcedureError('NOT_FOUND', `Video ${id} is not prepared`)
    saveProgress(ctx.db, id, { position: raw.position, correct: raw.correct, wrong: raw.wrong, finished: raw.finished }, ctx.now())
    return null
  },

  'dictation.remove': (ctx, args) => {
    removeVideo(ctx.db, videoIdArg(args))
    return null
  },

  'dictation.importLines': (ctx, args) => {
    const id = videoIdArg(args)
    const video = editableVideo(ctx, id)
    const raw = argArray(args, 1, 'lines')
    if (raw.length < 1 || raw.length > 2000) throw new ProcedureError('BAD_REQUEST', 'Argument 1 (lines) must have 1 to 2000 lines')
    const lines = raw.map((line) => {
      if (typeof line !== 'string' || line.length > 500)
        throw new ProcedureError('BAD_REQUEST', 'Every line must be a string of at most 500 characters')
      return line
    })
    let aligned
    try {
      aligned = alignLines(video.sentences, lines)
    } catch (error) {
      throw new ProcedureError('BAD_REQUEST', error instanceof Error ? error.message : 'The lyrics do not match this video')
    }
    replaceSentences(ctx.db, id, aligned.sentences, null)
    serviceOf(ctx).retranslate(id)
    return aligned.report
  },

  'dictation.editSentence': (ctx, args) => {
    const id = videoIdArg(args)
    const video = editableVideo(ctx, id)
    const index = sentenceIndexArg(args, 1, 'index', video.sentences)
    const patch = argObject(args, 2, 'patch') as DictationSentencePatch
    const current = video.sentences[index]
    const next: DictationSentence = { ...current }

    if (patch.en !== undefined) {
      if (typeof patch.en !== 'string') throw new ProcedureError('BAD_REQUEST', 'patch.en must be a sentence that can be typed')
      if (dictationText(patch.en) === null) throw new ProcedureError('BAD_REQUEST', 'patch.en must be a sentence that can be typed')
    }
    if (patch.vi !== undefined && typeof patch.vi !== 'string') throw new ProcedureError('BAD_REQUEST', 'patch.vi must be a string')
    if (patch.start !== undefined && (typeof patch.start !== 'number' || !Number.isFinite(patch.start)))
      throw new ProcedureError('BAD_REQUEST', 'patch.start must be a finite number')
    if (patch.end !== undefined && (typeof patch.end !== 'number' || !Number.isFinite(patch.end)))
      throw new ProcedureError('BAD_REQUEST', 'patch.end must be a finite number')

    const enChanged = patch.en !== undefined && patch.en !== current.en
    if (enChanged) {
      next.en = patch.en as string
      delete next.vi
      delete next.viSource
    }
    if (patch.vi !== undefined) {
      if (patch.vi === '') {
        delete next.vi
        delete next.viSource
      } else {
        next.vi = patch.vi
        next.viSource = 'manual'
      }
    }

    const start = patch.start ?? current.start
    const end = patch.end ?? current.end
    if (start < 0 || start >= end)
      throw new ProcedureError('BAD_REQUEST', 'patch.start and patch.end must be finite, with 0 <= start < end')
    next.start = start
    next.end = end

    const sentences = [...video.sentences]
    sentences[index] = next
    saveSentences(ctx, id, video, sentences, next.vi === undefined && (enChanged || current.vi !== undefined))
    return next
  },

  'dictation.mergeSentences': (ctx, args) => {
    const id = videoIdArg(args)
    const video = editableVideo(ctx, id)
    const index = sentenceIndexArg(args, 1, 'index', video.sentences)
    if (index + 1 >= video.sentences.length)
      throw new ProcedureError('BAD_REQUEST', 'Argument 1 (index) must leave a following sentence to merge with')
    const first = video.sentences[index]
    const second = video.sentences[index + 1]
    const en = `${first.en} ${second.en}`
    if (dictationText(en) === null) throw new ProcedureError('BAD_REQUEST', 'The merged sentence cannot be typed')
    const merged: DictationSentence = { start: first.start, end: second.end, en }
    const sentences = [...video.sentences]
    sentences.splice(index, 2, merged)
    saveSentences(ctx, id, video, sentences, first.vi !== undefined || second.vi !== undefined)
    return merged
  },

  'dictation.splitSentence': (ctx, args) => {
    const id = videoIdArg(args)
    const video = editableVideo(ctx, id)
    const index = sentenceIndexArg(args, 1, 'index', video.sentences)
    const sentence = video.sentences[index]
    const words = wordsOf(sentence.en)
    const atWord = argInteger(args, 2, 'atWord')
    if (atWord < 1 || atWord >= words.length)
      throw new ProcedureError('BAD_REQUEST', 'Argument 2 (atWord) must be inside the words of the sentence')
    const firstEn = words.slice(0, atWord).join(' ')
    const secondEn = words.slice(atWord).join(' ')
    if (dictationText(firstEn) === null || dictationText(secondEn) === null)
      throw new ProcedureError('BAD_REQUEST', 'Both parts of the split sentence must be typable')
    const splitAt =
      Math.round((sentence.start + ((sentence.end - sentence.start) * firstEn.length) / (firstEn.length + secondEn.length)) * 100) / 100
    const first: DictationSentence = { start: sentence.start, end: splitAt, en: firstEn }
    const second: DictationSentence = { start: splitAt, end: sentence.end, en: secondEn }
    const sentences = [...video.sentences]
    sentences.splice(index, 1, first, second)
    saveSentences(ctx, id, video, sentences, sentence.vi !== undefined)
    return [first, second] as [DictationSentence, DictationSentence]
  },

  'dictation.deleteSentence': (ctx, args) => {
    const id = videoIdArg(args)
    const video = editableVideo(ctx, id)
    const index = sentenceIndexArg(args, 1, 'index', video.sentences)
    if (video.sentences.length <= 1) throw new ProcedureError('BAD_REQUEST', 'The last sentence of a video cannot be deleted')
    const sentences = [...video.sentences]
    sentences.splice(index, 1)
    saveSentences(ctx, id, video, sentences, false)
    return null
  },

  'dictation.retranslate': (ctx, args) => {
    const id = videoIdArg(args)
    editableVideo(ctx, id)
    return serviceOf(ctx).retranslate(id)
  },

  'dictation.refetch': (ctx, args) => {
    const id = videoIdArg(args)
    editableVideo(ctx, id)
    return serviceOf(ctx).prepare(id, { refetch: true })
  },
}
