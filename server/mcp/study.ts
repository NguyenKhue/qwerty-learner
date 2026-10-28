import { iso, limitArg, optionalString, schema, stringArg } from './args'
import type { Rpc } from './args'
import type { Library } from './library'
import { ToolInputError } from './protocol'
import type { McpTool } from './protocol'
import type { StoredChapterRecord, StoredReviewRecord, StoredWordRecord } from '@/data/contract'
import type { ICardProgress } from '@/utils/db/record'
import { existsSync, writeFileSync } from 'node:fs'

const DAY_MS = 24 * 60 * 60 * 1000
const GRADES = ['again', 'hard', 'good', 'easy']

/** The local calendar day of a time in ms, as YYYY-MM-DD. */
const localDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Reads a date argument (YYYY-MM-DD as local midnight, or any ISO time) as ms. */
function dateArg(args: Record<string, unknown>, name: string): number {
  const text = stringArg(args, name).trim()
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  const ms = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])).getTime() : Date.parse(text)
  if (!Number.isFinite(ms)) throw new ToolInputError(`"${name}" must be a date (YYYY-MM-DD) or an ISO time`)
  return ms
}

const card = (c: ICardProgress) => ({
  word: c.word,
  state: c.state,
  due: iso(c.due),
  intervalDays: Math.round(c.interval * 100) / 100,
  ease: c.ease,
  reps: c.reps,
  lapses: c.lapses,
  firstSeen: iso(c.firstSeen),
  lastReviewed: iso(c.lastReviewed),
})

const dict = { type: 'string', description: 'A dictionary id (cet4), a set id (custom:abc123) or its exact name' }

/**
 * The tools for studying: the flashcard schedule, typing history and mistakes, chapter results, activity, mistake reviews, and
 * a backup of all data. `now` and `fetchFn` are injected for tests.
 */
