// @vitest-environment node
import { createMcpServer, serveStdio } from './protocol'
import { INSTRUCTIONS, createTools, httpRpc } from './tools'
import type { Rpc } from './tools'
import { PassThrough } from 'node:stream'
import { describe, expect, it } from 'vitest'

const ID = 'dQw4w9WgXcQ'

function setup(answers: Record<string, unknown> = {}, files: Record<string, Buffer> = {}) {
  const calls: { name: string; args: unknown[] }[] = []
  const rpc: Rpc = async (name, args) => {
    calls.push({ name, args })
    if (name in answers) return answers[name]
    return null
  }
  const readFile = async (path: string) => {
    if (!(path in files)) throw new Error('ENOENT')
    return files[path]
  }
  const handle = createMcpServer({
    name: 'qwerty-learner',
    version: '0.0.0',
    instructions: INSTRUCTIONS,
    tools: createTools(rpc, readFile),
  })
  let next = 1
  const call = async (name: string, args: Record<string, unknown> = {}) =>
    (await handle({ jsonrpc: '2.0', id: next++, method: 'tools/call', params: { name, arguments: args } })) as {
      result: { content: { text: string }[]; isError?: boolean }
    }
  return { calls, handle, call }
}

describe('the MCP protocol', () => {
  it('answers initialize with the asked version when it knows it, and the latest otherwise', async () => {
    const { handle } = setup()
    const known = (await handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })) as {
      result: { protocolVersion: string; capabilities: unknown; serverInfo: { name: string } }
    }
    expect(known.result).toMatchObject({
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'qwerty-learner' },
    })
    const unknown = (await handle({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })) as {
      result: { protocolVersion: string }
    }
    expect(unknown.result.protocolVersion).toBe('2025-06-18')
  })

  it('ignores notifications, answers ping and refuses an unknown method', async () => {
    const { handle } = setup()
    expect(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined()
    expect(await handle({ jsonrpc: '2.0', id: 3, method: 'ping' })).toEqual({ jsonrpc: '2.0', id: 3, result: {} })
    expect(await handle({ jsonrpc: '2.0', id: 4, method: 'resources/list' })).toMatchObject({ error: { code: -32601 } })
  })

  it('lists every tool with an object input schema', async () => {
    const { handle } = setup()
    const answer = (await handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as {
      result: { tools: { name: string; inputSchema: { type: string } }[] }
    }
    const names = answer.result.tools.map((t) => t.name)
    expect(names).toContain('import_lyrics_file')
    expect(names).toContain('call_procedure')
    expect(answer.result.tools.every((t) => t.inputSchema.type === 'object')).toBe(true)
  })

  it('turns a failing tool into a tool result with isError', async () => {
    const { call } = setup()
    const answer = await call('merge_sentences', { videoId: ID, index: -1 })
    expect(answer.result.isError).toBe(true)
    expect(answer.result.content[0].text).toMatch(/index/)
  })

  it('serves one message per line over stdio and writes only protocol messages', async () => {
    const { handle } = setup()
    const input = new PassThrough()
    const output = new PassThrough()
    const written: string[] = []
    output.on('data', (chunk: Buffer) => written.push(chunk.toString('utf8')))
    const done = serveStdio(handle, input, output)
    input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n')
    input.write('not json\n')
    input.end('{"jsonrpc":"2.0","method":"notifications/initialized"}\n')
    await done
    const messages = written
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { id: unknown; error?: { code: number } })
    expect(messages).toHaveLength(2)
    expect(messages).toContainEqual({ jsonrpc: '2.0', id: 1, result: {} })
    expect(messages.find((m) => m.error)?.error?.code).toBe(-32700)
  })
})

