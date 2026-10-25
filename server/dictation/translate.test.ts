// @vitest-environment node
import { fakeTools } from './fakes'
import { ToolError } from './tools'
import { translateBatches } from './translate'
import { describe, expect, it } from 'vitest'

const sentences = (n: number) => Array.from({ length: n }, (_, i) => `Sentence number ${i}.`)

describe('translateBatches', () => {
  it('translates in batches of 40 with the sentences sent as a JSON array, one answer per sentence', async () => {
    const tools = fakeTools({})
    const result = await translateBatches(sentences(85), { runTool: tools.runTool, claude: '/opt/bin/claude' })
    expect(tools.calls).toHaveLength(3)
    expect(tools.calls[0].command).toBe('/opt/bin/claude')
    expect(tools.calls[0].args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json', '--tools', '']))
    expect(tools.calls[0].input).toContain(JSON.stringify(sentences(85).slice(0, 40)))
    expect(result).toHaveLength(85)
    expect(result[84]).toBe('VI: Sentence number 84.')
  })

  it('leaves a batch untranslated when its reply has the wrong length or is not JSON, and keeps the others', async () => {
    let call = 0
    const tools = fakeTools({
      translate: (batch) => {
        call++
        if (call === 1) return JSON.stringify(batch.slice(1).map((s) => `VI: ${s}`))
        if (call === 2) return 'Sorry, I cannot help.'
        return '```json\n' + JSON.stringify(batch.map((s) => `VI: ${s}`)) + '\n```'
      },
    })
    const result = await translateBatches(sentences(90), { runTool: tools.runTool, claude: 'claude' })
    expect(result.slice(0, 80).every((v) => v === undefined)).toBe(true)
    expect(result.slice(80)).toEqual(
      sentences(90)
        .slice(80)
        .map((s) => `VI: ${s}`),
    )
  })

  it('never rejects when the tool is missing or fails', async () => {
    const tools = fakeTools({ translate: () => new ToolError('missing', 'no claude') })
    expect(await translateBatches(sentences(3), { runTool: tools.runTool, claude: 'claude' })).toEqual([undefined, undefined, undefined])
  })

  it('does not call the tool for an empty list', async () => {
    const tools = fakeTools({})
    expect(await translateBatches([], { runTool: tools.runTool, claude: 'claude' })).toEqual([])
    expect(tools.calls).toEqual([])
  })
})
