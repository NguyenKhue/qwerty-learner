import type { WordExample } from '@/typings'

// Only `Câu mẫu:` lines are real sentences; `Ví dụ:` lines in the existing data are Vietnamese explanations
const LABEL = /^câu mẫu\s*:\s*/i

/** Splits a `sentence (translation)` body, scanning the trailing parentheses from the end. */
function splitTranslation(body: string): WordExample {
  // The label line may end with a period after the closing parenthesis
  const line = body.endsWith('.') ? body.slice(0, -1).trimEnd() : body
  if (!line.endsWith(')')) return { text: body }

  let depth = 0
  let open = -1
  for (let i = line.length - 1; i >= 0; i--) {
    const char = line[i]
    if (char === ')') depth++
    else if (char === '(') {
      depth--
      if (depth === 0) {
        open = i
        break
      }
    }
  }
  if (open <= 0) return { text: body }

  const text = line.slice(0, open).trim()
  const trans = line.slice(open + 1, line.length - 1).trim()
  if (text === '' || trans === '') return { text: body }
  return { text, trans }
}

/** Extracts the `Câu mẫu:` lines of a detail text as examples. */
export function extractExamplesFromDetail(detail: string): WordExample[] {
  const result: WordExample[] = []
  const lines = detail.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const match = LABEL.exec(line)
    if (!match) continue
    const body = line.slice(match[0].length).trim()
    if (body === '') continue
    result.push(splitTranslation(body))
  }
  return result
}