describe('the dictation tools', () => {
  it('sends the lines of a lyrics file to the server and replies with the report only', async () => {
    const report = { lineCount: 2, previousSentenceCount: 3, matchedLineCount: 2, lines: [], lowConfidence: [], unmatchedCaptionWords: 0 }
    const file = Buffer.from('[00:01.00]we walk to the river at night\n\n[Chorus]\n[00:05.50]the lamps are low and bright\n')
    const { calls, call } = setup({ 'dictation.importLines': report }, { '/tmp/song.lrc': file })
    const answer = await call('import_lyrics_file', { videoId: ID, path: '/tmp/song.lrc' })
    expect(calls).toEqual([
      { name: 'dictation.importLines', args: [ID, ['we walk to the river at night', 'the lamps are low and bright']] },
    ])
    expect(JSON.parse(answer.result.content[0].text)).toEqual(report)
    expect(answer.result.content[0].text).not.toMatch(/river/)
  })

  it('refuses a lyrics file that cannot be read or is not UTF-8', async () => {
    const { calls, call } = setup({}, { '/tmp/bad.txt': Buffer.from([0xff, 0xfe, 0xfd]) })
    expect((await call('import_lyrics_file', { videoId: ID, path: '/tmp/none.txt' })).result.isError).toBe(true)
    expect((await call('import_lyrics_file', { videoId: ID, path: '/tmp/bad.txt' })).result.content[0].text).toMatch(/UTF-8/)
    expect(calls).toEqual([])
  })

  it('reads a video with indices, or without its text', async () => {
    const video = { id: ID, sentences: [{ start: 0, end: 2, en: 'we walk on', vi: 'ta đi tiếp' }] }
    const { call } = setup({ 'dictation.get': video })
    const full = JSON.parse((await call('get_video', { videoId: ID })).result.content[0].text) as { sentences: unknown[] }
    expect(full.sentences).toEqual([{ index: 0, start: 0, end: 2, en: 'we walk on', vi: 'ta đi tiếp' }])
    const bare = JSON.parse((await call('get_video', { videoId: ID, text: false })).result.content[0].text) as { sentences: unknown[] }
    expect(bare.sentences).toEqual([{ index: 0, start: 0, end: 2, words: 3, hasVi: true }])
  })

  it('returns merged and split sentences without their text', async () => {
    const { call } = setup({
      'dictation.mergeSentences': { start: 1, end: 9, en: 'we walk to the river', vi: 'x' },
      'dictation.splitSentence': [
        { start: 1, end: 4, en: 'we walk' },
        { start: 4, end: 9, en: 'to the river' },
      ],
    })
    const merged = (await call('merge_sentences', { videoId: ID, index: 3 })).result.content[0].text
    expect(JSON.parse(merged)).toEqual({ index: 3, start: 1, end: 9, words: 5, hasVi: true })
    const split = (await call('split_sentence', { videoId: ID, index: 3, atWord: 2 })).result.content[0].text
    expect(JSON.parse(split)).toEqual([
      { index: 3, start: 1, end: 4, words: 2, hasVi: false },
      { index: 4, start: 4, end: 9, words: 3, hasVi: false },
    ])
    expect(merged + split).not.toMatch(/river/)
  })

  it('sends only the fields given to edit_sentence and maps refetch to its procedure', async () => {
    const { calls, call } = setup()
    await call('edit_sentence', { videoId: ID, index: 2, end: 7.5 })
    await call('prepare_video', { videoId: ID, refetch: true })
    expect(calls).toEqual([
      { name: 'dictation.editSentence', args: [ID, 2, { end: 7.5 }] },
      { name: 'dictation.refetch', args: [ID] },
    ])
  })

  it('calls only procedures of the contract', async () => {
    const { calls, call } = setup()
    expect((await call('call_procedure', { name: 'nope.drop' })).result.isError).toBe(true)
    await call('call_procedure', { name: 'stats.summary' })
    expect(calls).toEqual([{ name: 'stats.summary', args: [] }])
  })
})

describe('httpRpc', () => {
  it('posts the arguments and returns the result, or throws the server error', async () => {
    const requests: { url: string; body: string }[] = []
    const fetchFn = (async (url: string, init: { body: string }) => {
      requests.push({ url, body: init.body })
      if (url.endsWith('dictation.get'))
        return new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'no' } }), { status: 400 })
      return new Response(JSON.stringify({ result: 42 }), { status: 200 })
    }) as unknown as typeof fetch
    const rpc = httpRpc('http://127.0.0.1:5180/', fetchFn)
    expect(await rpc('stats.summary', [])).toBe(42)
    await expect(rpc('dictation.get', ['x'])).rejects.toThrow('BAD_REQUEST: no')
    expect(requests[0]).toEqual({ url: 'http://127.0.0.1:5180/api/rpc/stats.summary', body: '{"args":[]}' })
  })
})
