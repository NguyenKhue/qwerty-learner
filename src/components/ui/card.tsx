import { cn } from '@/utils/ui'
import type { ElementType, HTMLAttributes, ReactNode } from 'react'

type CardElement = 'div' | 'section' | 'article'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lifts on hover instead of moving anything around it */
  interactive?: boolean
  as?: CardElement
}

/** The surface every panel-like block in the app sits on. Padding is part of the base, so callers override it with `className` (`p-0`, `p-8`, …). */
export function Card({ className, interactive = false, as = 'div', ...props }: CardProps) {
  const Comp = as as ElementType

  return (
    <Comp
      className={cn(
        'rounded-xl border border-border bg-card p-4 text-card-foreground shadow-1 sm:p-6',
        interactive &&
          'transition-[transform,box-shadow,border-color] duration-base ease-out focus-within:ring-2 focus-within:ring-ring hover:-translate-y-0.5 hover:shadow-2',
        className,
      )}
      {...props}
    />
  )
}

export function CardEyebrow({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-eyebrow', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-heading', className)} {...props} />
}

/** Row of small text under a card title, kept next to the title component so the pair cannot drift apart. */
export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('text-sm text-muted-foreground', className)}>{children}</div>
}
