import { indexArg, limitArg, optionalString, schema, stringArg, stringListArg } from './args'
import type { Rpc } from './args'
import { ToolInputError } from './protocol'
import type { McpTool } from './protocol'
import {
  dictMtime,
  readDict,
  readExtras,
  readRegistry,
  readSuggestedVideos,
  writeDict,
  writeExtras,
  writeSuggestedVideos,
} from './repoFiles'
import type { ExtrasFile, RegistryEntry } from './repoFiles'
import type { Word, WordExample } from '@/typings'
import type { CustomDictRecord } from '@/utils/db/record'
import { isVideoId } from '@/utils/dictation/videoId'

/** Words per chapter (`CHAPTER_LENGTH` of `@/constants`, which cannot be imported here: it pulls in browser code). */
const CHAPTER_LENGTH = 20
const CUSTOM_PREFIX = 'custom:'

/** A dictionary a tool works on: a built-in one (files in the repo) or one of the learner's sets (the data server). */
export type ResolvedDict =
  | { kind: 'builtin'; id: string; name: string; entry: RegistryEntry }
  | { kind: 'custom'; id: string; name: string; record: CustomDictRecord }

/** Finds dictionaries and reads their words; shared with the study tools, which need the word lists too. */
export type Library = {
  resolve(dict: string): Promise<ResolvedDict>
  /** The words of a dictionary; a built-in one is merged with its extras file. */
  words(dict: ResolvedDict): Word[]
  builtins(): RegistryEntry[]
  sets(): Promise<CustomDictRecord[]>
}

/** A Library over the repo at `root` and the data server. Built-in files are cached until they change on disk. */
export function createLibrary(rpc: Rpc, root: string): Library {
  const cache = new Map<string, { mtime: number; words: Word[] }>()

  const builtins = () => {
    // Two registry entries may share an id; the app uses the first, so do we
    const seen = new Set<string>()
    return readRegistry(root).filter((entry) => !seen.has(entry.id) && Boolean(seen.add(entry.id)))
  }
  const sets = async () => (await rpc('sets.list', [])) as CustomDictRecord[]

  function builtinWords(entry: RegistryEntry): Word[] {
    let mtime: number
    try {
      mtime = dictMtime(root, entry)
    } catch {
      throw new ToolInputError(`The file of ${entry.id} (${entry.url}) is missing from the repo`)
    }
    const cached = cache.get(entry.url)
    if (cached && cached.mtime === mtime) return cached.words
    const extras = readExtras(root, entry)
    const words = readDict(root, entry).map((word) => {
      // An older extras file keeps a bare string: the detail
      const extra = extras[word.name] as ExtrasFile[string] | string | undefined
      return { ...word, ...(typeof extra === 'string' ? { detail: extra } : extra ?? {}) }
    })
    cache.set(entry.url, { mtime, words })
    return words
  }

  return {
    builtins,
    sets,
    words: (dict) => (dict.kind === 'builtin' ? builtinWords(dict.entry) : dict.record.words),
    async resolve(dict) {
      const wanted = dict.trim()
      if (wanted.startsWith(CUSTOM_PREFIX)) {
        const record = (await rpc('sets.get', [wanted.slice(CUSTOM_PREFIX.length)])) as CustomDictRecord | null
        if (!record) throw new ToolInputError(`There is no set ${wanted}`)
        return { kind: 'custom', id: wanted, name: record.name, record }
      }
      const entries = builtins()
      const byId = entries.find((entry) => entry.id === wanted)
      if (byId) return { kind: 'builtin', id: byId.id, name: byId.name, entry: byId }

      const lower = wanted.toLowerCase()
      const records = await sets()
      const matches: ResolvedDict[] = [
        ...entries
          .filter((e) => e.name.toLowerCase() === lower)
          .map((e) => ({ kind: 'builtin' as const, id: e.id, name: e.name, entry: e })),
        ...records
          .filter((r) => r.name.toLowerCase() === lower)
          .map((r) => ({ kind: 'custom' as const, id: CUSTOM_PREFIX + r.id, name: r.name, record: r })),
      ]
      if (matches.length === 1) return matches[0]
      if (matches.length > 1) {
        throw new ToolInputError(`"${wanted}" names several dictionaries: ${matches.map((m) => `${m.id} (${m.name})`).join(', ')}`)
      }
      const near = [
        ...entries.map((e) => ({ id: e.id, name: e.name })),
        ...records.map((r) => ({ id: CUSTOM_PREFIX + r.id, name: r.name })),
      ]
        .filter((d) => d.id.toLowerCase().includes(lower) || d.name.toLowerCase().includes(lower))
        .slice(0, 8)
      throw new ToolInputError(
        `No dictionary is called "${wanted}".` + (near.length > 0 ? ` Close: ${near.map((d) => `${d.id} (${d.name})`).join(', ')}` : ''),
      )
    },
  }
}

