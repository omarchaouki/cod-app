import Image from 'next/image'
import {
  Award,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Layers,
  ListChecks,
  Ruler,
  Users,
} from 'lucide-react'

/* ========================================================================== *
 * Section shell
 * ========================================================================== */

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string
  title: string
  lead?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <p className="text-sm font-bold uppercase tracking-wide text-amber">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-2xl font-black text-ink sm:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 text-base leading-relaxed text-ink-soft">{lead}</p> : null}
    </div>
  )
}

/* ========================================================================== *
 * The problem this solves
 * ========================================================================== */

const FRICTIONS = [
  'جداول التتبع تُنسخ يدوياً في بداية كل دورة',
  'وثائق متفرقة بين الكرّاس والأوراق والهاتف',
  'شبكات التنقيط الرسمية يُبحث عنها كل مرة',
  'زيارة المفتش تعني ليلة كاملة من الترتيب',
]

export function ProblemSection() {
  return (
    <section className="paper-grain border-y border-line py-14 md:py-20">
      <div className="content-width">
        <SectionHeading
          eyebrow="لماذا هذا الباك"
          title="أستاذ التربية البدنية يضيع وقته في الورق، لا في الملعب"
          lead="12 قسماً، ثلاثة مستويات، ست دورات في السنة. بدون وثيقة منظمة، يتحول التتبع البيداغوجي إلى عبء يومي."
        />

        <ul className="mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-2">
          {FRICTIONS.map((item) => (
            <li
              key={item}
              className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4"
            >
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cta"
                aria-hidden
              />
              <span className="text-base leading-relaxed text-ink-soft">{item}</span>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-8 max-w-2xl rounded-lg border-s-4 border-brand bg-surface p-5 text-center text-lg font-bold leading-relaxed text-ink">
          الباك يحل هذا كله: كل جدول تحتاجه مطبوع مسبقاً، وكل شبكة رسمية في مكانها.
        </p>
      </div>
    </section>
  )
}

/* ========================================================================== *
 * What is inside the two books — the real table of contents
 * ========================================================================== */

const CAHIER_TEXTES = [
  'بطاقة الأستاذ والمؤسسة وتأشيرة رئيس المؤسسة',
  'رزنامة الموسم الدراسي 2026-2027 والعطل والأعياد الرسمية',
  'الاستعمال الزمني الأسبوعي',
  'البرنامج الوطني: المذكرات والكفايات حسب المستوى',
  'الأهداف النهائية للإدماج لكل مستوى',
  'يوميات الحصص: 12 قسماً × 6 دورات × 12 حصة',
  'خانات تأشيرة رئيس المؤسسة والمفتش التربوي',
]

const CAHIER_JOURNALIER = [
  'بطاقة هوية الأستاذ والخدمة الأسبوعية',
  'المؤسسة والتأطير ومكتب الجمعية الرياضية المدرسية',
  'التخطيط السنوي للدورات الست حسب المستويات الثلاثة',
  'العتاد الديداكتيكي والمنشآت الرياضية',
  'رموز الاختصارات: المواظبة والسلوك والتقويم',
  'لائحة التلاميذ المعفين وشهاداتهم الطبية',
  'التنظيم البشري للأقسام: الأندية والقادة والمسؤولون',
  'شبكات المراقبة والمواظبة والتقويم لكل قسم',
  'شبكات التقويم الرسمية للإعدادي والتأهيلي',
  'شبكات تنقيط الجمباز للسلكين',
]

export function InsideSection() {
  return (
    <section id="inside" className="py-14 md:py-20">
      <div className="content-width">
        <SectionHeading
          eyebrow="محتوى الباك"
          title="دفتران يكملان بعضهما"
          lead="الأول لتوثيق ما أنجزته، والثاني لتنظيم قسمك وتنقيط تلاميذك. معاً يغطيان الموسم الدراسي كاملاً."
        />

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <BookCard
            icon={<BookOpen className="h-5 w-5" aria-hidden />}
            title="دفتر النصوص"
            subtitle="Cahier de textes"
            description="الوثيقة التي يطّلع عليها رئيس المؤسسة والمفتش: ما أُنجز، متى، ولأي مستوى."
            items={CAHIER_TEXTES}
          />
          <BookCard
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
            title="الدفتر اليومي"
            subtitle="Cahier journalier"
            description="أداة عملك اليومية: تنظيم الأقسام، تتبع الحصص، وتنقيط التلاميذ بالشبكات الرسمية."
            items={CAHIER_JOURNALIER}
          />
        </div>
      </div>
    </section>
  )
}

function BookCard({
  icon,
  title,
  subtitle,
  description,
  items,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  description: string
  items: string[]
}) {
  return (
    <article className="flex flex-col rounded-card border border-line bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand">
          {icon}
        </span>
        <div>
          <h3 className="text-xl font-black text-ink">{title}</h3>
          <p className="text-sm text-ink-muted" dir="ltr">
            {subtitle}
          </p>
        </div>
      </div>

      <p className="mt-4 text-base leading-relaxed text-ink-soft">{description}</p>

      <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-[0.95rem] leading-relaxed">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
            <span className="text-ink-soft">{item}</span>
          </li>
        ))}
      </ul>
    </article>
  )
}

