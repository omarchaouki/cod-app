# دفاتر التربية البدنية — COD store

Arabic RTL cash-on-delivery landing page for the EPS teacher notebooks pack
(دفتر النصوص + الدفتر اليومي, 2026–2027), with an admin panel for orders,
abandoned checkouts, marketing attribution and profitability.

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase · Zod · Recharts

---

## 1. Setup

```bash
npm install
```

Copy the environment template and fill in your own values:

```bash
cp .env.example .env.local
```

The only variables required to run are the three Supabase ones. Every tracking
variable is optional — leaving a pixel id empty means that script is never
injected and the landing page ships no third-party JavaScript at all.

## 2. Database

Run the two migrations in the Supabase SQL editor, in order:

1. `supabase/migrations/0001_init.sql` — tables, enums, indexes, RLS, reporting functions
2. `supabase/migrations/0002_seed.sql` — the product row and starting settings

## 3. Create your admin user

Create a user in **Supabase → Authentication → Users**, then add them to the
admin allow-list. Nothing in `/admin` is reachable without this row:

```sql
insert into admin_users (id, email)
select id, email from auth.users where email = 'you@example.com';
```

While you are there, turn **off** public sign-ups in
Authentication → Providers → Email, so nobody can create an account.

## 4. Run

```bash
npm run dev
```

- Landing page: http://localhost:3000
- Admin: http://localhost:3000/admin

---

## How the money works

Three rules hold the financial side together.

**Only PAID orders are revenue.** Submitted, confirmed, shipped and even
delivered orders are excluded from every revenue figure. With cash on delivery
the money exists only once it has been collected. Revenue is attributed to
`paid_at`, not `created_at`, so a September order collected in October counts in
October.

**The browser never sends a price.** The order payload has no price, cost or
total field — `orderInputSchema` would strip them anyway. The server reads the
current price from `products`, computes the total, and snapshots the costs onto
the order so later catalogue edits never rewrite historical profit.

**Money never becomes a float.** Postgres stores `numeric(12,2)` and does all
aggregation itself; the reporting functions cast money to `text`; JavaScript
converts that to integer centimes and back. No money value is ever a fractional
`Number`.

### Profit

```
profit = total_amount − product_cost − shipping_cost − acquisition_cost − other_cost
```

A generated stored column, so it can never drift from its inputs.

### Maximum profitable CPA

```
selling price − product cost − transport − other costs
```

Whatever is left over per paid order is the ceiling on what an acquisition may
cost. `/admin/profitability` compares it against the actual CPA and prints
**مربح** or **غير مربح** with the remaining headroom.

---

## Tracking, and why COD is different

`trackEvent('ViewContent')` is the only analytics call components ever make.
Meta, TikTok and GA sit behind it in `src/lib/analytics/`; adding a platform
touches that folder and nothing else.

The important decision is what a submitted form means:

| Moment | Meta | TikTok | Where |
|---|---|---|---|
| Page view | `PageView` | `Pageview` | browser |
| Scrolled the product | `ViewContent` | `ViewContent` | browser |
| Typed a valid phone | `InitiateCheckout` | `InitiateCheckout` | browser |
| **Submitted the form** | **`Lead`** | **`SubmitForm`** | browser + Conversions API |
| **Marked PAID in admin** | **`Purchase`** | **`CompletePayment`** | Conversions API only |

A submitted COD form is a lead, not a sale. Reporting every submission as a
Purchase trains the ad platforms to find people who order and then refuse the
parcel. `Purchase` fires from `/admin/orders` when you mark the order PAID, with
the amount actually collected, and `purchase_event_sent_at` guarantees it is
sent once.

Browser and server events share an `event_id` so the platforms deduplicate them.
Server-side tracking activates on its own as soon as `META_ACCESS_TOKEN` or
`TIKTOK_ACCESS_TOKEN` is set.

---

## Abandoned checkouts

A lead is written as soon as a valid Moroccan phone number exists in the form —
not on submit, because the people worth recovering are the ones who never
submit. Writes are debounced (1.5s) and guarded by a payload signature, so
typing a number produces one row, not twenty. `pagehide` flushes via
`sendBeacon` to catch the visitor who closes the tab.

Deduplication is layered: `session_id` is unique; a phone already captured in
another session updates that row instead of creating a second lead; a lead that
already converted is never reopened. Submitting an order links the lead and
marks it `CONVERTED`.

Abandoned checkouts are never counted as orders and never appear in revenue.

---

## Security

- Admin routes are gated twice: middleware for the redirect, and `requireAdmin()`
  on the server for the actual authorisation. Server actions re-check as well —
  a server action is a public endpoint and cannot inherit trust from its page.
- RLS is on for every table. The anon key can read nothing.
- The service-role key is only used in the two public route handlers, in modules
  marked `server-only` so a build fails if one is ever imported client-side.
- Order submissions are rate limited per IP, protected by a unique
  `idempotency_key`, a recent-order check on the phone, and a honeypot field.
- Visitor IPs are stored only as a salted hash.

---

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm start          # run the production build locally
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # money, metrics and validation tests
npm run db:verify  # check schema, RLS and seed data
```

`npm run dev` recompiles each route on first request, so pages feel slow there.
Use `npm run build && npm start` to see real speed — the landing page is
prerendered static HTML and serves in about 10 ms.

## Deploying

See [DEPLOY.md](DEPLOY.md) for AWS Lightsail: instance sizing, nginx, TLS,
systemd, and an atomic release script with rollback.

---

## Notes

- Product images live in `/public/images/` and are served through the Next.js
  image optimiser. The hero is `priority`; everything below the fold is lazy.
- The landing page is statically rendered and revalidates hourly. Saving a price
  in `/admin/products` revalidates it immediately.
- The order form has exactly three customer fields, as specified. `quantity` is
  supported end to end (schema, API, database, profit) but has no UI control —
  add a selector to `order-form.tsx` if you ever want to sell multi-packs.
- Source PDFs for both notebooks are kept in `docs/source/` for reference.
