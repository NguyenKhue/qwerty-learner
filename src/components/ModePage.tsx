import { Button } from '@/components/ui/button'
import { cn } from '@/utils/ui'
import type { ReactNode } from 'react'

/** Fills the shell's content area so a page can center itself and scroll inside it. */
export function ModeFrame({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 w-full flex-col">{children}</div>
}

/** The card surface used by the study modes. */
export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-card p-6 text-card-foreground', className)}>{children}</div>
}

/** A centered column with the set name and a Back button, used by the start screens of the study modes. */
export function ModePage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    // `my-auto` on the inner column (not `justify-center`) keeps the top reachable when the content is taller than the screen
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6">
      <div className="mx-auto my-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="min-w-0 truncate text-2xl font-semibold text-foreground">{title}</h1>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** A short status line (loading, failure) centered in the space left by the shell. */
export function PageMessage({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return <p className={`m-auto px-4 text-center ${tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{text}</p>
}