/** A word's name and meanings as text, for the few built-in files whose entries are irregular (a null name, a string trans). */
const nameOf = (word: Word): string => (typeof word.name === 'string' ? word.name : String(word.name ?? ''))
const transOf = (word: Word): string[] =>
  Array.isArray(word.trans) ? word.trans.map(String) : typeof word.trans === 'string' ? [word.trans] : []

/** A word in a list: everything short, and only whether it has the long detail and how many examples. */
const brief = (word: Word, index: number) => ({
  index,
  name: nameOf(word),
  trans: transOf(word),
  usphone: word.usphone || undefined,
  ukphone: word.ukphone || undefined,
  hasDetail: Boolean(word.detail),
  exampleCount: word.examples?.length ?? 0,
})

function findWord(words: Word[], name: string): number {
  const exact = words.findIndex((w) => w.name === name)
  if (exact !== -1) return exact
  const lower = name.toLowerCase()
  const loose = words.map((w, i) => (nameOf(w).toLowerCase() === lower ? i : -1)).filter((i) => i !== -1)
  if (loose.length === 1) return loose[0]
  throw new ToolInputError(`"${name}" is not in this dictionary`)
}

function readExamples(value: unknown): WordExample[] {
  const ok = (e: unknown): e is WordExample => {
    const example = e as Record<string, unknown> | null
    return (
      !!example &&
      typeof example === 'object' &&
      typeof example.text === 'string' &&
      example.text.trim() !== '' &&
      (example.trans === undefined || typeof example.trans === 'string')
    )
  }
  if (!Array.isArray(value) || !value.every(ok)) throw new ToolInputError('"examples" must be a list of { text, trans? }')
  return value.map((e) => ({ text: e.text.trim(), ...(e.trans?.trim() ? { trans: e.trans.trim() } : {}) }))
}

/** A word from tool input: a name, meanings (a list, or one string with `;` between them) and the optional fields. */
function readWord(value: unknown): Word {
  if (!value || typeof value !== 'object') throw new ToolInputError('Every word must be an object with name and trans')
  const raw = value as Record<string, unknown>
  if (typeof raw.name !== 'string' || raw.name.trim() === '') throw new ToolInputError('Every word needs a name')
  const trans =
    typeof raw.trans === 'string'
      ? raw.trans.split(';')
      : Array.isArray(raw.trans) && raw.trans.every((t) => typeof t === 'string')
      ? (raw.trans as string[])
      : null
  if (!trans) throw new ToolInputError(`"${raw.name}": trans must be a list of strings`)
  const word: Word = {
    name: raw.name.trim(),
    trans: trans.map((t) => t.trim()).filter(Boolean),
    usphone: typeof raw.usphone === 'string' ? raw.usphone.trim() : '',
    ukphone: typeof raw.ukphone === 'string' ? raw.ukphone.trim() : '',
  }
  if (typeof raw.notation === 'string' && raw.notation.trim()) word.notation = raw.notation.trim()
  if (typeof raw.detail === 'string' && raw.detail.trim()) word.detail = raw.detail.trim()
  if (raw.examples !== undefined) word.examples = readExamples(raw.examples)
  return word
}

