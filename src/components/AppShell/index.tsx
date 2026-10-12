import { MORE_LINKS, buildNavItems, isNavActive } from './navItems'
import type { NavItem } from './navItems'
import logo from '@/assets/logo.svg'
import Loading from '@/components/Loading'
import { currentDictInfoAtom, isOpenDarkModeAtom } from '@/store'
import { useAtom, useAtomValue } from 'jotai'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import IconBooks from '~icons/tabler/books'
import IconCards from '~icons/tabler/cards'
import IconDots from '~icons/tabler/dots'
import IconFolders from '~icons/tabler/folders'
import IconHome from '~icons/tabler/home'
import IconKeyboard from '~icons/tabler/keyboard'
import IconListCheck from '~icons/tabler/list-check'
import IconMoon from '~icons/tabler/moon'
import IconPuzzle from '~icons/tabler/puzzle'
import IconSun from '~icons/tabler/sun'

const ICONS: Record<NavItem['icon'], typeof IconHome> = {
  home: IconHome,
  keyboard: IconKeyboard,
  cards: IconCards,
  quiz: IconListCheck,
  match: IconPuzzle,
  sets: IconFolders,
  library: IconBooks,
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const activeStyle = 'bg-primary/10 text-primary'
const idleStyle = 'text-muted-foreground hover:bg-muted hover:text-foreground'

function ThemeToggle({ className = '', showLabel }: { className?: string; showLabel: boolean }) {
  const [dark, setDark] = useAtom(isOpenDarkModeAtom)
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  const Icon = dark ? IconSun : IconMoon
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => setDark(!dark)}
      className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200 ${idleStyle} ${focusRing} ${className}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className={showLabel ? 'sr-only lg:not-sr-only' : 'sr-only'}>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}

function SidebarLink({ item, pathname, compact }: { item: NavItem; pathname: string; compact: boolean }) {
  const active = isNavActive(item, pathname)
  const Icon = ICONS[item.icon]
  return (
    <Link
      to={item.to}
      title={item.label}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-200 ${
        active ? activeStyle : idleStyle
      } ${focusRing}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className={compact ? 'sr-only' : 'sr-only lg:not-sr-only'}>{item.label}</span>
    </Link>
  )
}

function TabLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isNavActive(item, pathname)
  const Icon = ICONS[item.icon]
  return (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-200 ${
        active ? 'text-primary' : 'text-muted-foreground'
      } ${focusRing}`}
    >
      <Icon className="h-6 w-6" aria-hidden />
      {item.label}
    </Link>
  )
}

function Sidebar({ items, pathname, compact }: { items: NavItem[]; pathname: string; compact: boolean }) {
  const dict = useAtomValue(currentDictInfoAtom)
  return (
    <aside
      className={`hidden shrink-0 flex-col gap-4 border-r border-border bg-card p-3 md:flex ${compact ? 'w-[72px]' : 'w-[72px] lg:w-60'}`}
    >
      <Link to="/" title="Home" className={`flex items-center gap-3 rounded-lg px-1 py-2 ${focusRing}`}>
        <img src={logo} className="h-10 w-10 shrink-0" alt="" />
        <span className={`text-lg font-bold text-primary ${compact ? 'sr-only' : 'sr-only lg:not-sr-only'}`}>Qwerty Learner</span>
      </Link>

      <Link
        to="/gallery"
        title={`Current set: ${dict.name}`}
        aria-label={`Change set. Current set: ${dict.name}`}
        className={`flex min-h-[44px] items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 transition-colors duration-200 hover:bg-muted ${focusRing}`}
      >
        <IconBooks className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className={`min-w-0 flex-1 ${compact ? 'hidden' : 'hidden lg:block'}`}>
          <span className="block truncate text-sm font-medium text-foreground">{dict.name}</span>
          <span className="block text-xs text-muted-foreground">{dict.length} words · change</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        {items.map((item) => (
          <SidebarLink key={item.id} item={item} pathname={pathname} compact={compact} />
        ))}
      </nav>

      <ThemeToggle showLabel={!compact} />
    </aside>
  )
}

function TabBar({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!moreOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <>
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMoreOpen(false)} aria-hidden />
          <div
            role="dialog"
            aria-label="More"
            className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 rounded-t-2xl border border-border bg-card p-2 shadow-lg md:hidden"
          >
            {MORE_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium text-foreground hover:bg-muted ${focusRing}`}
              >
                {link.label}
              </Link>
            ))}
            <ThemeToggle showLabel className="w-full" />
          </div>
        </>
      )}
      <nav aria-label="Main" className="relative z-40 flex border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {items
          .filter((item) => item.tab)
          .map((item) => (
            <TabLink key={item.id} item={item} pathname={pathname} />
          ))}
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground ${focusRing}`}
        >
          <IconDots className="h-6 w-6" aria-hidden />
          More
        </button>
      </nav>
    </>
  )
}

export default function AppShell() {
  const { pathname } = useLocation()
  const dict = useAtomValue(currentDictInfoAtom)
  const items = useMemo(() => buildNavItems(dict.id), [dict.id])
  // Typing keeps the narrow sidebar so the practice area gets the room
  const compact = pathname === '/typing' || pathname.indexOf('/typing/') === 0

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground">
      <Sidebar items={items} pathname={pathname} compact={compact} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </main>
        <TabBar items={items} pathname={pathname} />
      </div>
    </div>
  )
}
