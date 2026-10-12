import type React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full w-full flex-col items-center pb-4">{children}</div>
}