/** The fields of a patch that are present, checked; an empty string for detail or examples `[]` removes them. */
function readPatch(value: unknown): Partial<Word> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ToolInputError('"patch" must be an object')
  const raw = value as Record<string, unknown>
  const patch: Partial<Word> = {}
  for (const key of ['name', 'usphone', 'ukphone', 'notation', 'detail'] as const) {
    if (raw[key] === undefined) continue
    if (typeof raw[key] !== 'string') throw new ToolInputError(`patch.${key} must be a string`)
    patch[key] = (raw[key] as string).trim()
  }
  if (patch.name === '') throw new ToolInputError('patch.name cannot be empty')
  if (raw.trans !== undefined) patch.trans = readWord({ name: 'x', trans: raw.trans }).trans
  if (raw.examples !== undefined) patch.examples = raw.examples === null ? [] : readExamples(raw.examples)
  if (Object.keys(patch).length === 0) throw new ToolInputError('"patch" changes nothing')
  return patch
}

/** A word with a patch applied; empty optional fields are dropped. */
function patched(word: Word, patch: Partial<Word>): Word {
  const next: Word = { ...word, ...patch }
  if (!next.detail) delete next.detail
  if (!next.notation) delete next.notation
  if (!next.examples || next.examples.length === 0) delete next.examples
  return next
}

/** A word without the fields kept in the extras file. */
function withoutExtras(word: Word): Word {
  const rest = { ...word }
  delete rest.detail
  delete rest.examples
  return rest
}

const dict = { type: 'string', description: 'A dictionary id (cet4), a set id (custom:abc123) or its exact name' }
const wordSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    trans: { type: 'array', items: { type: 'string' }, description: 'Meanings, one per entry (Vietnamese in this app)' },
    usphone: { type: 'string' },
    ukphone: { type: 'string' },
    notation: { type: 'string' },
    detail: { type: 'string', description: 'The long explanation on the back of a flashcard' },
    examples: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The English sentence' },
          trans: { type: 'string', description: 'Its Vietnamese' },
        },
        required: ['text'],
      },
    },
  },
  required: ['name', 'trans'],
}

/** The custom set as the update procedure takes it. */
const setInput = (record: CustomDictRecord, words: Word[]) => ({ name: record.name, description: record.description, words })

/**
 * The tools for dictionaries and sets: list, read and search them, edit words (built-in ones in the repo files, the learner's
 * sets on the data server), manage sets, and the list of suggested dictation videos.
 */
