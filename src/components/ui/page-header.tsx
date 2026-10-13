import { cn } from '@/utils/ui'
import type { ReactNode } from 'react'

export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Buttons or a menu; sits beside the title on wide screens, under it on phones */
  actions?: ReactNode
  /** Rendered above the title, typically a back link or breadcrumb */
  back?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, back, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-1', className)}>
      {back ? <div className="shrink-0">{back}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-title min-w-0 break-words text-foreground">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
