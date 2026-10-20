import type { ServerResponse } from 'node:http'

export type EventHub = {
  connect(res: ServerResponse): void
  publish(topics: string[]): void
  closeAll(): void
  size(): number
}

/** Creates the small hub behind `GET /api/events`: every connected response, one heartbeat timer each. */
export function createEventHub(opts: { heartbeatMs?: number } = {}): EventHub {
  const heartbeatMs = opts.heartbeatMs ?? 15000
  const clients = new Map<ServerResponse, NodeJS.Timeout>()

  /** Removes a client and its timer; safe to call more than once. */
  function drop(res: ServerResponse): void {
    if (!clients.has(res)) return
    const timer = clients.get(res)
    clients.delete(res)
    if (timer !== undefined) clearInterval(timer)
  }

  return {
    connect(res: ServerResponse): void {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      })
      res.write(': connected\n\n')

      const timer = setInterval(() => {
        try {
          res.write(': ping\n\n')
        } catch {
          drop(res)
        }
      }, heartbeatMs)
      if (typeof timer.unref === 'function') timer.unref()

      clients.set(res, timer)
      res.on('close', () => drop(res))
      res.on('error', () => drop(res))
    },

    /** Writes one change event to every client; a client whose stream fails is dropped, never rethrown. */
    publish(topics: string[]): void {
      const frame = `event: change\ndata: ${JSON.stringify({ topics })}\n\n`
      for (const res of [...clients.keys()]) {
        try {
          res.write(frame)
        } catch {
          drop(res)
        }
      }
    },

    /** Ends every stream and clears its timer. */
    closeAll(): void {
      for (const res of [...clients.keys()]) {
        drop(res)
        try {
          res.end()
        } catch {
          // The socket may already be gone; nothing else to release.
        }
      }
    },

    size(): number {
      return clients.size
    },
  }
}
