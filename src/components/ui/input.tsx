import { cn } from '@/utils/ui'
import * as React from 'react'

/** Shared look for every text control: fixed 44px height, hairline border, ring only on keyboard focus. */
const controlClass =
  'w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-1 transition-[border-color,box-shadow] duration-fast placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(controlClass, 'h-11', className)} {...props} />
))
Input.displayName = 'Input'

export interface FieldProps {
  label: React.ReactNode
  children: React.ReactNode
  /** Help text under the control; replaced by `error` when that is present */
  hint?: React.ReactNode
  error?: React.ReactNode
  htmlFor?: string
  className?: string
}

export function Field({ label, children, hint, error, htmlFor, className }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export { Input }
