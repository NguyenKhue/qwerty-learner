import { DAY_MS, HOUR_MS, MINUTE_MS, addLocalDays, startOfLocalDay } from './time'
import type { ICardProgress } from '@/utils/db/record'

export type Grade = 'again' | 'hard' | 'good' | 'easy'
export const GRADES: Grade[] = ['again', 'hard', 'good', 'easy']

export type CardIdentity = { dict: string; word: string }

export const INITIAL_EASE = 2.5
export const MIN_EASE = 1.3
export const MAX_INTERVAL_DAYS = 365
export const LEARNING_STEP_MS = 10 * MINUTE_MS

const clampInterval = (days: number) => Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)))
const clampEase = (ease: number) => Math.max(MIN_EASE, Math.round(ease * 100) / 100)

function review(base: ICardProgress, interval: number, ease: number, now: number): ICardProgress {
  const days = clampInterval(interval)
  return { ...base, state: 'review', interval: days, ease: clampEase(ease), due: addLocalDays(now, days) }
}

function learningStep(base: ICardProgress, now: number, extra: Partial<ICardProgress> = {}): ICardProgress {
  return { ...base, ...extra, state: 'learning', due: now + LEARNING_STEP_MS }
}

/**
 * The state of a card after it was graded. Pure: never mutates `card`.
 * `identity` is needed because a brand-new card has no row to take `dict`/`word` from.
 */
export function nextState(card: ICardProgress | undefined, identity: CardIdentity, grade: Grade, now: number): ICardProgress {
  if (!card) {
    const base: ICardProgress = {
      dict: identity.dict,
      word: identity.word,
      state: 'review',
      due: now,
      interval: 0,
      ease: INITIAL_EASE,
      reps: 1,
      lapses: 0,
      firstSeen: now,
      lastReviewed: now,
    }
    if (grade === 'again') return learningStep(base, now)
    return review(base, grade === 'easy' ? 3 : 1, INITIAL_EASE, now)
  }

  const ease = Number.isFinite(card.ease) ? card.ease : INITIAL_EASE
  const interval = Number.isFinite(card.interval) && card.interval >= 1 ? card.interval : 1
  const base: ICardProgress = { ...card, ease, interval, reps: card.reps + 1, lastReviewed: now }

  if (card.state === 'learning') {
    if (grade === 'again' || grade === 'hard') return learningStep(base, now)
    return review(base, grade === 'easy' ? 3 : 1, ease, now)
  }

  switch (grade) {
    case 'again':
      return learningStep(base, now, { interval: 1, ease: clampEase(ease - 0.2), lapses: card.lapses + 1 })
    case 'hard':
      return review(base, interval * 1.2, ease - 0.15, now)
    case 'good':
      return review(base, interval * ease, ease, now)
    default:
      return review(base, interval * ease * 1.3, ease + 0.15, now)
  }
}

/** Short label for the time until `due`: 10m, 1d, 2mo, 1y. */
export function describeInterval(due: number, now: number): string {
  const diff = due - now
  if (diff < HOUR_MS) return `${Math.max(1, Math.round(diff / MINUTE_MS))}m`
  const days = Math.max(1, Math.round((startOfLocalDay(due) - startOfLocalDay(now)) / DAY_MS))
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}

/** What each grade button would schedule, for the labels on the buttons. */
export function previewLabels(card: ICardProgress | undefined, identity: CardIdentity, now: number): Record<Grade, string> {
  const label = (grade: Grade) => describeInterval(nextState(card, identity, grade, now).due, now)
  return { again: label('again'), hard: label('hard'), good: label('good'), easy: label('easy') }
}
