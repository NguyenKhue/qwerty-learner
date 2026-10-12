import type { PropsWithChildren } from 'react'
import type React from 'react'

/** The toolbar of the typing page. The logo and navigation live in the app shell. */
const Header: React.FC<PropsWithChildren> = ({ children }) => {
  return (
    <header className="z-20 flex w-full justify-center px-4 py-4 md:py-6">
      <h1 className="sr-only">Typing practice</h1>
      <nav
        aria-label="Typing controls"
        className="flex w-auto max-w-full flex-wrap content-center items-center justify-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card p-4"
      >
        {children}
      </nav>
    </header>
  )
}

export default Header
