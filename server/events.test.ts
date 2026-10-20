// @vitest-environment node
import { createEventHub } from './events'
import type { ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'

/** A ServerResponse stand-in that records what the hub writes and can emit 'close'. */
class FakeResponse {
  status = 0
  headers: Record<string, string> = {}
  chunks: string[] = []
  ended = false
  failing = false
  private listeners = new Map<string, (() => void)[]>()

  writeHead(status: number, headers: Record<string, string>): this {
    this.status = status
    this.headers = headers
    return this
  }

  write(chunk: string): boolean {
    if (this.failing) throw new Error('The stream is gone')
    this.chunks.push(chunk)
    return true
  }

  end(): void {
    this.ended = true
  }

  on(event: string, listener: () => void): this {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
    return this
  }

  emit(event: string): void {
    for (const listener of this.listeners.get(event) ?? []) listener()
  }

  text(): string {
    return this.chunks.join('')
  }
}

function asResponse(fake: FakeResponse): ServerResponse {
  return fake as unknown as ServerResponse
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((done) => setTimeout(done, ms))
}

describe('createEventHub', () => {
  it('writes the SSE headers and the opening comment on connect', () => {
    const hub = createEventHub()
    const client = new FakeResponse()

    hub.connect(asResponse(client))

    expect(client.status).toBe(200)
    expect(client.headers['content-type']).toBe('text/event-stream')
    expect(client.headers['cache-control']).toBe('no-cache')
    expect(client.headers.connection).toBe('keep-alive')
    expect(client.headers['x-accel-buffering']).toBe('no')
    expect(client.chunks[0]).toBe(': connected\n\n')
    expect(hub.size()).toBe(1)
  })

  it('publishes one change frame with the topics to every client', () => {
    const hub = createEventHub()
    const first = new FakeResponse()
    const second = new FakeResponse()
    hub.connect(asResponse(first))
    hub.connect(asResponse(second))

    hub.publish(['cards:custom:a', 'reviewLog'])

    const frame = 'event: change\ndata: {"topics":["cards:custom:a","reviewLog"]}\n\n'
    expect(first.text()).toContain(frame)
    expect(second.text()).toContain(frame)
  })

  it('sends comment heartbeats until the client disappears', async () => {
    const hub = createEventHub({ heartbeatMs: 10 })
    const client = new FakeResponse()
    hub.connect(asResponse(client))

    await wait(35)
    expect(client.text()).toContain(': ping')

    client.emit('close')
    expect(hub.size()).toBe(0)
    const afterClose = client.text()
    await wait(30)
    expect(client.text()).toBe(afterClose)
  })

  it('drops a client whose write fails or that closes, and never throws', () => {
    const hub = createEventHub()
    const failing = new FakeResponse()
    const alive = new FakeResponse()
    hub.connect(asResponse(failing))
    hub.connect(asResponse(alive))

    failing.failing = true
    expect(() => hub.publish(['meta'])).not.toThrow()
    expect(hub.size()).toBe(1)
    expect(alive.text()).toContain('{"topics":["meta"]}')

    alive.emit('close')
    expect(hub.size()).toBe(0)
  })

  it('closeAll ends every stream and clears the heartbeat timers', async () => {
    const hub = createEventHub({ heartbeatMs: 10 })
    const first = new FakeResponse()
    const second = new FakeResponse()
    hub.connect(asResponse(first))
    hub.connect(asResponse(second))

    hub.closeAll()

    expect(hub.size()).toBe(0)
    expect(first.ended).toBe(true)
    expect(second.ended).toBe(true)
    const afterClose = first.text()
    await wait(30)
    expect(first.text()).toBe(afterClose)
    expect(() => hub.publish(['meta'])).not.toThrow()
  })
})
