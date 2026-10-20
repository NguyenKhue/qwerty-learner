/** Replaces a misspelling in a text, case-insensitively and as a whole word, keeping a leading capital. */
export function respell(text: string, from: string, to: string): string {
  const pattern = new RegExp(`\\b${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
  return text.replace(pattern, (match) => (match[0] === match[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to))
}
