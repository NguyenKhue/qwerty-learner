/** "Word" characters, as used to decide whether a match stands alone. */
const WORD_CHAR = /[A-Za-z0-9]/

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** First whole-word, case-insensitive occurrence of `headword`, with word boundaries checked without lookbehind. */
function wholeWordMatch(text: string, headword: string): { start: number; end: number } | null {
  const re = new RegExp(escapeRegExp(headword), 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (!isWordChar(text[start - 1]) && !isWordChar(text[end])) return { start, end }
  }
  return null
}

/** First word of `text` that starts with `headword`, the range covering that whole word. */
function prefixMatch(text: string, headword: string): { start: number; end: number } | null {
  const needle = headword.toLowerCase()
  let i = 0
  while (i < text.length) {
    if (!isWordChar(text[i])) {
      i++
      continue
    }
    let end = i
    while (end < text.length && isWordChar(text[end])) end++
    if (text.slice(i, end).toLowerCase().startsWith(needle)) return { start: i, end }
    i = end
  }
  return null
}

/** Locates the headword inside a sentence: a whole word first, then a word it is the start of; `end` is exclusive. */
export function findTarget(text: string, headword: string): { start: number; end: number } | null {
  if (!headword) return null
  return wholeWordMatch(text, headword) ?? prefixMatch(text, headword)
}
