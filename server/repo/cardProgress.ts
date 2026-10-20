import type { Db } from '../adapter'
import type { ICardProgress } from '@/utils/db/record'

/** A row of `card_progress`. */
export interface CardProgressRow {
  dict: string
  word: string
  state: 'learning' | 'review'
  due: number
  interval: number
  ease: number
  reps: number
  lapses: number
  first_seen: number
  last_reviewed: number
}

/** Rebuilds one card from its row. */
export function rowToCardProgress(row: CardProgressRow): ICardProgress {
  return {
    dict: row.dict,
    word: row.word,
    state: row.state,
    due: row.due,
    interval: row.interval,
    ease: row.ease,
    reps: row.reps,
    lapses: row.lapses,
    firstSeen: row.first_seen,
    lastReviewed: row.last_reviewed,
  }
}

/** Every card of one dict, ordered by word. */
export function byDict(db: Db, dict: string): ICardProgress[] {
  return db.all<CardProgressRow>('SELECT * FROM card_progress WHERE dict = ? ORDER BY word', [dict]).map(rowToCardProgress)
}

/** One card, or null. */
export function get(db: Db, dict: string, word: string): ICardProgress | null {
  const row = db.get<CardProgressRow>('SELECT * FROM card_progress WHERE dict = ? AND word = ?', [dict, word])
  return row ? rowToCardProgress(row) : null
}

/** Inserts a card, or overwrites the card with the same dict and word. */
export function put(db: Db, card: ICardProgress): void {
  db.run(
    `INSERT INTO card_progress (dict, word, state, due, interval, ease, reps, lapses, first_seen, last_reviewed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (dict, word) DO UPDATE SET
       state = excluded.state, due = excluded.due, interval = excluded.interval, ease = excluded.ease,
       reps = excluded.reps, lapses = excluded.lapses, first_seen = excluded.first_seen, last_reviewed = excluded.last_reviewed`,
    [card.dict, card.word, card.state, card.due, card.interval, card.ease, card.reps, card.lapses, card.firstSeen, card.lastReviewed],
  )
}

/** Deletes one card and returns the count. */
function deleteCard(db: Db, dict: string, word: string): number {
  return db.run('DELETE FROM card_progress WHERE dict = ? AND word = ?', [dict, word]).changes
}

/** Deletes every card of one dict and returns the count. */
export function deleteByDict(db: Db, dict: string): number {
  return db.run('DELETE FROM card_progress WHERE dict = ?', [dict]).changes
}

/** Moves every card whose target key is free to the new dict; returns the number moved. */
export function moveDict(db: Db, from: string, to: string): number {
  return db.transaction(() => {
    const words = db
      .all<{ word: string }>(
        `SELECT source.word FROM card_progress AS source
         WHERE source.dict = ?
           AND NOT EXISTS (SELECT 1 FROM card_progress AS target WHERE target.dict = ? AND target.word = source.word)`,
        [from, to],
      )
      .map((row) => row.word)
    for (const word of words) db.run('UPDATE card_progress SET dict = ? WHERE dict = ? AND word = ?', [to, from, word])
    return words.length
  })
}

export { deleteCard as delete }
