import type { ICardProgress } from '@/utils/db/record'
import { isDue } from '@/utils/srs/queue'
import type { Grade } from '@/utils/srs/scheduler'

/**
 * The SRS grade an answer should record, or null when nothing should be written.
 * Wrong → again (this also introduces a never-studied word as a learning card).
 * Correct → good, but only for a card that is currently due; otherwise the answer only counts toward the quiz score.
 */
export function srsEffect(correct: boolean, card: ICardProgress | undefined, now: number): Grade | null {
  if (!correct) return 'again'
  return card !== undefined && isDue(card, now) ? 'good' : null
}
