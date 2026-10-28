// @vitest-environment node
import type { Rpc } from './args'
import { fakeRepo } from './fakes'
import { createLibrary, createLibraryTools } from './library'
import type { CustomDictRecord } from '@/utils/db/record'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function setup(sets: CustomDictRecord[] = []) {
  const root = fakeRepo()
  writeFileSync(join(root, 'public/dicts/trees.extras.json'), JSON.stringify({ oak: { detail: 'A tall tree.' } }, null, 2) + '\n')
  const calls: { name: string; args: unknown[] }[] = []
  const rpc: Rpc = async (name, args) => {
    calls.push({ name, args })
    if (name === 'sets.list') return sets
    if (name === 'sets.get') return sets.find((s) => s.id === args[0]) ?? null
    if (name === 'sets.update') {
      const set = sets.find((s) => s.id === args[0])
      if (set) set.words = (args[1] as CustomDictRecord).words
      return null
    }
    if (name === 'personal.fixNames') {
      const [{ from, to }] = args[1] as { from: string; to: string }[]
      for (const word of sets.find((s) => s.id === args[0])?.words ?? []) if (word.name === from) word.name = to
      return 1
    }
    if (name === 'sets.create') return { id: 'new1', createdAt: 1, updatedAt: 1, ...(args[0] as object) }
    return null
  }
  const library = createLibrary(rpc, root)
  const tools = createLibraryTools(rpc, library, root)
  const run = (name: string, args: Record<string, unknown> = {}) => {
    const tool = tools.find((t) => t.name === name)
    if (!tool) throw new Error(`no tool ${name}`)
    return tool.run(args) as Promise<Record<string, unknown>>
  }
  return { root, calls, library, run }
}

const set = (over: Partial<CustomDictRecord> = {}): CustomDictRecord => ({
  id: 's1',
  name: 'Garden',
  description: '',
  words: [
    { name: 'rake', trans: ['cái cào'], usphone: '', ukphone: '' },
    { name: 'hoe', trans: ['cái cuốc'], usphone: '', ukphone: '' },
  ],
  createdAt: 1,
  updatedAt: 1,
  ...over,
})

describe('the dictionary lookup', () => {
  it('finds a dictionary by id, set id or exact name, and refuses an ambiguous name', async () => {
    const { library } = setup([set(), set({ id: 's2', name: 'Trees' })])
    expect((await library.resolve('birds')).id).toBe('birds')
    expect((await library.resolve('custom:s1')).name).toBe('Garden')
    expect((await library.resolve("bird's words")).id).toBe('birds')
    expect((await library.resolve('garden')).id).toBe('custom:s1')
    await expect(library.resolve('Trees')).rejects.toThrow(/several/)
    await expect(library.resolve('bird')).rejects.toThrow(/Close: birds/)
  })
})

