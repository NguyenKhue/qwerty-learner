/** The longest text a dictation sentence may ask the learner to type. */
const MAX_LENGTH = 200

/** Typographic characters a keyboard has no key for, mapped to what the learner types (or to nothing). */
const KEYBOARD: Record<string, string> = {
  '’': "'",
  '‘': "'",
  '“': '',
  '”': '',
  '„': '',
  '—': ' ',
  '–': ' ',
  '…': ' ',
  ' ': ' ',
}

/**
 * What the learner types for a spoken sentence: lowercase letters, digits, single spaces, and the apostrophe inside a word
 * (a contraction). Punctuation cannot be heard, so it becomes a space. Null when nothing is left, when the text is longer than
 * 200 characters, or when it has a letter a standard English keyboard cannot type (such a sentence would be a dead end).
 */
export function dictationText(en: string): string | null {
  const mapped = Array.from(en, (ch) => (ch in KEYBOARD ? KEYBOARD[ch] : ch)).join('')
  if (Array.from(mapped).some((ch) => ch.charCodeAt(0) > 127)) return null
  const text = mapped
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/'(?![a-z0-9])|(?<![a-z0-9])'/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text === '' || text.length > MAX_LENGTH) return null
  return text
}
