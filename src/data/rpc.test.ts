import { __resetEventsForTests, getConnectionState, subscribe } from './events'
import { DataError, call } from './rpc'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const respond = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) })

beforeEach(() => __resetEventsForTests())
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('call', () => {
  it('posts the arguments as JSON and returns the result', async () => {
    const fetchMock = vi.fn().mockReturnValue(respond(200, { result: [1, 2] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(call('cards.byDict', 'cet4')).resolves.toEqual([1, 2])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/rpc/cards.byDict')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ args: ['cet4'] })
  })

  it('leaves out trailing undefined arguments, so an omitted now stays omitted', async () => {
    const fetchMock = vi.fn().mockReturnValue(respond(200, { result: null }))
    vi.stubGlobal('fetch', fetchMock)
    await call('cards.reviewQuiz', 'd', 'w', true, undefined)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ args: ['d', 'w', true] })
  })

  it('maps an error body to a DataError with the same code and message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(404, { error: { code: 'NOT_FOUND', message: 'no such set' } })))
    await expect(call('sets.get', 'x')).rejects.toMatchObject({ name: 'DataError', code: 'NOT_FOUND', message: 'no such set' })
  })

  it('treats an error code it does not know, or a body that is not JSON, as INTERNAL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(500, { error: { code: 'WHAT', message: 'boom' } })))
    await expect(call('sets.list')).rejects.toMatchObject({ code: 'INTERNAL', message: 'boom' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(Promise.resolve({ ok: false, status: 502, json: () => Promise.reject(new Error('not json')) })),
    )
    await expect(call('sets.list')).rejects.toMatchObject({ code: 'INTERNAL' })
  })

  it('reports UNREACHABLE when the request itself fails, and marks the connection down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const error = await call('sets.list').catch((e) => e)
    expect(error).toBeInstanceOf(DataError)
    expect(error.code).toBe('UNREACHABLE')
    expect(getConnectionState()).toBe('down')
  })

  it('marks the connection open after a successful call', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError('x'))
        .mockReturnValue(respond(200, { result: [] })),
    )
    await call('sets.list').catch(() => undefined)
    expect(getConnectionState()).toBe('down')
    await call('sets.list')
    expect(getConnectionState()).toBe('open')
  })

  it('refreshes the subscribers of the topics a write changes, and not after a read', async () => {
    const onCards = vi.fn()
    const onOther = vi.fn()
    subscribe(['cards:cet4'], onCards)
    subscribe(['customDicts'], onOther)
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(respond(200, { result: { id: 1 } })))
    await call('cards.review', 'cet4', 'w', 'good')
    await Promise.resolve()
    expect(onCards).toHaveBeenCalledTimes(1)
    expect(onOther).not.toHaveBeenCalled()
    await call('cards.byDict', 'cet4')
    await Promise.resolve()
    expect(onCards).toHaveBeenCalledTimes(1)
  })
})
