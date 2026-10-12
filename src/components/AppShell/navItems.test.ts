import { MORE_LINKS, buildNavItems, isNavActive } from './navItems'
import { describe, expect, it } from 'vitest'

const byId = (id: string) => {
  const item = buildNavItems().find((i) => i.id === id)
  if (!item) throw new Error(id)
  return item
}

describe('buildNavItems', () => {
  it('lists the modes in order and marks five tabs for phones', () => {
    const items = buildNavItems()
    expect(items.map((i) => i.id)).toEqual(['home', 'typing', 'study', 'quiz', 'match', 'my-sets', 'library'])
    expect(items.filter((i) => i.tab).map((i) => i.id)).toEqual(['home', 'typing', 'study', 'quiz', 'match'])
  })
  it('points the mode links at the pages that use the current set', () => {
    expect(byId('study').to).toBe('/study')
    expect(byId('quiz').to).toBe('/quiz')
    expect(byId('match').to).toBe('/match')
  })
})

describe('isNavActive', () => {
  it('matches home only on the exact root path', () => {
    expect(isNavActive(byId('home'), '/')).toBe(true)
    expect(isNavActive(byId('home'), '/typing')).toBe(false)
  })
  it('matches mode links by prefix', () => {
    expect(isNavActive(byId('study'), '/study')).toBe(true)
    expect(isNavActive(byId('study'), '/study/custom%3A12')).toBe(true)
    expect(isNavActive(byId('quiz'), '/quiz/anything')).toBe(true)
    expect(isNavActive(byId('quiz'), '/quizzes')).toBe(false)
  })
  it('keeps My Sets active inside the set editor', () => {
    expect(isNavActive(byId('my-sets'), '/my-sets/3')).toBe(true)
  })
  it('does not activate anything on unrelated paths', () => {
    for (const item of buildNavItems()) expect(isNavActive(item, '/error-book')).toBe(false)
  })
})

describe('MORE_LINKS', () => {
  it('offers the pages that have no tab', () => {
    expect(MORE_LINKS.map((l) => l.to)).toEqual(['/my-sets', '/gallery', '/error-book', '/analysis'])
  })
})
