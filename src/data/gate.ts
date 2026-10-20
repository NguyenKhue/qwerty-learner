/** Number of rows per table of the old browser database (`wordRecords`, `chapterRecords`, …). */
export type LegacyCounts = Record<string, number>

/** What the boot gate learns from the data server about the data folder. */
export type GateInfo = {
  /** The folder holds no learning data yet. */
  empty: boolean
  /** A migration from a browser was completed into this folder. */
  migrated: boolean
  /** What that browser held at the time, to tell the same browser from another one later. */
  migratedFrom: LegacyCounts | null
}

export type GateState =
  | { kind: 'checking' }
  | { kind: 'unreachable'; since: number }
  | { kind: 'ready' }
  | { kind: 'migrate'; found: LegacyCounts }
  | { kind: 'migrating'; found: LegacyCounts }
  | { kind: 'old-copy'; found: LegacyCounts }
  | { kind: 'blocked-other-browser'; found: LegacyCounts }
  | { kind: 'failed'; message: string }

export type GateEvent =
  | { type: 'checked'; info: GateInfo; legacy: LegacyCounts | null }
  | { type: 'unreachable'; at: number }
  | { type: 'retry' }
  | { type: 'migrate-start' }
  | { type: 'migrated' }
  | { type: 'failed'; message: string }
  | { type: 'continue' }

/** Whether two sets of counts are the same in every table. */
export function sameCounts(a: LegacyCounts | null, b: LegacyCounts | null): boolean {
  if (!a || !b) return false
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key])
}

/**
 * What to do once the server answered. Data in this browser is only ever moved into an empty, never-migrated folder; when the folder
 * already has data the browser copy is left alone (no merge, no overwrite) and the learner is told which case it is.
 */
export function decideGate(info: GateInfo, legacy: LegacyCounts | null): GateState {
  if (!legacy) return { kind: 'ready' }
  if (info.empty && !info.migrated) return { kind: 'migrate', found: legacy }
  if (info.migrated && sameCounts(info.migratedFrom, legacy)) return { kind: 'old-copy', found: legacy }
  return { kind: 'blocked-other-browser', found: legacy }
}

export function reduceGate(state: GateState, event: GateEvent): GateState {
  switch (event.type) {
    case 'checked':
      return state.kind === 'checking' || state.kind === 'unreachable' ? decideGate(event.info, event.legacy) : state
    case 'unreachable':
      if (state.kind === 'unreachable') return state
      return state.kind === 'ready' ? state : { kind: 'unreachable', since: event.at }
    case 'retry':
      return state.kind === 'unreachable' || state.kind === 'failed' ? { kind: 'checking' } : state
    case 'migrate-start':
      return state.kind === 'migrate' ? { kind: 'migrating', found: state.found } : state
    case 'migrated':
      return state.kind === 'migrating' ? { kind: 'ready' } : state
    case 'failed':
      return state.kind === 'migrating' ? { kind: 'failed', message: event.message } : state
    case 'continue':
      return state.kind === 'old-copy' || state.kind === 'blocked-other-browser' ? { kind: 'ready' } : state
  }
}