/* ========================================================================== *
 * Benefits
 * ========================================================================== */

const BENEFITS = [
  {
    icon: FileSpreadsheet,
    title: 'لا نسخ يدوي بعد اليوم',
    body: 'كل الجداول والشبكات مطبوعة مسبقاً. تملأ الفراغات فقط وتنتقل إلى الحصة.',
  },
  {
    icon: Award,
    title: 'مطابق للتوجيهات الرسمية',
    body: 'شبكات التقويم مبنية على التوجيهات التربوية 2009 للإعدادي و2007 للتأهيلي.',
  },
  {
    icon: Layers,
    title: 'يغطي السلكين معاً',
    body: 'نفس الباك يخدم الإعدادي والتأهيلي: ثلاثة مستويات و12 قسماً.',
  },
  {
    icon: CalendarDays,
    title: 'مضبوط على موسم 2026-2027',
    body: 'الرزنامة والعطل والفترات البينية مدرجة، فالتخطيط السنوي جاهز من البداية.',
  },
  {
    icon: Users,
    title: 'تنظيم بشري للأقسام',
    body: 'أندية وقادة ومسؤولو العتاد والمستودع لكل قسم — ضبط القسم يبدأ من هنا.',
  },
  {
    icon: Ruler,
    title: 'جاهز للمراقبة التربوية',
    body: 'خانات تأشيرة رئيس المؤسسة والمفتش في مكانها، ووثائقك مرتبة عند أي زيارة.',
  },
]

