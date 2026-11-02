import { cn } from '@/utils/ui'
import type { HTMLAttributes } from 'react'

/** A key of the keyboard, the same shape as the logo: how every shortcut in the app is shown. */
export function Keycap({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <kbd className={cn('keycap', className)} {...props} />
}
