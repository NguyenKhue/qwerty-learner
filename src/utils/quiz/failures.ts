/** A sentence naming the words whose schedule update could not be saved (empty when none failed). */
export function describeSaveFailures(words: string[], max = 5): string {
  const unique = words.filter((word, index) => words.indexOf(word) === index)
  if (unique.length === 0) return ''
  const shown = unique.slice(0, max)
  const extra = unique.length - shown.length
  return `Could not save the schedule update for: ${shown.join(', ')}${extra > 0 ? ` and ${extra} more` : ''}.`
}
