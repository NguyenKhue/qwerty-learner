import type { Grade } from './scheduler'
import { answer, currentItem } from './session'
import type { StudySession } from './session'

export type GraderDeps = {
  /** The latest session, read synchronously (a ref), not the one captured by the last render. */
  getSession: () => StudySession
  setSession: (session: StudySession) => void
  save: (word: string, grade: Grade) => Promise<unknown>
  onBusy: (busy: boolean) => void
  onError: (error: unknown) => void
}

/**
 * Grades the current card. The session is advanced synchronously, before the save is awaited, so a repeated key press or a
 * double click that arrives while React has not re-rendered yet sees an unflipped session and is ignored (no double review).
 * If the save fails the session is put back so the card can be graded again.
 */
export function createGrader(deps: GraderDeps): (grade: Grade) => Promise<void> {
  let busy = false
  return async (grade) => {
    if (busy) return
    const before = deps.getSession()
    const item = currentItem(before)
    if (!item || !before.flipped) return

    busy = true
    deps.onBusy(true)
    deps.setSession(answer(before, grade))
    try {
      await deps.save(item.word.name, grade)
    } catch (e) {
      deps.setSession(before)
      deps.onError(e)
    } finally {
      busy = false
      deps.onBusy(false)
    }
  }
}
