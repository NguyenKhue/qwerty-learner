import type { DictationService } from '../dictation/service'
import { getVideo, listVideos, removeVideo, saveProgress } from '../repo/videos'
import type { Ctx, Handler } from './support'
import { ProcedureError, argString } from './support'
import type { ProcedureName } from '@/data/contract'
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
}
