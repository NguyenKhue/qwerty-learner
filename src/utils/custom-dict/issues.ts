import { splitMeanings } from './parse'

type Row = { name: string; trans: string; usphone: string; ukphone: string; detail?: string; examples?: string }

// The separator is whitespace + `|` + whitespace, so a sentence may contain code operators or a literal `|`
const EXAMPLE_SEPARATOR = /\s\|\s/

/**
 * One problem (or null) per editor row, shown on the card while typing instead of after Save. Blank rows have none; a missing word or
 * meaning comes before the duplicate warning, and a duplicate points to the first row that has the same word (ignoring case and spaces).
 * An example line with a translation but no sentence is reported so the input is not lost silently.
 */
export function rowIssues(rows: Row[]): (string | null)[] {
  const firstSeen: Record<string, number> = {}
  return rows.map((row, index) => {
    const name = row.name.trim()
    const meanings = splitMeanings(row.trans)
    const examples = (row.examples ?? '').split(/\r?\n/)
    const other = row.usphone.trim() + row.ukphone.trim() + (row.detail ?? '').trim() + (row.examples ?? '').trim()
    if (!name && meanings.length === 0 && !other) return null
    if (!name) return 'Add the word'
    if (meanings.length === 0) return 'Add at least one meaning'
    for (let line = 0; line < examples.length; line++) {
      const separator = EXAMPLE_SEPARATOR.exec(examples[line])
      if (separator && examples[line].slice(0, separator.index).trim() === '') {
        return `Example line ${line + 1} has no sentence before "|"`
      }
    }
    const key = name.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(firstSeen, key)) return `Same word as row ${firstSeen[key] + 1}: the meanings will be merged`
    firstSeen[key] = index
    return null
  })
}
