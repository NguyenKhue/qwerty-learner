// @vitest-environment node
import { fakeRepo as repo } from './fakes'
import { readDict, readRegistry, readSuggestedVideos, writeDict, writeSuggestedVideos } from './repoFiles'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('the repo files', () => {
  it('reads the registry entries and skips the commented-out ones', () => {
    const entries = readRegistry(repo())
    expect(entries.map((e) => e.id)).toEqual(['birds', 'trees'])
    expect(entries[0]).toEqual({
      id: 'birds',
      name: "Bird's Words",
      description: 'Names of birds',
      category: 'Nature',
      tags: ['Basic', 'Animals'],
      url: '/dicts/birds.json',
      length: 2,
      language: 'en',
    })
    expect(entries[1].extrasUrl).toBe('/dicts/trees.extras.json')
  })

  it('writes a dictionary in its own indent and newline, updates its length and leaves no temporary file', () => {
    const root = repo()
    const [birds, trees] = readRegistry(root)
    writeDict(root, birds, [...readDict(root, birds), { name: 'robin', trans: ['chim cổ đỏ'], usphone: '', ukphone: '' }])
    const text = readFileSync(join(root, 'public/dicts/birds.json'), 'utf8')
    expect(text.startsWith('[\n    {\n        "name": "wren"')).toBe(true)
    expect(text.endsWith('\n')).toBe(false)
    expect(readRegistry(root).map((e) => e.length)).toEqual([3, 1])

    writeDict(root, trees, [])
    expect(readFileSync(join(root, 'public/dicts/trees.json'), 'utf8')).toBe('[]\n')
    expect(readRegistry(root)[1].length).toBe(0)
    expect(readdirSync(join(root, 'public/dicts')).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('writes the suggested videos back one object per line', () => {
    const root = repo()
    const before = readFileSync(join(root, 'public/dictation-videos.json'), 'utf8')
    writeSuggestedVideos(root, readSuggestedVideos(root))
    expect(readFileSync(join(root, 'public/dictation-videos.json'), 'utf8')).toBe(before)
  })
})