describe('the library tools', () => {
  it('lists words starting with the query before words containing it', async () => {
    const { root, run } = setup([set()])
    writeFileSync(
      join(root, 'public/dicts/birds.json'),
      JSON.stringify([
        { name: 'sparrowhawk', trans: ['chim cắt'], usphone: '', ukphone: '' },
        { name: 'hedge sparrow', trans: ['chim sẻ rào'], usphone: '', ukphone: '' },
      ]),
    )
    const found = await run('search_words', { query: 'sparrow' })
    expect((found.results as { name: string }[]).map((r) => r.name)).toEqual(['sparrowhawk', 'hedge sparrow'])
    const byMeaning = await run('search_words', { query: 'cuốc' })
    expect(byMeaning.results).toEqual([{ dict: 'custom:s1', dictName: 'Garden', name: 'hoe', trans: ['cái cuốc'] }])
  })

  it('reads a built-in word merged with its extras', async () => {
    const { run } = setup()
    expect(await run('get_word', { dict: 'trees', word: 'oak' })).toMatchObject({ dict: 'trees', name: 'oak', detail: 'A tall tree.' })
  })

  it('writes the detail of a built-in word to the extras file when the dictionary has one, inline otherwise', async () => {
    const { root, run } = setup()
    await run('update_word', { dict: 'trees', word: 'oak', patch: { detail: 'A strong tree.', trans: ['cây sồi', 'gỗ sồi'] } })
    expect(JSON.parse(readFileSync(join(root, 'public/dicts/trees.extras.json'), 'utf8'))).toEqual({ oak: { detail: 'A strong tree.' } })
    expect(JSON.parse(readFileSync(join(root, 'public/dicts/trees.json'), 'utf8'))).toEqual([
      { name: 'oak', trans: ['cây sồi', 'gỗ sồi'], usphone: '', ukphone: '' },
    ])
    await run('update_word', { dict: 'birds', word: 'wren', patch: { detail: 'A small bird.' } })
    expect(JSON.parse(readFileSync(join(root, 'public/dicts/birds.json'), 'utf8'))[0]).toMatchObject({
      name: 'wren',
      detail: 'A small bird.',
    })
  })

  it('keeps examples as text and trans, in the extras file', async () => {
    const { root, run } = setup()
    await run('update_word', {
      dict: 'trees',
      word: 'oak',
      patch: { examples: [{ text: 'The oak grew slowly.', trans: 'Cây sồi lớn chậm.' }] },
    })
    expect(JSON.parse(readFileSync(join(root, 'public/dicts/trees.extras.json'), 'utf8')).oak).toEqual({
      detail: 'A tall tree.',
      examples: [{ text: 'The oak grew slowly.', trans: 'Cây sồi lớn chậm.' }],
    })
    await expect(run('update_word', { dict: 'trees', word: 'oak', patch: { examples: [{ en: 'x' }] } })).rejects.toThrow(/text/)
  })

  it('renames a word of a set through fixNames, so its history follows, then saves the rest of the patch', async () => {
    const sets = [set()]
    const { calls, run } = setup(sets)
    await run('update_word', { dict: 'Garden', word: 'rake', patch: { name: 'leaf rake', usphone: 'liːf reɪk' } })
    expect(calls.find((c) => c.name === 'personal.fixNames')?.args).toEqual(['s1', [{ from: 'rake', to: 'leaf rake' }]])
    expect(sets[0].words[0]).toEqual({ name: 'leaf rake', trans: ['cái cào'], usphone: 'liːf reɪk', ukphone: '' })
    await expect(run('update_word', { dict: 'Garden', word: 'hoe', patch: { name: 'leaf rake' } })).rejects.toThrow(/already/)
  })

  it('adds new words, skips the ones already there, and removes words', async () => {
    const sets = [set()]
    const { run } = setup(sets)
    const added = await run('add_words', {
      dict: 'custom:s1',
      words: [
        { name: 'hoe', trans: ['x'] },
        { name: 'trowel', trans: 'cái bay; xẻng nhỏ' },
      ],
    })
    expect(added).toMatchObject({ added: ['trowel'], skipped: ['hoe'], wordCount: 3 })
    expect(sets[0].words[2]).toEqual({ name: 'trowel', trans: ['cái bay', 'xẻng nhỏ'], usphone: '', ukphone: '' })
    expect(await run('remove_words', { dict: 'custom:s1', names: ['hoe', 'spade'] })).toMatchObject({
      removed: ['hoe'],
      notFound: ['spade'],
    })
    expect(sets[0].words.map((w) => w.name)).toEqual(['rake', 'trowel'])
  })

  it('updates the registry length when built-in words are added', async () => {
    const { root, run } = setup()
    await run('add_words', { dict: 'birds', words: [{ name: 'robin', trans: ['chim cổ đỏ'] }] })
    expect(readFileSync(join(root, 'src/resources/dictionary.ts'), 'utf8')).toMatch(/url: '\/dicts\/birds.json',\n {4}length: 3,/)
  })

  it('copies a built-in dictionary with its extras into a new set', async () => {
    const { calls, run } = setup()
    expect(await run('copy_dictionary_to_set', { dict: 'trees' })).toEqual({ dict: 'custom:new1', name: 'Trees (copy)', wordCount: 1 })
    const input = calls.find((c) => c.name === 'sets.create')?.args[0] as { words: unknown[] }
    expect(input.words).toEqual([{ name: 'oak', trans: ['cây sồi'], usphone: '', ukphone: '', detail: 'A tall tree.' }])
  })

  it('adds a suggested video only with a real id and only once', async () => {
    const { root, run } = setup()
    const video = { title: 'Three', channel: 'C', category: 'Talks' }
    await expect(run('add_suggested_video', { id: 'nope', ...video })).rejects.toThrow(/video id/)
    await expect(run('add_suggested_video', { id: 'aaaaaaaaaaa', ...video })).rejects.toThrow(/already/)
    await run('add_suggested_video', { id: 'ccccccccccc', ...video })
    expect(readFileSync(join(root, 'public/dictation-videos.json'), 'utf8')).toContain(
      '  { "id": "ccccccccccc", "title": "Three", "channel": "C", "category": "Talks" }\n]\n',
    )
  })
})
