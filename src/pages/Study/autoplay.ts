/**
 * When a flashcard plays its word on its own: a key that changes exactly when it should play, or null for silence. The word plays
 * once when the card appears, or, when the meaning is shown first, once the card is flipped (earlier would give the word away).
 */
export function autoPlayKey(input: { word: string | undefined; reverse: boolean; revealed: boolean; enabled: boolean }): string | null {
  const { word, reverse, revealed, enabled } = input
  if (!enabled || word === undefined) return null
  if (reverse && !revealed) return null
  return word
}