export function createLibraryTools(rpc: Rpc, library: Library, root: string): McpTool[] {
  async function saveWords(target: ResolvedDict, words: Word[]): Promise<string> {
    if (target.kind === 'custom') {
      await rpc('sets.update', [target.record.id, setInput(target.record, words)])
      return 'the data server'
    }
    const entry = target.entry
    if (entry.extrasUrl) {
      const extras = readExtras(root, entry)
      const names = new Set(words.map((w) => w.name))
      for (const name of Object.keys(extras)) if (!names.has(name)) delete extras[name]
      for (const word of words) {
        if (word.detail || word.examples?.length) {
          extras[word.name] = {
            ...(word.detail ? { detail: word.detail } : {}),
            ...(word.examples?.length ? { examples: word.examples } : {}),
          }
        } else delete extras[word.name]
      }
      writeDict(root, entry, words.map(withoutExtras))
      writeExtras(root, entry, extras)
      return `public${entry.url} and public${entry.extrasUrl}`
    }
    writeDict(root, entry, words)
    return `public${entry.url}`
  }

  const builtinNote = 'Built-in files changed: the dev server shows it at once, the stable app after yarn stable:update.'

  return [
    {
      name: 'list_dictionaries',
      description:
        'Lists the built-in dictionaries and the learner\'s own sets (kind "custom", id custom:<id>) with their word and chapter ' +
        'counts. Filter by a query on id, name, description or category.',
      inputSchema: schema(
        {
          query: { type: 'string' },
          category: { type: 'string' },
          kind: { type: 'string', enum: ['builtin', 'custom'] },
          limit: { type: 'integer', minimum: 1, maximum: 400 },
        },
        [],
      ),
      async run(args) {
        const query = optionalString(args, 'query')?.toLowerCase()
        const category = optionalString(args, 'category')?.toLowerCase()
        const all = [
          ...(args.kind === 'custom'
            ? []
            : library.builtins().map((e) => ({
                id: e.id,
                name: e.name,
                description: e.description,
                category: e.category,
                language: e.language,
                kind: 'builtin',
                wordCount: e.length,
              }))),
          ...(args.kind === 'builtin'
            ? []
            : (await library.sets()).map((r) => ({
                id: CUSTOM_PREFIX + r.id,
                name: r.name,
                description: r.description,
                category: 'My Sets',
                language: 'en',
                kind: 'custom',
                wordCount: r.words.length,
              }))),
        ].filter(
          (d) =>
            (!category || d.category.toLowerCase() === category) &&
            (!query || [d.id, d.name, d.description, d.category].some((text) => text.toLowerCase().includes(query))),
        )
        const limit = limitArg(args, 'limit', 100, 400)
        return {
          total: all.length,
          dictionaries: all.slice(0, limit).map((d) => ({ ...d, chapterCount: Math.ceil(d.wordCount / CHAPTER_LENGTH) })),
        }
      },
    },
    {
      name: 'get_dictionary_words',
      description:
        'Reads the words of a dictionary: name, meanings, phonetics, and whether each has a long detail and examples (read those ' +
        'with get_word). Pick a chapter (1-based, 20 words each) or an offset and limit.',
      inputSchema: schema(
        {
          dict,
          chapter: { type: 'integer', minimum: 1 },
          offset: { type: 'integer', minimum: 0 },
          limit: { type: 'integer', minimum: 1, maximum: 500 },
        },
        ['dict'],
      ),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const words = library.words(target)
        const offset =
          args.chapter !== undefined
            ? (indexArg(args, 'chapter') - 1) * CHAPTER_LENGTH
            : args.offset === undefined
            ? 0
            : indexArg(args, 'offset')
        const limit = args.chapter !== undefined ? CHAPTER_LENGTH : limitArg(args, 'limit', 50, 500)
        return {
          dict: target.id,
          name: target.name,
          total: words.length,
          words: words.slice(offset, offset + limit).map((word, i) => brief(word, offset + i)),
        }
      },
    },
    {
      name: 'search_words',
      description:
        'Finds a word in every dictionary and set (or one, with dict): words starting with the query first, then words containing ' +
        'it, then meanings containing it.',
      inputSchema: schema({ query: { type: 'string' }, dict, limit: { type: 'integer', minimum: 1, maximum: 200 } }, ['query']),
      async run(args) {
        const query = stringArg(args, 'query').trim().toLowerCase()
        const limit = limitArg(args, 'limit', 30, 200)
        const targets: ResolvedDict[] =
          args.dict !== undefined
            ? [await library.resolve(stringArg(args, 'dict'))]
            : [
                ...library.builtins().map((e) => ({ kind: 'builtin' as const, id: e.id, name: e.name, entry: e })),
                ...(await library.sets()).map((r) => ({ kind: 'custom' as const, id: CUSTOM_PREFIX + r.id, name: r.name, record: r })),
              ]
        const ranked: { rank: number; dict: string; dictName: string; word: Word }[] = []
        for (const target of targets) {
          let words: Word[]
          try {
            words = library.words(target)
          } catch {
            continue
          }
          for (const word of words) {
            const name = nameOf(word).toLowerCase()
            const rank =
              name === query
                ? 0
                : name.startsWith(query)
                ? 1
                : name.includes(query)
                ? 2
                : transOf(word).some((t) => t.toLowerCase().includes(query))
                ? 3
                : -1
            if (rank !== -1) ranked.push({ rank, dict: target.id, dictName: target.name, word })
          }
        }
        ranked.sort((a, b) => a.rank - b.rank || nameOf(a.word).length - nameOf(b.word).length)
        return {
          total: ranked.length,
          results: ranked
            .slice(0, limit)
            .map((r) => ({ dict: r.dict, dictName: r.dictName, name: nameOf(r.word), trans: transOf(r.word) })),
        }
      },
    },
    {
      name: 'get_word',
      description: 'Reads one word of a dictionary in full: meanings, phonetics, notation, the long detail and the example sentences.',
      inputSchema: schema({ dict, word: { type: 'string' } }, ['dict', 'word']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const words = library.words(target)
        const index = findWord(words, stringArg(args, 'word'))
        return { dict: target.id, index, ...words[index] }
      },
    },
    {
      name: 'update_word',
      description:
        'Changes a word of a dictionary or set: name, trans (meanings), usphone, ukphone, notation, detail, examples. An empty ' +
        'detail or examples [] removes them. Renaming a word of a set also moves its study history; built-in dictionaries are ' +
        'repo files.',
      inputSchema: schema(
        {
          dict,
          word: { type: 'string', description: 'The current name of the word' },
          patch: { ...wordSchema, required: [], description: 'Only the fields to change' },
        },
        ['dict', 'word', 'patch'],
      ),
      async run(args) {
        let target = await library.resolve(stringArg(args, 'dict'))
        const patch = readPatch(args.patch)
        let words = library.words(target).slice()
        let index = findWord(words, stringArg(args, 'word'))
        const from = words[index].name
        if (patch.name !== undefined && patch.name !== from && words.some((w) => w.name === patch.name)) {
          throw new ToolInputError(`"${patch.name}" is already in this dictionary`)
        }
        if (target.kind === 'custom' && patch.name !== undefined && patch.name !== from) {
          // fixNames renames the word in the set and in its cards, typing history and reviews in one transaction
          await rpc('personal.fixNames', [target.record.id, [{ from, to: patch.name }]])
          target = await library.resolve(target.id)
          words = library.words(target).slice()
          index = findWord(words, patch.name)
        }
        words[index] = patched(words[index], patch)
        const where = await saveWords(target, words)
        return { dict: target.id, word: words[index], writtenTo: where, ...(target.kind === 'builtin' ? { note: builtinNote } : {}) }
      },
    },
    {
      name: 'add_words',
      description: 'Adds words to a dictionary or set. Words whose name is already there are skipped and listed.',
      inputSchema: schema({ dict, words: { type: 'array', items: wordSchema, minItems: 1 } }, ['dict', 'words']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        if (!Array.isArray(args.words) || args.words.length === 0) throw new ToolInputError('"words" must be a non-empty list')
        const incoming = args.words.map(readWord)
        const words = library.words(target).slice()
        const names = new Set(words.map((w) => w.name))
        const added: string[] = []
        const skipped: string[] = []
        for (const word of incoming) {
          if (names.has(word.name)) skipped.push(word.name)
          else {
            names.add(word.name)
            words.push(word)
            added.push(word.name)
          }
        }
        if (added.length > 0) await saveWords(target, words)
        return {
          dict: target.id,
          added,
          skipped,
          wordCount: words.length,
          ...(target.kind === 'builtin' && added.length ? { note: builtinNote } : {}),
        }
      },
    },
    {
      name: 'remove_words',
      description: 'Removes words from a dictionary or set by name. Their study history is kept.',
      inputSchema: schema({ dict, names: { type: 'array', items: { type: 'string' }, minItems: 1 } }, ['dict', 'names']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        const remove = new Set(stringListArg(args, 'names'))
        const words = library.words(target)
        const kept = words.filter((w) => !remove.has(w.name))
        const removed = words.filter((w) => remove.has(w.name)).map((w) => w.name)
        if (kept.length === 0) throw new ToolInputError('That would leave the dictionary empty')
        if (removed.length > 0) await saveWords(target, kept)
        return {
          dict: target.id,
          removed,
          notFound: Array.from(remove).filter((name) => removed.indexOf(name) === -1),
          wordCount: kept.length,
        }
      },
    },
    {
      name: 'create_set',
      description: "Creates a set of the learner's own, optionally with words; it shows up under My Sets.",
      inputSchema: schema({ name: { type: 'string' }, description: { type: 'string' }, words: { type: 'array', items: wordSchema } }, [
        'name',
      ]),
      async run(args) {
        const words = Array.isArray(args.words) ? args.words.map(readWord) : []
        const record = (await rpc('sets.create', [
          { name: stringArg(args, 'name'), description: optionalString(args, 'description') ?? '', words },
        ])) as CustomDictRecord
        return { dict: CUSTOM_PREFIX + record.id, name: record.name, wordCount: record.words.length }
      },
    },
    {
      name: 'update_set_info',
      description: "Renames a set of the learner's own or changes its description.",
      inputSchema: schema({ dict, name: { type: 'string' }, description: { type: 'string' } }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        if (target.kind !== 'custom')
          throw new ToolInputError("Only the learner's own sets can be renamed; copy a built-in dictionary first")
        const name = optionalString(args, 'name')?.trim() || target.record.name
        const description = optionalString(args, 'description') ?? target.record.description
        await rpc('sets.update', [target.record.id, { name, description, words: target.record.words }])
        return { dict: target.id, name, description }
      },
    },
    {
      name: 'delete_set',
      description:
        "Deletes a set of the learner's own together with its flashcard schedule, typing history and reviews. This cannot be " +
        'undone: take backup_data first.',
      inputSchema: schema({ dict }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        if (target.kind !== 'custom') throw new ToolInputError('Built-in dictionaries cannot be deleted')
        await rpc('sets.delete', [target.record.id])
        return { deleted: target.id, name: target.name }
      },
    },
    {
      name: 'copy_dictionary_to_set',
      description: "Copies a built-in dictionary, with its details and examples, into a new set of the learner's own to edit freely.",
      inputSchema: schema({ dict, name: { type: 'string' } }, ['dict']),
      async run(args) {
        const target = await library.resolve(stringArg(args, 'dict'))
        if (target.kind !== 'builtin') throw new ToolInputError("That is already a set of the learner's own")
        const record = (await rpc('sets.create', [
          {
            name: optionalString(args, 'name')?.trim() || `${target.name} (copy)`,
            description: target.entry.description,
            words: library.words(target),
          },
        ])) as CustomDictRecord
        return { dict: CUSTOM_PREFIX + record.id, name: record.name, wordCount: record.words.length }
      },
    },
    {
      name: 'list_suggested_videos',
      description: 'Lists the videos suggested on the Dictation page (public/dictation-videos.json).',
      inputSchema: schema({}, []),
      run: async () => readSuggestedVideos(root),
    },
    {
      name: 'add_suggested_video',
      description: 'Adds a video to the Dictation page suggestions.',
      inputSchema: schema(
        {
          id: { type: 'string', description: 'YouTube video id' },
          title: { type: 'string' },
          channel: { type: 'string' },
          category: { type: 'string' },
        },
        ['id', 'title', 'channel', 'category'],
      ),
      async run(args) {
        const id = stringArg(args, 'id').trim()
        if (!isVideoId(id)) throw new ToolInputError(`"${id}" is not a YouTube video id`)
        const videos = readSuggestedVideos(root)
        if (videos.some((v) => v.id === id)) throw new ToolInputError(`${id} is already suggested`)
        const video = {
          id,
          title: stringArg(args, 'title').trim(),
          channel: stringArg(args, 'channel').trim(),
          category: stringArg(args, 'category').trim(),
        }
        writeSuggestedVideos(root, [...videos, video])
        return { added: video, count: videos.length + 1, note: builtinNote }
      },
    },
    {
      name: 'remove_suggested_video',
      description: 'Removes a video from the Dictation page suggestions.',
      inputSchema: schema({ id: { type: 'string' } }, ['id']),
      async run(args) {
        const id = stringArg(args, 'id').trim()
        const videos = readSuggestedVideos(root)
        if (!videos.some((v) => v.id === id)) throw new ToolInputError(`${id} is not suggested`)
        writeSuggestedVideos(
          root,
          videos.filter((v) => v.id !== id),
        )
        return { removed: id, count: videos.length - 1, note: builtinNote }
      },
    },
  ]
}
