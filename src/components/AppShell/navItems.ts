export type NavItem = {
  id: 'home' | 'typing' | 'study' | 'quiz' | 'match' | 'sentences' | 'dictation' | 'my-sets' | 'library'
  label: string
  to: string
  base: string
  icon: 'home' | 'keyboard' | 'cards' | 'quiz' | 'match' | 'sentences' | 'dictation' | 'sets' | 'library'
  tab: boolean
}

export const MORE_LINKS: Array<{ label: string; to: string }> = [
  { label: 'My Sets', to: '/my-sets' },
  { label: 'Library', to: '/gallery' },
  { label: 'Sentences', to: '/sentences' },
  { label: 'Dictation', to: '/dictation' },
  { label: 'Error book', to: '/error-book' },
  { label: 'Analysis', to: '/analysis' },
  { label: 'About & support', to: '/about' },
]

export function buildNavItems(): NavItem[] {
  return [
    { id: 'home', label: 'Home', to: '/', base: '/', icon: 'home', tab: true },
    { id: 'typing', label: 'Typing', to: '/typing', base: '/typing', icon: 'keyboard', tab: true },
    { id: 'study', label: 'Flashcards', to: '/study', base: '/study', icon: 'cards', tab: true },
    { id: 'quiz', label: 'Quiz', to: '/quiz', base: '/quiz', icon: 'quiz', tab: true },
    { id: 'match', label: 'Match', to: '/match', base: '/match', icon: 'match', tab: true },
    { id: 'sentences', label: 'Sentences', to: '/sentences', base: '/sentences', icon: 'sentences', tab: false },
    { id: 'dictation', label: 'Dictation', to: '/dictation', base: '/dictation', icon: 'dictation', tab: false },
    { id: 'my-sets', label: 'My Sets', to: '/my-sets', base: '/my-sets', icon: 'sets', tab: false },
    { id: 'library', label: 'Library', to: '/gallery', base: '/gallery', icon: 'library', tab: false },
  ]
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.base === '/') return pathname === '/'
  return pathname === item.base || pathname.indexOf(item.base + '/') === 0
}
