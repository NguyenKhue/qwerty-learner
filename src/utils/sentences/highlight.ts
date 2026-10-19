/** "Word" characters, as used to decide whether a match stands alone. */
const WORD_CHAR = /[A-Za-z0-9]/
/** A headword at least this long that ends in e or y is also looked for without that letter (embody finds embodies). */
const MIN_STEMMABLE_LENGTH = 5

type Range = { start: number; end: number }

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** First match of `pattern` (a global, case-insensitive regex) that starts at a word boundary; lookbehind is avoided for older Safari. */
function firstAtWordStart(text: string, pattern: RegExp): Range | null {
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) {
      pattern.lastIndex++
      continue
    }
    if (!isWordChar(text[match.index - 1])) return { start: match.index, end: match.index + match[0].length }
  }
  return null
}

/** The whole headword as a standalone word. */
function wholeWordMatch(text: string, headword: string): Range | null {
  const re = new RegExp(escapeRegExp(headword), 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (!isWordChar(text[start - 1]) && !isWordChar(text[end])) return { start, end }
  }
  return null
}

/** The headword's tokens (split on spaces and hyphens, either one matches either), each allowed to carry a tail of letters or digits. */
function tokenMatch(text: string, tokens: string[]): Range | null {
  const pattern = tokens.map((token) => `${escapeRegExp(token)}[A-Za-z0-9]*`).join('[\\s-]+')
  return firstAtWordStart(text, new RegExp(pattern, 'gi'))
}

/** A one-token headword ending in e or y, without that letter, plus a tail. */
function stemMatch(text: string, tokens: string[]): Range | null {
  if (tokens.length !== 1) return null
  const token = tokens[0]
  if (token.length < MIN_STEMMABLE_LENGTH || !/[ey]$/i.test(token)) return null
  return firstAtWordStart(text, new RegExp(`${escapeRegExp(token.slice(0, -1))}[A-Za-z0-9]*`, 'gi'))
}

/** Locates the headword inside a sentence, from the strictest match to the loosest; `end` is exclusive. */
export function findTarget(text: string, headword: string): Range | null {
  const tokens = headword.split(/[\s-]+/).filter(Boolean)
  if (tokens.length === 0) return null
  return wholeWordMatch(text, headword) ?? tokenMatch(text, tokens) ?? stemMatch(text, tokens)
}
