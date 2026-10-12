export const BEST_KEY_PREFIX = 'matchBest:'

export type BestStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** localStorage, or undefined when it is not available (reading the property itself can throw in private mode). */
function defaultStorage(): BestStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/** A stored best time: a positive finite number of milliseconds, otherwise null. */
export function sanitizeBest(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null
}

/** Compares a finished game's time with the previous best. Only a strictly smaller time is a new best. */
export function updateBest(previous: number | null, elapsedMs: number): { best: number | null; isNewBest: boolean } {
  if (!Number.isFinite(elapsedMs)) return { best: previous, isNewBest: false }
  const time = Math.max(1, Math.round(elapsedMs))
  if (previous === null || time < previous) return { best: time, isNewBest: true }
  return { best: previous, isNewBest: false }
}

export function readBest(dictId: string, storage: BestStorage | undefined = defaultStorage()): number | null {
  try {
    return sanitizeBest(storage?.getItem(BEST_KEY_PREFIX + dictId))
  } catch {
    return null
  }
}

/** Returns false when the best time could not be stored (storage missing or blocked); the game works without it. */
export function writeBest(dictId: string, ms: number, storage: BestStorage | undefined = defaultStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(BEST_KEY_PREFIX + dictId, String(ms))
    return true
  } catch {
    return false
  }
}

/** `m:ss.t`, for example 65400 → `1:05.4`. A negative or non-numeric duration shows as zero. */
export function formatDuration(ms: number): string {
  const tenths = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 100) : 0
  const minutes = Math.floor(tenths / 600)
  const seconds = Math.floor((tenths % 600) / 10)
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}.${tenths % 10}`
}
