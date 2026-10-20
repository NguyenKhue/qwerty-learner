import { decideGate, reduceGate, sameCounts } from './gate'
import type { GateInfo, GateState, LegacyCounts } from './gate'
import { describe, expect, it } from 'vitest'

const counts: LegacyCounts = { wordRecords: 10, chapterRecords: 2, reviewRecords: 0, customDicts: 3, cardProgress: 50, reviewLog: 40 }
const info = (over: Partial<GateInfo> = {}): GateInfo => ({ empty: true, migrated: false, migratedFrom: null, ...over })

describe('sameCounts', () => {
  it('is true for the same numbers in every table and false when any differs or a table is missing', () => {
    expect(sameCounts(counts, { ...counts })).toBe(true)
    expect(sameCounts(counts, { ...counts, reviewLog: 41 })).toBe(false)
    expect(sameCounts(counts, { wordRecords: 10 })).toBe(false)
    expect(sameCounts(null, counts)).toBe(false)
    expect(sameCounts(counts, null)).toBe(false)
  })
})

describe('decideGate', () => {
  it('is ready when this browser holds no data of the old kind', () => {
    expect(decideGate(info(), null)).toEqual({ kind: 'ready' })
    expect(decideGate(info({ empty: false, migrated: true }), null)).toEqual({ kind: 'ready' })
  })

  it('offers the migration when the folder is empty and was never filled by a migration and this browser holds data', () => {
    expect(decideGate(info(), counts)).toEqual({ kind: 'migrate', found: counts })
  })

  it('only mentions an old copy when the folder was filled from exactly this browser data', () => {
    expect(decideGate(info({ empty: false, migrated: true, migratedFrom: { ...counts } }), counts)).toEqual({
      kind: 'old-copy',
      found: counts,
    })
  })

  it('refuses to merge when the browser data differs from what the folder was filled from', () => {
    expect(decideGate(info({ empty: false, migrated: true, migratedFrom: { ...counts, wordRecords: 5 } }), counts)).toEqual({
      kind: 'blocked-other-browser',
      found: counts,
    })
  })

  it('refuses to merge when the folder has data that did not come from a migration', () => {
    expect(decideGate(info({ empty: false }), counts)).toEqual({ kind: 'blocked-other-browser', found: counts })
  })

  it('does not offer the migration again after a migration even if the folder is empty now', () => {
    expect(decideGate(info({ empty: true, migrated: true, migratedFrom: { ...counts } }), counts)).toEqual({
      kind: 'old-copy',
      found: counts,
    })
  })
})

describe('reduceGate', () => {
  const checking: GateState = { kind: 'checking' }

  it('goes from checking to the decided state when the check finishes, and to unreachable when it fails', () => {
    expect(reduceGate(checking, { type: 'checked', info: info(), legacy: null })).toEqual({ kind: 'ready' })
    expect(reduceGate(checking, { type: 'checked', info: info(), legacy: counts })).toEqual({ kind: 'migrate', found: counts })
    expect(reduceGate(checking, { type: 'unreachable', at: 100 })).toEqual({ kind: 'unreachable', since: 100 })
  })

  it('keeps the time of the first failure while the server stays unreachable', () => {
    const first = reduceGate(checking, { type: 'unreachable', at: 100 })
    expect(reduceGate(first, { type: 'unreachable', at: 200 })).toEqual({ kind: 'unreachable', since: 100 })
  })

  it('goes back to checking on retry and leaves unreachable as soon as a check succeeds', () => {
    const down: GateState = { kind: 'unreachable', since: 100 }
    expect(reduceGate(down, { type: 'retry' })).toEqual({ kind: 'checking' })
    expect(reduceGate(down, { type: 'checked', info: info(), legacy: null })).toEqual({ kind: 'ready' })
  })

  it('moves through migrating to ready, or to failed with the message, and failed can be retried', () => {
    const offer: GateState = { kind: 'migrate', found: counts }
    const running = reduceGate(offer, { type: 'migrate-start' })
    expect(running).toEqual({ kind: 'migrating', found: counts })
    expect(reduceGate(running, { type: 'migrated' })).toEqual({ kind: 'ready' })
    const failed = reduceGate(running, { type: 'failed', message: 'counts differ' })
    expect(failed).toEqual({ kind: 'failed', message: 'counts differ' })
    expect(reduceGate(failed, { type: 'retry' })).toEqual({ kind: 'checking' })
  })

  it('lets the learner continue past the old-copy and blocked notices only', () => {
    expect(reduceGate({ kind: 'old-copy', found: counts }, { type: 'continue' })).toEqual({ kind: 'ready' })
    expect(reduceGate({ kind: 'blocked-other-browser', found: counts }, { type: 'continue' })).toEqual({ kind: 'ready' })
    expect(reduceGate({ kind: 'migrate', found: counts }, { type: 'continue' })).toEqual({ kind: 'migrate', found: counts })
  })

  it('goes to unreachable when the server disappears during the offer, but ready stays ready', () => {
    expect(reduceGate({ kind: 'migrate', found: counts }, { type: 'unreachable', at: 5 })).toEqual({ kind: 'unreachable', since: 5 })
    expect(reduceGate({ kind: 'ready' }, { type: 'unreachable', at: 5 })).toEqual({ kind: 'ready' })
  })

  it('ignores an event that makes no sense in the current state', () => {
    expect(reduceGate({ kind: 'ready' }, { type: 'migrated' })).toEqual({ kind: 'ready' })
    expect(reduceGate(checking, { type: 'migrate-start' })).toEqual({ kind: 'checking' })
    expect(reduceGate({ kind: 'migrating', found: counts }, { type: 'retry' })).toEqual({ kind: 'migrating', found: counts })
  })
})
