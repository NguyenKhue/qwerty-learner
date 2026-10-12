import { DAY_MS, HOUR_MS, MINUTE_MS, addLocalDays, startOfLocalDay } from './time'
import { describe, expect, it } from 'vitest'

describe('time helpers', () => {
  it('exposes the unit constants', () => {
    expect(MINUTE_MS).toBe(60000)
    expect(HOUR_MS).toBe(3600000)
    expect(DAY_MS).toBe(86400000)
  })

  it('startOfLocalDay returns local midnight', () => {
    const afternoon = new Date(2026, 9, 12, 15, 30, 45).getTime()
    expect(startOfLocalDay(afternoon)).toBe(new Date(2026, 9, 12).getTime())
    const lastSecond = new Date(2026, 9, 12, 23, 59, 59).getTime()
    expect(startOfLocalDay(lastSecond)).toBe(new Date(2026, 9, 12).getTime())
    const midnight = new Date(2026, 9, 12).getTime()
    expect(startOfLocalDay(midnight)).toBe(midnight)
  })

  it('addLocalDays moves by calendar days, across months', () => {
    const now = new Date(2026, 9, 12, 15, 30).getTime()
    expect(addLocalDays(now, 0)).toBe(new Date(2026, 9, 12).getTime())
    expect(addLocalDays(now, 3)).toBe(new Date(2026, 9, 15).getTime())
    const endOfMonth = new Date(2026, 9, 30, 8).getTime()
    expect(addLocalDays(endOfMonth, 3)).toBe(new Date(2026, 10, 2).getTime())
  })
})
