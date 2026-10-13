import { cn } from '@/utils/ui'
import * as React from 'react'
import IconChevronDown from '~icons/tabler/chevron-down'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  className?: string
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  // The native control is unstyled except for the box, so the chevron lives in a wrapper that cannot shift it
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn(
        'h-11 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-10 text-sm text-foreground shadow-1 transition-[border-color,box-shadow] duration-fast placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <IconChevronDown
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
    />
  </div>
))
Select.displayName = 'Select'

export { Select }
