export type NavItem = {
  id: 'home' | 'typing' | 'study' | 'quiz' | 'match' | 'my-sets' | 'library'
  label: string
  to: string
  base: string
  icon: 'home' | 'keyboard' | 'cards' | 'quiz' | 'match' | 'sets' | 'library'
  tab: boolean
}

export const MORE_LINKS: Array<{ label: string; to: string }> = [
  { label: 'My Sets', to: '/my-sets' },
  { label: 'Library', to: '/gallery' },
  { label: 'Error book', to: '/error-book' },
  { label: 'Analysis', to: '/analysis' },
]

export function buildNavItems(dictId: string): NavItem[] {
  const id = encodeURIComponent(dictId)
  return [
    { id: 'home', label: 'Home', to: '/', base: '/', icon: 'home', tab: true },
    { id: 'typing', label: 'Typing', to: '/typing', base: '/typing', icon: 'keyboard', tab: true },
    { id: 'study', label: 'Flashcards', to: `/study/${id}`, base: '/study', icon: 'cards', tab: true },
    { id: 'quiz', label: 'Quiz', to: `/quiz/${id}`, base: '/quiz', icon: 'quiz', tab: true },
    { id: 'match', label: 'Match', to: `/match/${id}`, base: '/match', icon: 'match', tab: true },
    { id: 'my-sets', label: 'My Sets', to: '/my-sets', base: '/my-sets', icon: 'sets', tab: false },
    { id: 'library', label: 'Library', to: '/gallery', base: '/gallery', icon: 'library', tab: false },
  ]
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.base === '/') return pathname === '/'
  return pathname === item.base || pathname.indexOf(item.base + '/') === 0
}