export function BenefitsSection() {
  return (
    <section className="paper-grain border-y border-line py-14 md:py-20">
      <div className="content-width">
        <SectionHeading eyebrow="الفائدة" title="ماذا يتغير في عملك اليومي" />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-card border border-line bg-surface p-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-soft text-amber">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== *
 * Gallery — everything below the fold is lazy-loaded
 * ========================================================================== */

const GALLERY = [
  {
    src: '/images/enseignant-classe.webp',
    alt: 'أستاذ التربية البدنية يملأ الدفتر اليومي مع تلاميذه في ساحة المؤسسة',
    caption: 'تتبع الحصة وتسجيل الملاحظات في مكانها',
    width: 1200,
    height: 655,
  },
  {
    src: '/images/seance-basket.webp',
    alt: 'أستاذ يحمل الدفتر خلال حصة كرة السلة في ساحة المؤسسة',
    caption: 'الدفتر معك في الميدان، لا في المكتب',
    width: 1200,
    height: 655,
  },
  {
    src: '/images/seance-football.webp',
    alt: 'أستاذ يدون التقويم أثناء حصة كرة القدم مع تلاميذ السلك الإعدادي',
    caption: 'تنقيط مباشر أثناء التقويم الإجمالي',
    width: 1200,
    height: 670,
  },
]

export function GallerySection() {
  return (
    <section className="py-14 md:py-20">
      <div className="content-width">
        <SectionHeading eyebrow="في الميدان" title="مصمم للاستعمال أثناء الحصة" />

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY.map((image) => (
            <figure
              key={image.src}
              className="overflow-hidden rounded-card border border-line bg-surface shadow-card"
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                /* Below the fold: never block the initial paint. */
                loading="lazy"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="h-52 w-full object-cover"
              />
              <figcaption className="border-t border-line px-4 py-3 text-sm text-ink-soft">
                {image.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== *
 * Specifications — verifiable facts, no invented social proof
 * ========================================================================== */

const SPECS: Array<[string, string]> = [
  ['المستوى', 'السلك الإعدادي والسلك التأهيلي'],
  ['المادة', 'التربية البدنية والرياضية'],
  ['الموسم', '2026 — 2027'],
  ['عدد الأقسام المغطاة', '12 قسماً'],
  ['عدد الدورات', '6 دورات × 12 حصة'],
  ['المرجع البيداغوجي', 'التوجيهات التربوية 2009 و2007'],
  ['اللغة', 'عربية وفرنسية'],
  ['المحتوى', 'دفتر النصوص + الدفتر اليومي'],
]

export function SpecsSection() {
  return (
    <section className="paper-grain border-y border-line py-14 md:py-20">
      <div className="content-width">
        <SectionHeading eyebrow="المواصفات" title="تفاصيل الباك" />

        <div className="mx-auto mt-9 max-w-2xl overflow-hidden rounded-card border border-line bg-surface">
          <dl>
            {SPECS.map(([label, value], index) => (
              <div
                key={label}
                className={`flex items-center justify-between gap-4 px-5 py-3.5 ${
                  index !== 0 ? 'border-t border-line-soft' : ''
                }`}
              >
                <dt className="text-[0.95rem] text-ink-muted">{label}</dt>
                <dd className="text-end text-[0.95rem] font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== *
 * FAQ — real questions, answered honestly
 * ========================================================================== */

export const FAQ_ITEMS = [
  {
    q: 'كيف أدفع؟',
    a: 'الدفع عند الاستلام. لا تدفع أي مبلغ عبر الإنترنت: تسلّم المبلغ لعامل التوصيل عند وصول الطلب إليك.',
  },
  {
    q: 'هل الباك صالح للإعدادي والتأهيلي معاً؟',
    a: 'نعم. الدفتران مصممان للسلكين معاً، ويتضمنان شبكات التقويم الخاصة بكل سلك: التوجيهات التربوية 2009 للإعدادي و2007 للتأهيلي.',
  },
  {
    q: 'كم قسماً يغطي الباك؟',
    a: 'يغطي 12 قسماً موزعة على ثلاثة مستويات، مع ست دورات في السنة وكل دورة من 12 حصة.',
  },
  {
    q: 'ماذا يحدث بعد إرسال الطلب؟',
    a: 'يصلك اتصال هاتفي من فريقنا لتأكيد الطلب والعنوان، ثم يُرسل الطلب إليك. يُرجى إبقاء هاتفك متاحاً.',
  },
  {
    q: 'هل التوصيل متاح خارج المدن الكبرى؟',
    a: 'نوصّل إلى جميع المدن المغربية. إن كان عنوانك في منطقة نائية، سيتم الاتفاق معك هاتفياً على أقرب نقطة استلام.',
  },
  {
    q: 'هل يمكنني طلب أكثر من باك لزملائي في نفس المؤسسة؟',
    a: 'نعم. أرسل الطلب بالمعلومات المطلوبة واذكر ذلك أثناء المكالمة الهاتفية، وسيتم ضبط الكمية معك.',
  },
]

export function FaqSection() {
  return (
    <section id="faq" className="py-14 md:py-20">
      <div className="content-width">
        <SectionHeading eyebrow="أسئلة متكررة" title="ما قد تريد معرفته قبل الطلب" />

        <div className="mx-auto mt-9 max-w-2xl divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {FAQ_ITEMS.map((item) => (
            /* <details> gives an accessible accordion with zero JavaScript. */
            <details key={item.q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-bold text-ink transition-colors hover:bg-paper-deep">
                {item.q}
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 1v10M1 6h10" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pb-4 text-[0.95rem] leading-relaxed text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========================================================================== *
 * Final CTA + footer
 * ========================================================================== */

export function FinalCta({ priceLabel }: { priceLabel: string }) {
  return (
    <section className="border-y border-brand-ink bg-brand py-14 text-white md:py-16">
      <div className="content-width text-center">
        <h2 className="text-2xl font-black sm:text-3xl">ابدأ الموسم بوثائق جاهزة</h2>
        <p className="mx-auto mt-3 max-w-xl text-base leading-relaxed text-white/85">
          اطلب الباك اليوم وادفع عند الاستلام. لن تحتاج إلى نسخ أي جدول هذه السنة.
        </p>

        <a
          href="#order"
          className="mt-7 inline-flex h-14 items-center justify-center rounded-lg bg-white px-8 text-lg font-bold text-brand-ink transition-colors hover:bg-paper-deep"
        >
          اطلب الآن — <span className="num">{priceLabel}</span>
        </a>
      </div>
    </section>
  )
}

export function SiteFooter({ storeName, storePhone }: { storeName: string; storePhone: string | null }) {
  return (
    <footer className="bg-paper py-10">
      <div className="content-width">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-start">
          <div>
            <p className="text-base font-black text-ink">{storeName}</p>
            <p className="mt-1 text-sm text-ink-muted">
              دفتر النصوص والدفتر اليومي للتربية البدنية والرياضية
            </p>
          </div>

          {storePhone ? (
            <a
              href={`tel:${storePhone}`}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-ink"
              dir="ltr"
            >
              <ListChecks className="h-4 w-4 text-brand" aria-hidden />
              {storePhone}
            </a>
          ) : null}
        </div>

        <p className="mt-6 border-t border-line pt-5 text-center text-sm text-ink-muted">
          © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  )
}
