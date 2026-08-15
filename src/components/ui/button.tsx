import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-bold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 touch-manipulation',
  {
    variants: {
      variant: {
        // The one conversion colour. Used for order actions and nothing else.
        cta: 'bg-cta text-white hover:bg-cta-hover shadow-lift active:translate-y-px',
        brand: 'bg-brand text-white hover:bg-brand-ink',
        outline: 'border border-line bg-surface text-ink hover:bg-paper-deep',
        ghost: 'text-ink-soft hover:bg-paper-deep hover:text-ink',
        danger: 'bg-cta text-white hover:bg-cta-hover',
        subtle: 'bg-paper-deep text-ink hover:bg-line-soft',
      },
      size: {
        // Every size clears the 44px minimum touch target.
        sm: 'h-11 px-3.5 text-sm',
        md: 'h-12 px-5 text-base',
        lg: 'h-14 px-6 text-lg',
        xl: 'h-16 px-8 text-xl',
        icon: 'h-11 w-11',
      },
    },
    defaultVariants: { variant: 'brand', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
