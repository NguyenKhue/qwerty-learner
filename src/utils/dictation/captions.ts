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

/**
 * Reads YouTube's json3 subtitles as a list of words. Words are timed by their own offsets when the track has them (auto
 * subtitles), otherwise spread evenly over their line. Sound tags are dropped, and so is text a line repeats from the line before it
 * while the two overlap in time (auto subtitles roll). Start times never go backwards.
 */
export function parseJson3(json: string): TimedWord[] {
  const data = JSON.parse(json) as { events?: unknown }
  if (!data || typeof data !== 'object' || !Array.isArray(data.events)) throw new Error('Not a json3 subtitle file')

  const words: TimedWord[] = []
  let lastEndMs = -Infinity
  for (const event of data.events as Json3Event[]) {
    if (!event || !Array.isArray(event.segs)) continue
    const segs = event.segs as Seg[]
    const base = num(event.tStartMs)
    const duration = num(event.dDurationMs)

    let tokens: TimedWord[] = []
    if (segs.some((seg) => typeof seg.tOffsetMs === 'number')) {
      for (const seg of segs) for (const text of wordsOf(seg.utf8)) tokens.push({ startMs: base + num(seg.tOffsetMs), text })
    } else {
      const all = segs.flatMap((seg) => wordsOf(seg.utf8))
      tokens = all.map((text, i) => ({ startMs: base + Math.floor((i * duration) / all.length), text }))
    }
    tokens = dropTags(tokens)
    if (tokens.length === 0) continue

    if (base < lastEndMs) {
      const recent = words.slice(-RECENT_WORDS).map((w) => w.text.toLowerCase())
      tokens = tokens.slice(
        repeated(
          recent,
          tokens.map((t) => t.text),
        ),
      )
    }
    if (tokens.length === 0) continue

    for (const token of tokens) {
      const previous = words.length > 0 ? words[words.length - 1].startMs : 0
      words.push({ startMs: Math.max(previous, token.startMs), text: token.text })
    }
    lastEndMs = Math.max(lastEndMs, base + duration)
  }
  return words
}
