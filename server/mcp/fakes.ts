import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REGISTRY = `import type { DictionaryResource } from '@/typings/index'

const mine: DictionaryResource[] = [
  {
    id: 'birds',
    name: "Bird's Words",
    description: 'Names of birds',
    category: 'Nature',
    tags: ['Basic', 'Animals'],
    url: '/dicts/birds.json',
    length: 2,
    language: 'en',
    languageCategory: 'en',
  },
  // {
  //   id: 'gone',
  //   name: 'Gone',
  //   url: '/dicts/gone.json',
  //   length: 1,
  // },
  {
    id: 'trees',
    name: 'Trees',
    description: 'Names of trees',
    category: 'Nature',
    tags: ['Plants'],
    url: '/dicts/trees.json',
    extrasUrl: '/dicts/trees.extras.json',
    length: 1,
    language: 'en',
    languageCategory: 'en',
  },
]
`

/** Test helper: a repo folder with a two-entry registry (birds; trees with an extras file) and two suggested videos. */
export function fakeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'qwerty-mcp-repo-'))
  mkdirSync(join(root, 'src/resources'), { recursive: true })
  mkdirSync(join(root, 'public/dicts'), { recursive: true })
  writeFileSync(join(root, 'src/resources/dictionary.ts'), REGISTRY)
  const birds = [
    { name: 'wren', trans: ['chim hồng tước'], usphone: '', ukphone: '' },
    { name: 'finch', trans: ['chim sẻ'], usphone: '', ukphone: '' },
  ]
  writeFileSync(join(root, 'public/dicts/birds.json'), JSON.stringify(birds, null, 4))
  writeFileSync(
    join(root, 'public/dicts/trees.json'),
    JSON.stringify([{ name: 'oak', trans: ['cây sồi'], usphone: '', ukphone: '' }], null, 2) + '\n',
  )
  writeFileSync(
    join(root, 'public/dictation-videos.json'),
    '[\n  { "id": "aaaaaaaaaaa", "title": "One", "channel": "A", "category": "Talks" },\n  { "id": "bbbbbbbbbbb", "title": "Two", "channel": "B", "category": "Talks" }\n]\n',
  )
  return root
}
