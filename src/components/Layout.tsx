import type React from 'react'

export default function Layout({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex h-full w-full flex-col items-center pb-4 ${className}`}>{children}</div>
}
