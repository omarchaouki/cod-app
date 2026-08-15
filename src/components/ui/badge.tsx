import * as React from 'react'
import { cn } from '@/lib/utils'
import type { LeadStatus, OrderStatus } from '@/lib/db/types'
import { LEAD_STATUS_LABELS, ORDER_STATUS_LABELS } from '@/lib/db/types'

export function Badge({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Status colours never carry meaning alone — the Arabic label is always
 * rendered next to the dot, so the state is readable without colour vision.
 */
const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  NEW: 'bg-stone-100 text-stone-700',
  CONFIRMED: 'bg-sky-50 text-sky-800',
  SHIPPED: 'bg-violet-50 text-violet-800',
  DELIVERED: 'bg-teal-50 text-teal-800',
  PAID: 'bg-green-100 text-green-900',
  CANCELLED: 'bg-red-50 text-red-800',
  RETURNED: 'bg-orange-50 text-orange-800',
  FAILED: 'bg-red-100 text-red-900',
}

const ORDER_STATUS_DOTS: Record<OrderStatus, string> = {
  NEW: 'bg-stone-500',
  CONFIRMED: 'bg-sky-600',
  SHIPPED: 'bg-violet-600',
  DELIVERED: 'bg-teal-600',
  PAID: 'bg-green-700',
  CANCELLED: 'bg-red-600',
  RETURNED: 'bg-orange-600',
  FAILED: 'bg-red-900',
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge className={ORDER_STATUS_CLASSES[status]}>
      <span className={cn('h-1.5 w-1.5 rounded-full', ORDER_STATUS_DOTS[status])} aria-hidden />
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  )
}

const LEAD_STATUS_CLASSES: Record<LeadStatus, string> = {
  NEW: 'bg-amber-50 text-amber-900',
  CONTACTED: 'bg-sky-50 text-sky-800',
  CONVERTED: 'bg-green-100 text-green-900',
  NOT_INTERESTED: 'bg-stone-100 text-stone-700',
  INVALID: 'bg-red-50 text-red-800',
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge className={LEAD_STATUS_CLASSES[status]}>{LEAD_STATUS_LABELS[status]}</Badge>
}
