import Footer from './Footer'
import type React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center pb-4">
      {children}
      {/* Hidden on phones until the footer moves into the shell menu (R4): it overflows a narrow screen */}
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  )
}
