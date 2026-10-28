import { indexArg, schema, stringArg } from './args'
import type { Rpc } from './args'
import { ToolInputError } from './protocol'
import type { McpTool } from './protocol'
import { PROCEDURE_NAMES } from '@/data/contract'
import { parseLyricLines } from '@/utils/dictation/lyrics'

export type { Rpc } from './args'

/** The largest lyrics file the import reads. */
const MAX_LYRICS_BYTES = 256 * 1024

/** An `Rpc` over the data server's HTTP API (`POST <baseUrl>/api/rpc/<name>` with `{ args }`). */
export function httpRpc(baseUrl: string, fetchFn: typeof fetch = fetch): Rpc {
  const root = baseUrl.replace(/\/+$/, '')
  return async (name, args) => {
    let response: Response
    try {
      response = await fetchFn(`${root}/api/rpc/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ args }),
      })
    } catch {
      throw new Error(`The data server at ${root} is not reachable. Start it (yarn dev:full, or the stable server) or set QWERTY_URL.`)
    }
    const body = (await response.json().catch(() => null)) as { result?: unknown; error?: { code?: string; message?: string } } | null
    if (!response.ok || !body || !('result' in body)) {
      const error = body?.error
      throw new Error(error?.message ? `${error.code ?? 'ERROR'}: ${error.message}` : `The data server answered ${response.status}`)
    }
    return body.result
  }
}

const videoId = { type: 'string', description: 'The YouTube video id (11 characters), as list_videos shows it' }
const index = { type: 'integer', minimum: 0, description: 'The 0-based sentence index, as get_video shows it' }

type Sentence = { start: number; end: number; en: string; vi?: string; viSource?: string }

/** A sentence without its text: what an agent needs to edit by index without reading a song's lyrics. */
const bare = (s: Sentence, index: number) => ({
  index,
  start: s.start,
  end: s.end,
  words: s.en.split(/\s+/).filter(Boolean).length,
  hasVi: s.vi !== undefined,
})

/**
 * The tools an agent gets: dictation videos (read, prepare, fix sentences, import a lyrics file) and one generic tool for every
 * other procedure. `readFile` reads the lyrics file inside this process, so its text goes to the data server and never back
 * to the agent.
 */
export function createTools(rpc: Rpc, readFile: (path: string) => Promise<Buffer>): McpTool[] {
  return [
    {
      name: 'list_videos',
      description: 'Lists the prepared dictation videos (id, title, channel, sentence count, progress), most recent first.',
      inputSchema: schema({}, []),
      run: () => rpc('dictation.videos', []),
    },
    {
      name: 'get_video',
      description:
        'Reads one prepared video with all its sentences: index, start and end (seconds), English text (en) and Vietnamese (vi). ' +
        'With text false, only index, times and word counts are returned (for a song, whose lines are lyrics).',
      inputSchema: schema({ videoId, text: { type: 'boolean', description: 'Include en and vi (default true)' } }, ['videoId']),
      async run(args) {
        const video = (await rpc('dictation.get', [stringArg(args, 'videoId')])) as { sentences?: unknown[] } | null
        if (!video) throw new ToolInputError('That video is not prepared. Use prepare_video first.')
        const sentences = (video.sentences ?? []) as Sentence[]
        return { ...video, sentences: sentences.map((s, i) => (args.text === false ? bare(s, i) : { index: i, ...s })) }
      },
    },
    {
      name: 'prepare_video',
      description:
        'Starts preparing a video from its YouTube subtitles in the background; poll video_status until "ready". With refetch, a ' +
        'prepared video is fetched again, which replaces every edit of its sentences (the learner keeps their progress).',
      inputSchema: schema({ videoId, refetch: { type: 'boolean', description: 'Fetch a prepared video again' } }, ['videoId']),
      run: (args) =>
        args.refetch === true
          ? rpc('dictation.refetch', [stringArg(args, 'videoId')])
          : rpc('dictation.prepare', [stringArg(args, 'videoId')]),
    },
    {
      name: 'video_status',
      description: 'Where the preparation or retranslation of a video stands: idle, running (with its step), ready or error.',
      inputSchema: schema({ videoId }, ['videoId']),
      run: (args) => rpc('dictation.status', [stringArg(args, 'videoId')]),
    },
    {
      name: 'import_lyrics_file',
      description:
        "Replaces a video's sentences with the lines of a text or .lrc file the learner provides (for example the correct lyrics " +
        'of a song), timed against the words of the current sentences. LRC time tags and section markers are ignored. The reply ' +
        'is a report with numbers only (per line: index, start, end, match score; low-confidence lines; caption words no line ' +
        'matched) and never contains the text. Vietnamese is translated again in the background.',
      inputSchema: schema(
        { videoId, path: { type: 'string', description: 'Absolute path of the file, or relative to the folder this server runs in' } },
        ['videoId', 'path'],
      ),
      async run(args) {
        const id = stringArg(args, 'videoId')
        const path = stringArg(args, 'path')
        let bytes: Buffer
        try {
          bytes = await readFile(path)
        } catch {
          throw new ToolInputError(`Cannot read the file "${path}"`)
        }
        if (bytes.length > MAX_LYRICS_BYTES) throw new ToolInputError(`The file is larger than ${MAX_LYRICS_BYTES / 1024} KB`)
        let text: string
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        } catch {
          throw new ToolInputError('The file is not UTF-8 text')
        }
        const lines = parseLyricLines(text)
        if (lines.length === 0) throw new ToolInputError('The file has no line that can be typed')
        return rpc('dictation.importLines', [id, lines])
      },
    },
    {
      name: 'edit_sentence',
      description:
        'Changes one sentence: its English text (en), Vietnamese (vi), start or end (seconds). Changing en without vi drops the ' +
        'Vietnamese, which is then translated again in the background.',
      inputSchema: schema(
        {
          videoId,
          index,
          en: { type: 'string' },
          vi: { type: 'string' },
          start: { type: 'number', minimum: 0 },
          end: { type: 'number', minimum: 0 },
        },
        ['videoId', 'index'],
      ),
      run(args) {
        const patch: Record<string, unknown> = {}
        for (const key of ['en', 'vi', 'start', 'end']) if (args[key] !== undefined) patch[key] = args[key]
        if (Object.keys(patch).length === 0) throw new ToolInputError('Give at least one of en, vi, start, end')
        return rpc('dictation.editSentence', [stringArg(args, 'videoId'), indexArg(args, 'index'), patch])
      },
    },
    {
      name: 'merge_sentences',
      description:
        'Merges sentence index with the one after it and returns its index, times and word count (no text). Later indices move ' +
        'down by one.',
      inputSchema: schema({ videoId, index }, ['videoId', 'index']),
      async run(args) {
        const at = indexArg(args, 'index')
        return bare((await rpc('dictation.mergeSentences', [stringArg(args, 'videoId'), at])) as Sentence, at)
      },
    },
    {
      name: 'split_sentence',
      description:
        'Splits a sentence before its word number atWord (counting words of en from 0), sharing its time by length, and ' +
        'returns the two parts as index, times and word count (no text). Later indices move up by one.',
      inputSchema: schema({ videoId, index, atWord: { type: 'integer', minimum: 1 } }, ['videoId', 'index', 'atWord']),
      async run(args) {
        const at = indexArg(args, 'index')
        const parts = (await rpc('dictation.splitSentence', [stringArg(args, 'videoId'), at, indexArg(args, 'atWord')])) as Sentence[]
        return parts.map((part, i) => bare(part, at + i))
      },
    },
    {
      name: 'delete_sentence',
      description: 'Deletes one sentence (for example a line that is only music). Later indices move down by one.',
      inputSchema: schema({ videoId, index }, ['videoId', 'index']),
      run: (args) => rpc('dictation.deleteSentence', [stringArg(args, 'videoId'), indexArg(args, 'index')]),
    },
    {
      name: 'retranslate_video',
      description: 'Translates into Vietnamese, in the background, every sentence of the video that has no Vietnamese.',
      inputSchema: schema({ videoId }, ['videoId']),
      run: (args) => rpc('dictation.retranslate', [stringArg(args, 'videoId')]),
    },
    {
      name: 'call_procedure',
      description:
        "Calls any procedure of the web's data server with its positional arguments (cards, custom word sets, typing records, " +
        'reviews, settings, dictation). The procedures and their arguments are defined in src/data/contract.ts.',
      inputSchema: schema(
        {
          name: { type: 'string', enum: PROCEDURE_NAMES },
          args: { type: 'array', items: {}, description: 'Positional arguments, in the order of the contract' },
        },
        ['name'],
      ),
      run(args) {
        const name = stringArg(args, 'name')
        if (!(PROCEDURE_NAMES as string[]).includes(name)) throw new ToolInputError(`Unknown procedure "${name}"`)
        if (args.args !== undefined && !Array.isArray(args.args)) throw new ToolInputError('"args" must be an array')
        return rpc(name, (args.args as unknown[] | undefined) ?? [])
      },
    },
  ]
}

export const INSTRUCTIONS = [
  "Tools for the qwerty-learner web app's local data: dictionaries and the learner's own sets, flashcards, typing history,",
  'mistakes and activity, and dictation videos.',
  'Every dict argument takes a built-in id (cet4), a set id (custom:<id>) or an exact name; list_dictionaries shows them.',
  'Built-in dictionaries and the suggested videos are files of the repo: edits show in the dev server at once and in the stable',
  "app after yarn stable:update. The learner's sets and study data live on the data server and change at once.",
  'Take backup_data before bulk edits or deletes.',
  'Dictation videos are YouTube videos split into sentences to type. Sentence indices change after merge_sentences,',
  'split_sentence, delete_sentence and import_lyrics_file: read get_video again before the next index-based edit. To fix a song,',
  'ask the learner to save the correct lyrics in a file and use import_lyrics_file, then fix the low-confidence lines it reports',
  'by index. prepare_video with refetch restores the version from YouTube.',
].join(' ')
