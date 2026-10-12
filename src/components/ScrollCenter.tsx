import type { ReactNode } from 'react'

/**
 * Vertically centres its content inside the space left by the layout, and scrolls instead of overflowing when the content is taller
 * (long meanings). `my-auto` rather than `justify-center` keeps the top of tall content reachable.
 */
export default function ScrollCenter({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto px-6 py-4">
      <div className={`my-auto flex w-full flex-col items-center ${className}`}>{children}</div>
    </div>
  )
}
