'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics'
import { captureAttribution } from '@/lib/attribution'

/**
 * Runs once per landing: stores the campaign attribution for the rest of the
 * visit and reports ViewContent.
 *
 * `once: true` matters — React Strict Mode mounts effects twice in
 * development, and without the guard every ViewContent would be double-counted
 * in the ad platforms.
 */
export function PageTracker({
  contentId,
  contentName,
  value,
  currency,
}: {
  contentId: string
  contentName: string
  value: number
  currency: string
}) {
  useEffect(() => {
    captureAttribution()
    trackEvent(
      'ViewContent',
      { contentIds: [contentId], contentName, value, currency, contentType: 'product' },
      { once: true },
    )
  }, [contentId, contentName, value, currency])

  return null
}
