import { Pixels } from '@/components/tracking/pixels'

/**
 * Public site layout. The pixels live here and not in the root layout so the
 * admin panel never loads a single byte of third-party tracking.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Pixels />
    </>
  )
}
