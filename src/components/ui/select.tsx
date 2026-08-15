import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * A native <select>. Deliberately not a Radix listbox: on mobile the OS picker
 * is faster, works with the keyboard and screen reader for free, and ships no
 * extra JavaScript — which matters on a page whose whole job is conversion.
 */
export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-11 w-full cursor-pointer appearance-none rounded-lg border border-line bg-surface',
        // Chevron drawn as a background image so it stays on the correct side
        // in RTL without an absolutely positioned icon.
        'bg-[length:1rem] bg-no-repeat ps-3 pe-9 text-sm font-medium text-ink',
        'bg-[position:left_0.75rem_center]',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%2378716c' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