export function createStudyTools(
  rpc: Rpc,
  library: Library,
  opts: { baseUrl: string; now?: () => number; fetchFn?: typeof fetch },
): McpTool[] {
  const now = opts.now ?? Date.now
  const fetchFn = opts.fetchFn ?? fetch
  const cardsOf = async (id: string) => (await rpc('cards.byDict', [id])) as ICardProgress[]

  return [
    {
      name: 'flashcard_overview',
      description:
        'How the flashcards of a dictionary stand: words never studied (new), learning, review, due now and due by the end of ' +
        'today, and the next 10 cards to come due.',
      inputSchema: schema({ dict }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const cards = await cardsOf(target.id)
        const at = now()
        const endOfDay = new Date(at).setHours(24, 0, 0, 0)
        const studied = new Set(cards.map((c) => c.word))
        const words = library.words(target)
        return {
          dict: target.id,
          name: target.name,
          words: words.length,
          new: words.filter((w) => !studied.has(w.name)).length,
          learning: cards.filter((c) => c.state === 'learning').length,
          review: cards.filter((c) => c.state === 'review').length,
          dueNow: cards.filter((c) => c.due <= at).length,
          dueToday: cards.filter((c) => c.due < endOfDay).length,
          next: cards
            .filter((c) => c.due > at)
            .sort((a, b) => a.due - b.due)
            .slice(0, 10)
            .map((c) => ({ word: c.word, due: iso(c.due) })),
        }
      },
    },
    {
      name: 'get_flashcards',
      description: 'Lists the flashcard schedule of a dictionary: each studied word with its state, next due time, interval and history.',
      inputSchema: schema(
        {
          dict,
          filter: { type: 'string', enum: ['due', 'learning', 'review', 'all'] },
          limit: { type: 'integer', minimum: 1, maximum: 2000 },
        },
        ['dict'],
      ),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const at = now()
        const filter = optionalString(args, 'filter') ?? 'all'
        const cards = (await cardsOf(target.id))
          .filter((c) => filter === 'all' || (filter === 'due' ? c.due <= at : c.state === filter))
          .sort((a, b) => a.due - b.due)
        return { dict: target.id, total: cards.length, cards: cards.slice(0, limitArg(args, 'limit', 200, 2000)).map(card) }
      },
    },
    {
      name: 'grade_flashcard',
      description:
        'Records a flashcard answer for a word, as the Study screen does: again, hard, good or easy. The next due time follows ' +
        'from it; the answer also counts in the activity and streak.',
      inputSchema: schema({ dict, word: { type: 'string' }, grade: { type: 'string', enum: GRADES } }, ['dict', 'word', 'grade']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const word = stringArg(args, 'word')
        const grade = stringArg(args, 'grade')
        if (GRADES.indexOf(grade) === -1) throw new ToolInputError(`"grade" must be one of ${GRADES.join(', ')}`)
        if (!library.words(target).some((w) => w.name === word)) throw new ToolInputError(`"${word}" is not in ${target.id}`)
        return { dict: target.id, card: card((await rpc('cards.review', [target.id, word, grade])) as ICardProgress) }
      },
    },
    {
      name: 'typing_stats',
      description: 'Totals of the typing practice: chapters finished, words typed, mistakes, and when the first word was typed.',
      inputSchema: schema({}, []),
      async run() {
        const s = (await rpc('stats.summary', [])) as {
          chapterCount: number
          wordCount: number
          firstWordTimestamp: number | null
          sumWrongCount: number
        }
        return {
          chapters: s.chapterCount,
          wordsTyped: s.wordCount,
          mistakes: s.sumWrongCount,
          firstTyped: s.firstWordTimestamp === null ? null : iso(s.firstWordTimestamp * 1000),
        }
      },
    },
    {
      name: 'mistake_words',
      description: 'The words typed wrong most often (in one dictionary, or all): total mistakes, times typed wrong and when last.',
      inputSchema: schema({ dict, limit: { type: 'integer', minimum: 1, maximum: 500 } }, []),
      async run(args) {
        const target = args.dict === undefined ? null : await library.resolve(stringArg(args, 'dict'))
        const records = (await rpc(target ? 'words.wrongByDict' : 'words.wrong', target ? [target.id] : [])) as StoredWordRecord[]
        const groups = new Map<string, { word: string; dict: string; mistakes: number; times: number; last: number }>()
        for (const r of records) {
          const key = `${r.dict}\u0000${r.word}`
          const group = groups.get(key) ?? { word: r.word, dict: r.dict, mistakes: 0, times: 0, last: 0 }
          group.mistakes += r.wrongCount
          group.times++
          group.last = Math.max(group.last, r.timeStamp)
          groups.set(key, group)
        }
        const sorted = Array.from(groups.values()).sort((a, b) => b.mistakes - a.mistakes || b.last - a.last)
        return {
          total: sorted.length,
          words: sorted.slice(0, limitArg(args, 'limit', 50, 500)).map((g) => ({ ...g, last: iso(g.last * 1000) })),
        }
      },
    },
    {
      name: 'typing_history',
      description:
        'Typing practice per day between two dates (YYYY-MM-DD, local days; to defaults to today): words typed, mistakes, ' +
        'distinct words. With detail, also the records themselves (at most 500).',
      inputSchema: schema({ from: { type: 'string' }, to: { type: 'string' }, detail: { type: 'boolean' } }, ['from']),
      async run(args) {
        const from = dateArg(args, 'from')
        const to = args.to === undefined ? now() : dateArg(args, 'to') + DAY_MS - 1
        if (to < from) throw new ToolInputError('"to" is before "from"')
        const records = (await rpc('words.between', [Math.floor(from / 1000), Math.floor(to / 1000)])) as StoredWordRecord[]
        const days = new Map<string, { day: string; words: number; mistakes: number; distinct: Set<string> }>()
        for (const r of records) {
          const day = localDay(r.timeStamp * 1000)
          const entry = days.get(day) ?? { day, words: 0, mistakes: 0, distinct: new Set<string>() }
          entry.words++
          entry.mistakes += r.wrongCount
          entry.distinct.add(`${r.dict}\u0000${r.word}`)
          days.set(day, entry)
        }
        return {
          days: Array.from(days.values())
            .sort((a, b) => a.day.localeCompare(b.day))
            .map((d) => ({ day: d.day, words: d.words, mistakes: d.mistakes, distinctWords: d.distinct.size })),
          ...(args.detail === true
            ? {
                records: records.slice(0, 500).map((r) => ({
                  word: r.word,
                  dict: r.dict,
                  chapter: r.chapter === null ? null : r.chapter + 1,
                  at: iso(r.timeStamp * 1000),
                  mistakes: r.wrongCount,
                })),
              }
            : {}),
        }
      },
    },
    {
      name: 'chapter_results',
      description: 'The results of finished typing chapters of a dictionary (or one chapter, 1-based): time, accuracy, speed.',
      inputSchema: schema({ dict, chapter: { type: 'integer', minimum: 1 } }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const chapter = args.chapter === undefined ? undefined : limitArg(args, 'chapter', 1, 100000)
        const records = (await rpc(
          chapter === undefined ? 'chapters.byDict' : 'chapters.byDictChapter',
          chapter === undefined ? [target.id] : [target.id, chapter - 1],
        )) as StoredChapterRecord[]
        return {
          dict: target.id,
          results: records.map((r) => ({
            chapter: r.chapter === null ? null : r.chapter + 1,
            at: iso(r.timeStamp * 1000),
            seconds: r.time,
            words: r.wordCount,
            mistakes: r.wrongCount,
            accuracy:
              r.correctCount + r.wrongCount === 0 ? null : Math.round((r.correctCount / (r.correctCount + r.wrongCount)) * 1000) / 10,
            wordsPerMinute: r.time > 0 ? Math.round((r.wordCount / (r.time / 60)) * 10) / 10 : null,
          })),
        }
      },
    },
    {
      name: 'activity',
      description: 'Activity per local day over the last days (default 30): flashcard answers and minutes spent typing (about).',
      inputSchema: schema({ days: { type: 'integer', minimum: 1, maximum: 366 } }, []),
      async run(args) {
        const days = limitArg(args, 'days', 30, 366)
        const start = new Date(now() - (days - 1) * DAY_MS).setHours(0, 0, 0, 0)
        const { reviewTimes, typedSeconds } = (await rpc('activity.times', [start])) as { reviewTimes: number[]; typedSeconds: number[] }
        const byDay = new Map<string, { day: string; reviews: number; typedSeconds: Set<number> }>()
        const entry = (day: string) => {
          const found = byDay.get(day) ?? { day, reviews: 0, typedSeconds: new Set<number>() }
          byDay.set(day, found)
          return found
        }
        for (const at of reviewTimes) entry(localDay(at)).reviews++
        // A typed word marks its minute as spent typing
        for (const s of typedSeconds) entry(localDay(s * 1000)).typedSeconds.add(Math.floor(s / 60))
        return Array.from(byDay.values())
          .sort((a, b) => a.day.localeCompare(b.day))
          .map((d) => ({ day: d.day, flashcardAnswers: d.reviews, typingMinutes: d.typedSeconds.size }))
      },
    },
    {
      name: 'hard_words',
      description: 'The words of a dictionary answered "again" or "hard" on flashcards since a date (default 7 days ago).',
      inputSchema: schema({ dict, since: { type: 'string' } }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const since = args.since === undefined ? now() - 7 * DAY_MS : dateArg(args, 'since')
        return { dict: target.id, since: iso(since), words: await rpc('log.hardWordsSince', [target.id, since]) }
      },
    },
    {
      name: 'forget_word_history',
      description: 'Deletes the typing records of one word in one dictionary (its mistakes no longer count). Flashcards are kept.',
      inputSchema: schema({ dict, word: { type: 'string' } }, ['dict', 'word']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const word = stringArg(args, 'word')
        return { dict: target.id, word, deletedRecords: await rpc('words.deleteByWord', [word, target.id]) }
      },
    },
    {
      name: 'mistake_review_progress',
      description: 'The unfinished mistake-review session of a dictionary, if any: how far it got and how many words it has.',
      inputSchema: schema({ dict }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const review = (await rpc('reviews.latestUnfinished', [target.id])) as StoredReviewRecord | null
        if (!review) return { dict: target.id, unfinished: null }
        return {
          dict: target.id,
          unfinished: { position: review.index, words: review.words.length, created: iso(review.createTime * 1000) },
        }
      },
    },
    {
      name: 'backup_data',
      description:
        "Saves all the learner's data (sets, flashcards, history, videos) to a .json.gz file, the same file Settings → Data " +
        'exports and imports. Take one before bulk edits or deletes.',
      inputSchema: schema({ path: { type: 'string', description: 'Absolute path of a new file, ending in .json.gz' } }, ['path']),
      async run(args) {
        const path = stringArg(args, 'path')
        if (existsSync(path)) throw new ToolInputError(`${path} already exists`)
        let response: Response
        try {
          response = await fetchFn(`${opts.baseUrl.replace(/\/+$/, '')}/api/export/json`)
        } catch {
          throw new Error(`The data server at ${opts.baseUrl} is not reachable`)
        }
        if (!response.ok) throw new Error(`The export failed: the data server answered ${response.status}`)
        const bytes = Buffer.from(await response.arrayBuffer())
        writeFileSync(path, bytes, { flag: 'wx' })
        return { path, bytes: bytes.length }
      },
    },
  ]
}
