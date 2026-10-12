import type { Word } from '@/typings'
import { distinctMeaningCount, meaningText, quizWords, shuffle } from '@/utils/quiz/questions'

export const PAIR_COUNT = 6

export type TileKind = 'word' | 'meaning'
export type Tile = { id: string; pairId: string; kind: TileKind; text: string }

/** A set can be played when it has at least 6 distinct meanings (so no two pairs on a board share a meaning). */
export function canPlay(words: Word[]): boolean {
  return distinctMeaningCount(words) >= PAIR_COUNT
}

/** 6 random word/meaning pairs as 12 shuffled tiles. Empty when the set cannot be played. */
export function buildBoard(input: { words: Word[]; rng?: () => number }): Tile[] {
  const rng = input.rng ?? Math.random
  const seenMeanings = new Set<string>()
  const chosen: Word[] = []
  const pool = shuffle(quizWords(input.words), rng)
  for (let i = 0; i < pool.length && chosen.length < PAIR_COUNT; i++) {
    const meaning = meaningText(pool[i])
    // Two chosen words with the same meaning would make a correct pairing look wrong
    if (seenMeanings.has(meaning)) continue
    seenMeanings.add(meaning)
    chosen.push(pool[i])
  }
  if (chosen.length < PAIR_COUNT) return []

  const tiles = chosen.reduce<Tile[]>((all, word, index) => {
    const pairId = `p${index}`
    return all.concat(
      { id: `${pairId}-word`, pairId, kind: 'word', text: word.name },
      { id: `${pairId}-meaning`, pairId, kind: 'meaning', text: meaningText(word) },
    )
  }, [])
  return shuffle(tiles, rng)
}
