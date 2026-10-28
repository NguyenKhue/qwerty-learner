import { dictationText } from './normalize'
import type { DictationSentence } from './types'

/** One line of an import: where it was placed in the video and how much of it matched the captions. */
export type AlignReportLine = { index: number; start: number; end: number; score: number }

/** What an import did, without any of the lyric text: how many lines there were, where they went and how well they matched. */
export type AlignReport = {
  lineCount: number
  previousSentenceCount: number
  matchedLineCount: number
  lines: AlignReportLine[]
  lowConfidence: number[]
  unmatchedCaptionWords: number
}

/** The largest token alignment to attempt; a file and a video this different cannot be meant for each other. */
const MAX_ALIGNMENT_CELLS = 4_000_000
/** The shortest line to place when the gap leaves room for it. */
const MIN_LINE_SECONDS = 0.3

type TimedToken = { text: string; start: number; end: number }

const round = (seconds: number): number => Math.round(seconds * 100) / 100

/** True for a line that is only a section marker such as `[Chorus]` or `(x2)`. */
function isSectionMarker(line: string): boolean {
  return /^\(.*\)$/.test(line) || /^\[.*\]$/.test(line)
}

/**
 * The lines of a lyrics file, ready to align: LRC time and metadata tags are stripped from the start of each line and the line is
 * trimmed. Empty lines, section markers and lines that cannot be typed are left out.
 */
export function parseLyricLines(text: string): string[] {
  const lines: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^(?:\s*\[[^\]]*\])+/, '').trim()
    if (line === '' || isSectionMarker(line) || dictationText(line) === null) continue
    lines.push(line)
  }
  return lines
}

/** Every word of every sentence, timed by its character offset inside the sentence it belongs to. */
function captionTokensOf(sentences: DictationSentence[]): TimedToken[] {
  const tokens: TimedToken[] = []
  for (const sentence of sentences) {
    const text = dictationText(sentence.en)
    if (text === null) continue
    const parts = text.split(' ')
    const span = sentence.end - sentence.start
    const starts: number[] = []
    let offset = 0
    for (const part of parts) {
      starts.push(sentence.start + (offset / text.length) * span)
      offset += part.length + 1
    }
    parts.forEach((part, i) => {
      tokens.push({ text: part, start: starts[i], end: i + 1 < parts.length ? starts[i + 1] : sentence.end })
    })
  }
  return tokens
}

/** Every word of every line, flattened, with the line each word belongs to and how many words each line has. */
function lineTokensOf(lines: string[]): { tokens: string[]; lineOf: number[]; counts: number[] } {
  const tokens: string[] = []
  const lineOf: number[] = []
  const counts: number[] = []
  lines.forEach((line, index) => {
    const text = dictationText(line)
    const parts = text === null ? [] : text.split(' ')
    counts.push(parts.length)
    for (const part of parts) {
      tokens.push(part)
      lineOf.push(index)
    }
  })
  return { tokens, lineOf, counts }
}

/**
 * Places lyric lines on a video's timeline by matching their words against the words of the current sentences. A line with matched
 * words takes their times; runs of unmatched lines share the gap between their neighbours. Throws when no line matches at all.
 */
