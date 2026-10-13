export type DetailLine = { label?: string; text: string }

// A label is the short part before the first colon, only when the colon is followed by a space or ends the line
const LABEL_PATTERN = /^([^:]{1,60}):(\s|$)/

/**
 * Splits a detail text into lines, dropping the blank ones.
 * A line whose first colon follows a short label and is followed by a space (or ends the line) becomes
 * `{ label, text }`; every other line is `{ text }` without a `label` key at all.
 */
export function parseDetail(text: string): DetailLine[] {
  const lines: DetailLine[] = []
  const rawLines = text.split(/\r?\n/)

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim()
    if (line === '') continue

    const matched = LABEL_PATTERN.exec(line)
    if (matched) {
      lines.push({ label: matched[1].trim(), text: line.slice(matched[0].length).trim() })
    } else {
      lines.push({ text: line })
    }
  }

  return lines
}
