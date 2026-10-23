/**
 * The live-update bus. Components subscribe to topics (`cards:<dict>`, `customDicts`, …); the data server announces the topics a write
 * changed over one server-sent-event stream, and the client that made the write announces them locally at once.
 */

export type ConnectionState = 'connecting' | 'open' | 'down'

type Listener = { topics: string[] | '*'; fn: () => void }
type SourceLike = {
  onopen: (() => void) | null
  onerror: (() => void) | null
  /** 2 = closed for good (the browser gave up reconnecting) */
  readyState?: number
  addEventListener(name: string, fn: (event: { data: string }) => void): void
  close(): void
}

/** After the page was hidden this long (a sleeping computer, another tab) everything is read again when it comes back. */
export const STALE_AFTER_MS = 10000

const defaultFactory = (): SourceLike | null =>
  typeof EventSource === 'undefined' ? null : (new EventSource('/api/events') as unknown as SourceLike)

let factory: () => SourceLike | null = defaultFactory
let source: SourceLike | null = null
let state: ConnectionState = 'connecting'
const listeners = new Set<Listener>()
const stateListeners = new Set<(state: ConnectionState) => void>()

export function getConnectionState(): ConnectionState {
  return state
}

/** Tells `fn` every time the connection to the data server goes up or down. Returns the function that stops it. */
export function onConnectionState(fn: (state: ConnectionState) => void): () => void {
  stateListeners.add(fn)
  return () => stateListeners.delete(fn)
}

function setState(next: ConnectionState) {
  if (state === next) return
  const before = state
  state = next
  Array.from(stateListeners).forEach((fn) => fn(next))
  // After an outage changes may have been missed: every subscriber runs its query again
  if (before === 'down' && next === 'open') emit('*')
}

/** A request failed to reach the server (the stream may still be retrying). */
export function reportUnreachable() {
  setState('down')
}

/** A request got an answer from the server. */
export function reportReachable() {
  setState('open')
}

/** Announces changed topics to the subscribers (`'*'` means every subscriber). Each subscriber runs once per announcement. */
export function emit(topics: string[] | '*') {
  Array.from(listeners).forEach((listener) => {
    if (topics === '*' || listener.topics === '*' || listener.topics.some((topic) => topics.indexOf(topic) !== -1)) listener.fn()
  })
}

/** The client that made a write refreshes its own screens at once, without waiting for the stream. */
export function notifyLocal(topics: string[]) {
  Promise.resolve().then(() => emit(topics))
}

let hiddenAt: number | null = null
let wakeListening = false

/** The page is visible or online again: reopen a stream that died and read everything again if it may have missed changes. */
export function refreshAfterWake(force = false) {
  if (source && source.readyState === 2) {
    source = null
    connect()
  }
  const stale = hiddenAt !== null && Date.now() - hiddenAt >= STALE_AFTER_MS
  hiddenAt = null
  if (force || stale || state === 'down') emit('*')
}

function listenForWake() {
  if (wakeListening || typeof document === 'undefined' || typeof window === 'undefined') return
  wakeListening = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else refreshAfterWake()
  })
  window.addEventListener('online', () => refreshAfterWake(true))
  window.addEventListener('pageshow', (event) => refreshAfterWake((event as PageTransitionEvent).persisted === true))
}

function connect() {
  listenForWake()
  if (source) return
  const created = factory()
  if (!created) return
  source = created
  created.onopen = () => setState('open')
  created.onerror = () => setState('down')
  created.addEventListener('change', (event) => {
    try {
      const parsed = JSON.parse(event.data) as { topics?: unknown }
      if (!Array.isArray(parsed.topics)) return
      const topics = parsed.topics.filter((topic): topic is string => typeof topic === 'string')
      // The server announces '*' after an import: everything may have changed
      emit(topics.indexOf('*') !== -1 ? '*' : topics)
    } catch {
      // A malformed event is ignored: the next one or the next reconnect refreshes everything
    }
  })
}

/** Runs `fn` whenever one of `topics` changes (or any topic for `'*'`). Opens the live stream on the first subscription. */
export function subscribe(topics: string[] | '*', fn: () => void): () => void {
  const listener: Listener = { topics, fn }
  listeners.add(listener)
  connect()
  return () => {
    listeners.delete(listener)
  }
}

/** Test hooks. */
export function setEventSourceFactory(next: () => SourceLike) {
  factory = next
}

export function __resetEventsForTests() {
  source?.close()
  source = null
  hiddenAt = null
  state = 'connecting'
  factory = defaultFactory
  listeners.clear()
  stateListeners.clear()
}
