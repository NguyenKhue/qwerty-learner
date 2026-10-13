import { splitMeanings } from './parse'

type Row = { name: string; trans: string; usphone: string; ukphone: string; detail?: string }

/**
 * One problem (or null) per editor row, shown on the card while typing instead of after Save. Blank rows have none; a missing word or
 * meaning comes before the duplicate warning, and a duplicate points to the first row that has the same word (ignoring case and spaces).
 */
export function rowIssues(rows: Row[]): (string | null)[] {
  const firstSeen: Record<string, number> = {}
  return rows.map((row, index) => {
    const name = row.name.trim()
    const meanings = splitMeanings(row.trans)
    const other = row.usphone.trim() + row.ukphone.trim() + (row.detail ?? '').trim()
    if (!name && meanings.length === 0 && !other) return null
    if (!name) return 'Add the word'
    if (meanings.length === 0) return 'Add at least one meaning'
    const key = name.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(firstSeen, key)) return `Same word as row ${firstSeen[key] + 1}: the meanings will be merged`
    firstSeen[key] = index
    return null
  })
}
