import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // h-14 keeps the field comfortably above the 44px touch minimum.
        'flex h-14 w-full rounded-lg border border-line bg-surface px-4 text-base text-ink',
        'transition-colors placeholder:text-ink-muted/70',
        'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-cta aria-[invalid=true]:ring-cta/20',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-28 w-full rounded-lg border border-line bg-surface px-4 py-3 text-base leading-relaxed text-ink',
      'transition-colors placeholder:text-ink-muted/70',
      'focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'aria-[invalid=true]:border-cta aria-[invalid=true]:ring-cta/20',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-base font-bold text-ink', className)}
      {...props}
    />
  ),
)
Label.displayName = 'Label'

export { Input, Textarea, Label }
