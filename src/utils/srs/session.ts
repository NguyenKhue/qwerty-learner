import type { QueueItem } from './queue'
import type { Grade } from './scheduler'

/**
 * `flipped` is the face being shown (false: front, true: back). `revealed` is whether the back has been seen for the current card:
 * it stays true when the card is turned back to the front, so the word can be rehearsed after reading the meaning, and a grade is
 * accepted from then on.
 */
export type StudySession = { queue: QueueItem[]; flipped: boolean; revealed: boolean; reviewed: number; again: number }

export function createSession(queue: QueueItem[]): StudySession {
  return { queue, flipped: false, revealed: false, reviewed: 0, again: 0 }
}

export function currentItem(session: StudySession): QueueItem | undefined {
  return session.queue[0]
}

/** Shows the back (one-way). Use `toggleFlip` to turn the card either way. */
export function flip(session: StudySession): StudySession {
  if (session.queue.length === 0 || session.flipped) return session
  return { ...session, flipped: true, revealed: true }
}

/** Turns the card over, either way. Showing the back marks the answer as seen. */
export function toggleFlip(session: StudySession): StudySession {
  if (session.queue.length === 0) return session
  return session.flipped ? { ...session, flipped: false } : { ...session, flipped: true, revealed: true }
}

/** Applies a grade to the current card. A no-op until the answer has been seen. `again` puts the card back at the end. */
export function answer(session: StudySession, grade: Grade): StudySession {
  if (session.queue.length === 0 || !session.revealed) return session
  const [head, ...rest] = session.queue
  return {
    queue: grade === 'again' ? rest.concat(head) : rest,
    flipped: false,
    revealed: false,
    reviewed: session.reviewed + 1,
    again: session.again + (grade === 'again' ? 1 : 0),
  }
}
