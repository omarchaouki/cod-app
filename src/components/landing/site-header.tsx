import { Truck } from 'lucide-react'

export function AnnouncementBar({ isFreeShipping }: { isFreeShipping: boolean }) {
  return (
    <div className="bg-brand text-white">
      <p className="content-width flex items-center justify-center gap-2 py-2 text-center text-sm font-bold">
        <Truck className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          {isFreeShipping ? 'التوصيل مجاني لجميع المدن المغربية' : 'التوصيل لجميع المدن المغربية'}
          {' · '}
          الدفع عند الاستلام
        </span>
      </p>
    </div>
  )
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="content-width flex h-16 items-center justify-between gap-4">
        {/* -my-2 py-2 grows the tap target past 44px without changing the
            header's visual height. */}
        <a href="#top" className="-my-2 flex items-center gap-2.5 py-2">
          <BookMark className="h-8 w-8" />
          <span className="text-base font-black leading-tight text-ink sm:text-lg">
            دفاتر التربية البدنية
          </span>
        </a>

        <a
          href="#order"
          className="inline-flex h-11 items-center rounded-lg bg-cta px-4 text-sm font-bold text-white transition-colors hover:bg-cta-hover sm:px-5 sm:text-base"
        >
          اطلب الآن
        </a>
      </div>
    </header>
  )
}

/** A small mark drawn from the notebook itself: a cover with its ribbon. */
function BookMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden focusable="false">
      <rect x="4" y="3" width="24" height="26" rx="2.5" fill="#f4ece0" stroke="#14532d" strokeWidth="1.75" />
      <path d="M20 3v11l-3-2.4L14 14V3z" fill="#14532d" />
      <path d="M9 21h10M9 25h7" stroke="#78716c" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
