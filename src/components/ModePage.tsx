import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/utils/ui'
import type { ReactNode } from 'react'

/** Fills the shell's content area so a page can center itself and scroll inside it. */
export function ModeFrame({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 w-full flex-col">{children}</div>
}

/** A caller's own padding is meant to hold at every breakpoint, but Card pads `p-4 sm:p-6`, and twMerge
 *  only cancels the unpadded half of that pair. Repeat the caller's padding at `sm` so `p-0` really is flush. */
function callerPadding(className: string) {
  const match = className.match(/(?:^|\s)((?:[a-z]+:)?p-[\w./[\]]+)/)
  return match ? cn(match[1], `sm:${match[1].replace(/^[a-z]+:/, '')}`) : ''
}

/** The card surface used by the study modes. A caller's `className` wins over the card's own padding. */
export function Panel({ className = '', children }: { className?: string; children: ReactNode }) {
  // `text-muted-foreground` still wins over the card's `text-card-foreground`; only padding is pinned here
  return <Card className={cn('text-card-foreground', callerPadding(className), className)}>{children}</Card>
}

/** A centered column with the set name and a Back button, used by the start screens of the study modes. */
export function ModePage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    // `my-auto` on the inner column (not `justify-center`) keeps the top reachable when the content is taller than the screen
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6">
      <div className="mx-auto my-auto flex w-full max-w-xl animate-enter-up flex-col gap-6">
        <PageHeader
          title={title}
          actions={
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          }
        />
        {children}
      </div>
    </div>
  )
}

/** A short status line (loading, failure) centered in the space left by the shell. */
export function PageMessage({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'error' }) {
  return <p className={`m-auto px-4 text-center ${tone === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{text}</p>
}
