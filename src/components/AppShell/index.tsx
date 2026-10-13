import { MORE_LINKS, buildNavItems, isNavActive } from './navItems'
import type { NavItem } from './navItems'
import logo from '@/assets/logo.svg'
import { InlineLoading } from '@/components/Loading'
import { currentDictInfoAtom, isOpenDarkModeAtom } from '@/store'
import { nextFocusIndex } from '@/utils/focusTrap'
import { useAtom, useAtomValue } from 'jotai'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import IconBooks from '~icons/tabler/books'
import IconCards from '~icons/tabler/cards'
import IconChevronDown from '~icons/tabler/chevron-down'
import IconDots from '~icons/tabler/dots'
import IconFolders from '~icons/tabler/folders'
import IconHome from '~icons/tabler/home'
import IconInfoCircle from '~icons/tabler/info-circle'
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
const navRow = 'relative flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-fast'
const navIcon = 'h-5 w-5 shrink-0'

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
      className={`${navRow} min-h-[44px] w-full ${idleStyle} ${focusRing} ${className}`}
    >
      <Icon className={navIcon} aria-hidden />
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
      className={`${navRow} min-h-[40px] ${active ? activeStyle : idleStyle} ${focusRing}`}
    >
      {active ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" /> : null}
      <Icon className={navIcon} aria-hidden />
      <span className={`truncate ${compact ? 'sr-only' : 'sr-only lg:not-sr-only'}`}>{item.label}</span>
    </Link>
  )
}

function TabLink({ item, pathname, onTap }: { item: NavItem; pathname: string; onTap: () => void }) {
  const active = isNavActive(item, pathname)
  const Icon = ICONS[item.icon]
  return (
    <Link
      to={item.to}
      onClick={onTap}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-[color,transform] duration-base active:scale-95 ${
        active ? 'text-primary' : 'text-muted-foreground'
      } ${focusRing}`}
    >
      <span
        aria-hidden
        className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-base ${
          active ? 'bg-primary/10' : ''
        }`}
      >
        <Icon className="h-6 w-6" />
      </span>
      {item.label}
    </Link>
  )
}

function Sidebar({ items, pathname, compact }: { items: NavItem[]; pathname: string; compact: boolean }) {
  const dict = useAtomValue(currentDictInfoAtom)
  const label = compact ? 'sr-only' : 'sr-only lg:not-sr-only'
  return (
    <aside
      className={`hidden shrink-0 flex-col gap-6 border-r border-border bg-card p-3 md:flex ${compact ? 'w-[72px]' : 'w-[72px] lg:w-60'}`}
    >
      <Link to="/" title="Home" className={`flex h-14 items-center gap-2.5 rounded-lg px-2 ${focusRing}`}>
        <img src={logo} className="h-8 w-8 shrink-0" alt="" />
        <span className={`text-sm font-semibold tracking-tight text-foreground ${label}`}>Qwerty Learner</span>
      </Link>

      <Link
        to="/gallery"
        title={`Current set: ${dict.name}`}
        aria-label={`Change set. Current set: ${dict.name}`}
        className={`flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-1 transition-shadow duration-base hover:shadow-2 ${focusRing}`}
      >
        <IconBooks className={navIcon} aria-hidden />
        <span className={`min-w-0 flex-1 ${compact ? 'hidden' : 'hidden lg:block'}`}>
          <span className="block truncate text-sm font-semibold text-foreground">{dict.name}</span>
          <span className="block text-xs text-muted-foreground">{dict.length} words · change</span>
        </span>
        <IconChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground ${compact ? 'hidden' : 'hidden lg:block'}`} aria-hidden />
      </Link>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-0.5">
          {items
            .filter((item) => item.tab)
            .map((item) => (
              <SidebarLink key={item.id} item={item} pathname={pathname} compact={compact} />
            ))}
        </div>
        <div className="flex flex-col gap-0.5">
          {items
            .filter((item) => !item.tab)
            .map((item) => (
              <SidebarLink key={item.id} item={item} pathname={pathname} compact={compact} />
            ))}
        </div>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border pt-4">
        <Link
          to="/about"
          title="About & support"
          aria-current={pathname === '/about' ? 'page' : undefined}
          className={`${navRow} min-h-[40px] ${pathname === '/about' ? activeStyle : idleStyle} ${focusRing}`}
        >
          {pathname === '/about' ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" /> : null}
          <IconInfoCircle className={navIcon} aria-hidden />
          <span className={`truncate ${label}`}>About &amp; support</span>
        </Link>
        <ThemeToggle showLabel={!compact} />
      </div>
    </aside>
  )
}

function TabBar({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const sheetRef = useRef<HTMLDivElement>(null)
  const moreButtonRef = useRef<HTMLButtonElement>(null)

  // Dialog behavior: focus moves into the sheet, Tab cycles inside it, Escape closes it and gives focus back to the More button
  useEffect(() => {
    if (!moreOpen) return
    const focusables = () =>
      Array.prototype.slice.call(sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []) as HTMLElement[]
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false)
        moreButtonRef.current?.focus()
      } else if (e.key === 'Tab') {
        const list = focusables()
        const next = nextFocusIndex(list.indexOf(document.activeElement as HTMLElement), list.length, e.shiftKey)
        if (next >= 0) {
          e.preventDefault()
          list[next].focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [moreOpen])

  return (
    <>
      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => {
              setMoreOpen(false)
              moreButtonRef.current?.focus()
            }}
            aria-hidden
          />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
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
      <nav
        aria-label="Main"
        className="relative z-40 flex border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {items
          .filter((item) => item.tab)
          .map((item) => (
            <TabLink key={item.id} item={item} pathname={pathname} onTap={() => setMoreOpen(false)} />
          ))}
        <button
          ref={moreButtonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-[color,transform] duration-base active:scale-95 ${focusRing}`}
        >
          <span aria-hidden className="flex h-8 w-14 items-center justify-center rounded-full">
            <IconDots className="h-6 w-6" />
          </span>
          More
        </button>
      </nav>
    </>
  )
}

export default function AppShell() {
  const { pathname } = useLocation()
  const items = useMemo(() => buildNavItems(), [])
  // Typing keeps the narrow sidebar so the practice area gets the room
  const compact = pathname === '/typing' || pathname.indexOf('/typing/') === 0

  return (
    <div className="app-shell flex w-full bg-background text-foreground">
      <Sidebar items={items} pathname={pathname} compact={compact} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <div key={pathname} className="page-enter h-full">
            <Suspense fallback={<InlineLoading />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <TabBar items={items} pathname={pathname} />
      </div>
    </div>
  )
}
