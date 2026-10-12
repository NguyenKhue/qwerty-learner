import type { QueueItem } from './queue'
import type { Grade } from './scheduler'

export type StudySession = { queue: QueueItem[]; flipped: boolean; reviewed: number; again: number }

export function createSession(queue: QueueItem[]): StudySession {
  return { queue, flipped: false, reviewed: 0, again: 0 }
}

export function currentItem(session: StudySession): QueueItem | undefined {
  return session.queue[0]
}

export function flip(session: StudySession): StudySession {
  if (session.queue.length === 0 || session.flipped) return session
  return { ...session, flipped: true }
}

/** Applies a grade to the current card. A no-op until the answer has been shown. `again` puts the card back at the end. */
export function answer(session: StudySession, grade: Grade): StudySession {
  if (session.queue.length === 0 || !session.flipped) return session
  const [head, ...rest] = session.queue
  return {
    queue: grade === 'again' ? rest.concat(head) : rest,
    flipped: false,
    reviewed: session.reviewed + 1,
    again: session.again + (grade === 'again' ? 1 : 0),
  }
}
