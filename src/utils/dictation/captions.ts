/** One spoken word and when it starts, in milliseconds from the start of the video. */
export type TimedWord = { startMs: number; text: string }

type Seg = { utf8?: unknown; tOffsetMs?: unknown }
type Json3Event = { tStartMs?: unknown; dDurationMs?: unknown; segs?: unknown }

/** How many recent words a new subtitle line is compared with, to find text it repeats. */
const RECENT_WORDS = 30

const num = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const wordsOf = (text: unknown): string[] => (typeof text === 'string' ? text.split(/\s+/).filter(Boolean) : [])

/** Removes sound tags (`[Music]`, `(Laughter)`, spanning several words or not), music notes and speaker marks. */
function dropTags(tokens: TimedWord[]): TimedWord[] {
  const kept: TimedWord[] = []
  let closing: string | null = null
  for (const token of tokens) {
    if (closing !== null) {
      if (token.text.endsWith(closing)) closing = null
      continue
    }
    const open = token.text[0]
    if (open === '[' || open === '(') {
      const close = open === '[' ? ']' : ')'
      if (!token.text.endsWith(close)) closing = close
      continue
    }
    if (/^(♪+|>>|-+)$/.test(token.text)) continue
    kept.push(token)
  }
  return kept
}

/** The number of leading words of `current` that repeat the last words of `recent` (at least 2, or the whole line). */
function repeated(recent: string[], current: string[]): number {
  const lower = current.map((w) => w.toLowerCase())
  for (let k = Math.min(recent.length, lower.length); k >= 1; k--) {
    if (k < 2 && k !== lower.length) break
    const tail = recent.slice(recent.length - k)
    if (tail.every((w, i) => w === lower[i])) return k
  }
  return 0
}

/** Appends the words of one subtitle line, dropping what it repeats from the lines before it while they overlap in time. */
function createCollector() {
  const words: TimedWord[] = []
  let lastEndMs = -Infinity
  return {
    words,
    add(raw: TimedWord[], baseMs: number, endMs: number) {
      let tokens = dropTags(raw)
      if (tokens.length === 0) return
      if (baseMs < lastEndMs) {
        const recent = words.slice(-RECENT_WORDS).map((w) => w.text.toLowerCase())
        tokens = tokens.slice(
          repeated(
            recent,
            tokens.map((t) => t.text),
          ),
        )
      }
      if (tokens.length === 0) return
      for (const token of tokens) {
        const previous = words.length > 0 ? words[words.length - 1].startMs : 0
        words.push({ startMs: Math.max(previous, token.startMs), text: token.text })
      }
      lastEndMs = Math.max(lastEndMs, endMs)
    },
  }
}

/** The words of a line spread evenly over its duration (for subtitles without word timing). */
function spread(texts: string[], baseMs: number, durationMs: number): TimedWord[] {
  return texts.map((text, i) => ({ startMs: baseMs + Math.floor((i * durationMs) / texts.length), text }))
}

/**
 * Reads YouTube's json3 subtitles as a list of words. Words are timed by their own offsets when the track has them (auto
 * subtitles), otherwise spread evenly over their line. Sound tags are dropped, and so is text a line repeats from the line before it
 * while the two overlap in time (auto subtitles roll). Start times never go backwards.
 */
export function parseJson3(json: string): TimedWord[] {
  const data = JSON.parse(json) as { events?: unknown }
  if (!data || typeof data !== 'object' || !Array.isArray(data.events)) throw new Error('Not a json3 subtitle file')

  const collector = createCollector()
  for (const event of data.events as Json3Event[]) {
    if (!event || !Array.isArray(event.segs)) continue
    const segs = event.segs as Seg[]
    const base = num(event.tStartMs)
    const duration = num(event.dDurationMs)
    const tokens: TimedWord[] = []
    if (segs.some((seg) => typeof seg.tOffsetMs === 'number')) {
      for (const seg of segs) for (const text of wordsOf(seg.utf8)) tokens.push({ startMs: base + num(seg.tOffsetMs), text })
    } else {
      tokens.push(
        ...spread(
          segs.flatMap((seg) => wordsOf(seg.utf8)),
          base,
          duration,
        ),
      )
    }
    collector.add(tokens, base, base + duration)
  }
  return collector.words
}

