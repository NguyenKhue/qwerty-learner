import { MORE_LINKS, buildNavItems, isNavActive } from './navItems'
import { describe, expect, it } from 'vitest'

const byId = (dictId: string, id: string) => {
  const item = buildNavItems(dictId).find((i) => i.id === id)
  if (!item) throw new Error(id)
  return item
}

describe('buildNavItems', () => {
  it('lists the modes in order and marks five tabs for phones', () => {
    const items = buildNavItems('cet4')
    expect(items.map((i) => i.id)).toEqual(['home', 'typing', 'study', 'quiz', 'match', 'my-sets', 'library'])
    expect(items.filter((i) => i.tab).map((i) => i.id)).toEqual(['home', 'typing', 'study', 'quiz', 'match'])
  })
  it('points the mode links at the current set, URL-encoded', () => {
    expect(byId('cet4', 'study').to).toBe('/study/cet4')
    expect(byId('custom:12', 'quiz').to).toBe('/quiz/custom%3A12')
    expect(byId('custom:12', 'match').to).toBe('/match/custom%3A12')
  })
})

describe('isNavActive', () => {
  it('matches home only on the exact root path', () => {
    expect(isNavActive(byId('cet4', 'home'), '/')).toBe(true)
    expect(isNavActive(byId('cet4', 'home'), '/typing')).toBe(false)
  })
  it('matches mode links by prefix, including encoded ids', () => {
    expect(isNavActive(byId('custom:12', 'study'), '/study/custom%3A12')).toBe(true)
    expect(isNavActive(byId('cet4', 'quiz'), '/quiz/anything')).toBe(true)
    expect(isNavActive(byId('cet4', 'quiz'), '/quizzes')).toBe(false)
  })
  it('keeps My Sets active inside the set editor', () => {
    expect(isNavActive(byId('cet4', 'my-sets'), '/my-sets/3')).toBe(true)
  })
  it('does not activate anything on unrelated paths', () => {
    for (const item of buildNavItems('cet4')) expect(isNavActive(item, '/error-book')).toBe(false)
  })
})

describe('MORE_LINKS', () => {
  it('offers the pages that have no tab', () => {
    expect(MORE_LINKS.map((l) => l.to)).toEqual(['/my-sets', '/gallery', '/error-book', '/analysis'])
  })
})
