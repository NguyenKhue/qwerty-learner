import { createGrader } from './grader'
import type { QueueItem } from './queue'
import { createSession, currentItem, flip } from './session'
import type { StudySession } from './session'
import { describe, expect, it } from 'vitest'

const item = (name: string): QueueItem => ({ word: { name, trans: ['x'], usphone: '', ukphone: '' }, kind: 'new' })

function setup(options: { failSave?: boolean } = {}) {
  let session: StudySession = flip(createSession([item('a'), item('b')]))
  const saved: string[] = []
  const busyEvents: boolean[] = []
  const errors: unknown[] = []
  let release: () => void = () => undefined
  const gate = () => new Promise<void>((resolve) => (release = resolve))
  const grade = createGrader({
    getSession: () => session,
    setSession: (next) => {
      session = next
    },
    save: async (word) => {
      await gate()
      if (options.failSave) throw new Error('disk full')
      saved.push(word)
    },
    onBusy: (busy) => busyEvents.push(busy),
    onError: (e) => errors.push(e),
  })
  return { grade, saved, busyEvents, errors, release: () => release(), session: () => session }
}

describe('createGrader', () => {
  it('saves a grade once even when the key repeats in the same tick', async () => {
    const t = setup()
    const first = t.grade('good')
    const second = t.grade('good')
    t.release()
    await Promise.all([first, second])
    expect(t.saved).toEqual(['a'])
    expect(currentItem(t.session())?.word.name).toBe('b')
  })

  it('ignores a repeat that arrives after the save resolved but before React re-rendered', async () => {
    const t = setup()
    const first = t.grade('good')
    t.release()
    await first
    // the session already moved on to the next, unflipped card, so this repeat must be a no-op
    await t.grade('good')
    expect(t.saved).toEqual(['a'])
    expect(currentItem(t.session())?.word.name).toBe('b')
  })

  it('ignores a grade before the answer is shown', async () => {
    const t = setup()
    const unflipped = createSession([item('a')])
    const grade = createGrader({
      getSession: () => unflipped,
      setSession: () => undefined,
      save: async () => undefined,
      onBusy: () => undefined,
      onError: () => undefined,
    })
    await grade('good')
    expect(unflipped.reviewed).toBe(0)
    expect(t.saved).toEqual([])
  })

  it('reports busy while saving', async () => {
    const t = setup()
    const p = t.grade('easy')
    expect(t.busyEvents).toEqual([true])
    t.release()
    await p
    expect(t.busyEvents).toEqual([true, false])
  })

  it('puts the session back and reports the error when saving fails, then accepts a retry', async () => {
    const t = setup({ failSave: true })
    const before = t.session()
    const p = t.grade('good')
    t.release()
    await p
    expect(t.session()).toBe(before)
    expect(t.errors).toHaveLength(1)
    expect(t.busyEvents).toEqual([true, false])
    const retry = t.grade('good')
    t.release()
    await retry
    expect(t.errors).toHaveLength(2)
  })
})