const TIMING = /^((?:\d+:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d+:)?\d{2}:\d{2}\.\d{3})/
const INLINE_TIME = /<((?:\d+:)?\d{2}:\d{2}\.\d{3})>/
/** A cue this short only shows a finished line again (auto subtitles): it adds no words. */
const FLASH_MS = 50

function toMs(stamp: string): number {
  const parts = stamp.split(':').map(Number)
  return Math.round(parts.reduce((total, part) => total * 60 + part, 0) * 1000)
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

const stripTags = (text: string) => decodeEntities(text.replace(/<[^>]*>/g, ''))

/**
 * Reads WebVTT subtitles as a list of words. YouTube's auto subtitles roll: each cue repeats the previous line and adds a new one
 * whose words carry their own times (`word<00:00:01.230><c> next</c>`), so only that new line is read. Subtitles written by people
 * have whole lines, whose words are spread over the cue.
 */
export function parseVtt(text: string): TimedWord[] {
  const normalized = text.replace(/\r\n?/g, '\n')
  if (!normalized.trimStart().startsWith('WEBVTT')) throw new Error('Not a WebVTT subtitle file')
  const rolling = INLINE_TIME.test(normalized)
  const collector = createCollector()

  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n')
    const timingIndex = lines.findIndex((line) => TIMING.test(line))
    if (timingIndex === -1) continue
    const [, from, to] = TIMING.exec(lines[timingIndex]) as RegExpExecArray
    const startMs = toMs(from)
    const endMs = toMs(to)
    const textLines = lines.slice(timingIndex + 1).filter((line) => line.trim() !== '')
    if (textLines.length === 0) continue

    if (!rolling) {
      collector.add(spread(wordsOf(stripTags(textLines.join(' '))), startMs, endMs - startMs), startMs, endMs)
      continue
    }
    if (endMs - startMs <= FLASH_MS) continue
    const line = textLines[textLines.length - 1]
    const tokens: TimedWord[] = []
    let at = startMs
    for (const part of line.split(INLINE_TIME)) {
      if (/^(?:\d+:)?\d{2}:\d{2}\.\d{3}$/.test(part)) {
        at = toMs(part)
        continue
      }
      for (const word of wordsOf(stripTags(part))) tokens.push({ startMs: at, text: word })
    }
    collector.add(tokens, startMs, endMs)
  }
  return collector.words
}

/** Reads subtitles in either format yt-dlp delivers. */
export function parseSubtitles(text: string, format: 'json3' | 'vtt'): TimedWord[] {
  return format === 'vtt' ? parseVtt(text) : parseJson3(text)
}

/** One subtitle line and when it is shown, in milliseconds. */
export type Cue = { startMs: number; endMs: number; text: string }

/** Reads subtitles as whole lines (for a translation track, whose words do not line up with the English words). */
export function parseCues(text: string, format: 'json3' | 'vtt'): Cue[] {
  const cues: Cue[] = []
  const push = (startMs: number, endMs: number, raw: string) => {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (line !== '' && endMs > startMs) cues.push({ startMs, endMs, text: line })
  }
  if (format === 'json3') {
    const data = JSON.parse(text) as { events?: unknown }
    if (!data || !Array.isArray(data.events)) throw new Error('Not a json3 subtitle file')
    for (const event of data.events as Json3Event[]) {
      if (!event || !Array.isArray(event.segs)) continue
      const base = num(event.tStartMs)
      push(base, base + num(event.dDurationMs), (event.segs as Seg[]).map((seg) => (typeof seg.utf8 === 'string' ? seg.utf8 : '')).join(''))
    }
    return cues
  }
  const normalized = text.replace(/\r\n?/g, '\n')
  if (!normalized.trimStart().startsWith('WEBVTT')) throw new Error('Not a WebVTT subtitle file')
  const rolling = INLINE_TIME.test(normalized)
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n')
    const timingIndex = lines.findIndex((line) => TIMING.test(line))
    if (timingIndex === -1) continue
    const [, from, to] = TIMING.exec(lines[timingIndex]) as RegExpExecArray
    const startMs = toMs(from)
    const endMs = toMs(to)
    const textLines = lines.slice(timingIndex + 1).filter((line) => line.trim() !== '')
    if (textLines.length === 0 || (rolling && endMs - startMs <= FLASH_MS)) continue
    push(startMs, endMs, stripTags(rolling ? textLines[textLines.length - 1] : textLines.join(' ')))
  }
  return cues
}