export function alignLines(sentences: DictationSentence[], lines: string[]): { sentences: DictationSentence[]; report: AlignReport } {
  const captionTokens = captionTokensOf(sentences)
  const { tokens: lineTokens, lineOf, counts: lineTokenCounts } = lineTokensOf(lines)

  const captionCount = captionTokens.length
  const lineCount = lineTokens.length
  if (captionCount === 0 || lineCount === 0) throw new Error('No line of the lyrics matches this video')
  if (captionCount * lineCount > MAX_ALIGNMENT_CELLS) throw new Error('The lyrics file and the video are too different to align')

  // An LCS alignment: a cell that extends a match by one, or the better of the cell above and the one to the left.
  const width = lineCount + 1
  const direction = new Uint8Array((captionCount + 1) * width)
  let previous = new Uint32Array(width)
  let current = new Uint32Array(width)
  for (let i = 1; i <= captionCount; i++) {
    const token = captionTokens[i - 1].text
    for (let j = 1; j <= lineCount; j++) {
      const cell = i * width + j
      if (token === lineTokens[j - 1]) {
        current[j] = previous[j - 1] + 1
        direction[cell] = 1
      } else if (previous[j] >= current[j - 1]) {
        current[j] = previous[j]
        direction[cell] = 2
      } else {
        current[j] = current[j - 1]
        direction[cell] = 3
      }
    }
    const swap = previous
    previous = current
    current = swap
    current.fill(0)
  }

  const firstMatch = new Int32Array(lines.length).fill(-1)
  const lastMatch = new Int32Array(lines.length).fill(-1)
  const matchCounts = new Uint32Array(lines.length)
  let matchedCaptionWords = 0
  let i = captionCount
  let j = lineCount
  while (i > 0 && j > 0) {
    const directionHere = direction[i * width + j]
    if (directionHere === 1) {
      const line = lineOf[j - 1]
      if (firstMatch[line] === -1) lastMatch[line] = i - 1
      firstMatch[line] = i - 1
      matchCounts[line]++
      matchedCaptionWords++
      i--
      j--
    } else if (directionHere === 2) {
      i--
    } else if (directionHere === 3) {
      j--
    } else {
      break
    }
  }
  if (matchedCaptionWords === 0) throw new Error('No line of the lyrics matches this video')

  const rawStart = new Float64Array(lines.length)
  const rawEnd = new Float64Array(lines.length)
  for (let line = 0; line < lines.length; line++) {
    if (matchCounts[line] === 0) continue
    rawStart[line] = captionTokens[firstMatch[line]].start
    rawEnd[line] = captionTokens[lastMatch[line]].end
  }

  // Runs of lines with no matched word share the gap between the placed lines around them.
  let at = 0
  while (at < lines.length) {
    if (matchCounts[at] > 0) {
      at++
      continue
    }
    let runEnd = at
    while (runEnd < lines.length && matchCounts[runEnd] === 0) runEnd++
    const runLength = runEnd - at
    const gapStart = at > 0 ? rawEnd[at - 1] : sentences.length > 0 ? sentences[0].start : 0
    const fallbackEnd = sentences.length > 0 ? sentences[sentences.length - 1].end : gapStart
    const gapEnd = Math.max(gapStart, runEnd < lines.length ? rawStart[runEnd] : fallbackEnd)
    for (let k = 0; k < runLength; k++) {
      rawStart[at + k] = gapStart + ((gapEnd - gapStart) * k) / runLength
      rawEnd[at + k] = gapStart + ((gapEnd - gapStart) * (k + 1)) / runLength
    }
    at = runEnd
  }

  const placed: DictationSentence[] = []
  let previousEnd = Number.NEGATIVE_INFINITY
  lines.forEach((line, index) => {
    const start = round(Math.max(rawStart[index], previousEnd))
    const end = round(Math.max(rawEnd[index], start + MIN_LINE_SECONDS))
    placed.push({ start, end, en: line })
    previousEnd = end
  })

  const reportLines = lines.map((_, index) => {
    const words = lineTokenCounts[index]
    const score = words === 0 ? 0 : Math.round((matchCounts[index] / words) * 100) / 100
    return { index, start: placed[index].start, end: placed[index].end, score }
  })

  return {
    sentences: placed,
    report: {
      lineCount: lines.length,
      previousSentenceCount: sentences.length,
      matchedLineCount: lines.filter((_, index) => matchCounts[index] > 0).length,
      lines: reportLines,
      lowConfidence: reportLines.filter((line) => line.score < 0.5).map((line) => line.index),
      unmatchedCaptionWords: captionCount - matchedCaptionWords,
    },
  }
}
