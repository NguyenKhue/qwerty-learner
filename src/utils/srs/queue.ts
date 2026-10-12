import { startOfLocalDay } from './time'
import type { Word } from '@/typings'
import type { ICardProgress } from '@/utils/db/record'

export const DEFAULT_NEW_PER_DAY = 20
export const MAX_NEW_PER_DAY = 500

export type QueueItem = { word: Word; kind: 'due' | 'new' }

/** Turns whatever is stored for "new cards per day" into an integer between 0 and 500 (default 20). */
export function sanitizeNewPerDay(value: unknown): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return DEFAULT_NEW_PER_DAY
  const n = Number(value)
  if (!Number.isFinite(n)) return DEFAULT_NEW_PER_DAY
  return Math.min(MAX_NEW_PER_DAY, Math.max(0, Math.floor(n)))
}

function uniqueWords(words: Word[]): Word[] {
  const seen = new Set<string>()
  const result: Word[] = []
  words.forEach((word) => {
    if (seen.has(word.name)) return
    seen.add(word.name)
    result.push(word)
  })
  return result
}

/** Progress rows of the words that are in the set (rows of removed words are ignored). */
function progressOfWords(words: Word[], progress: ICardProgress[]): Map<string, ICardProgress> {
  const inSet = new Set(words.map((word) => word.name))
  const byWord = new Map<string, ICardProgress>()
  progress.forEach((card) => {
    if (inSet.has(card.word)) byWord.set(card.word, card)
  })
  return byWord
}

/** Today's queue: due cards (oldest first), then new cards in set order, limited to `newPerDay` minus those first seen today. */
export function buildQueue(input: { words: Word[]; progress: ICardProgress[]; now: number; newPerDay: number }): QueueItem[] {
  const words = uniqueWords(input.words)
  const byWord = progressOfWords(words, input.progress)
  const dayStart = startOfLocalDay(input.now)

  let introducedToday = 0
  byWord.forEach((card) => {
    if (card.firstSeen >= dayStart) introducedToday++
  })

  const due: { word: Word; due: number }[] = []
  const fresh: Word[] = []
  words.forEach((word) => {
    const card = byWord.get(word.name)
    if (!card) fresh.push(word)
    else if (card.due <= input.now) due.push({ word, due: card.due })
  })
  due.sort((a, b) => a.due - b.due)

  const newLimit = Math.max(0, sanitizeNewPerDay(input.newPerDay) - introducedToday)
  return due
    .map((item): QueueItem => ({ word: item.word, kind: 'due' }))
    .concat(fresh.slice(0, newLimit).map((word): QueueItem => ({ word, kind: 'new' })))
}

export function queueCounts(queue: QueueItem[]): { due: number; new: number } {
  const due = queue.filter((item) => item.kind === 'due').length
  return { due, new: queue.length - due }
}

/** The earliest moment after `now` at which a card of the set becomes due, or null if nothing is scheduled. */
export function nextDueTime(words: Word[], progress: ICardProgress[], now: number): number | null {
  const byWord = progressOfWords(uniqueWords(words), progress)
  return Array.from(byWord.values()).reduce<number | null>((next, card) => {
    if (card.due <= now) return next
    return next === null || card.due < next ? card.due : next
  }, null)
}
