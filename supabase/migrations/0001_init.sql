-- =============================================================================
-- Cahier EPS — COD store schema
-- Money is stored as numeric(12,2). All financial aggregation happens in SQL
-- (exact numeric arithmetic) and is returned to the app as text, so JavaScript
-- never performs floating-point arithmetic on money.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type order_status as enum (
    'NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'PAID', 'CANCELLED', 'RETURNED', 'FAILED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum (
    'NEW', 'CONTACTED', 'CONVERTED', 'NOT_INTERESTED', 'INVALID'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_users — the allow-list that gates every admin capability.
-- Bootstrap after creating your Supabase Auth user:
--   insert into admin_users (id, email)
--   select id, email from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------------
create table if not exists admin_users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admin_users where id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- products — the single source of truth for price and unit costs.
-- price          : what the customer pays per unit
-- compare_at_price: crossed-out "before" price shown on the landing page
-- shipping_price : delivery charged to the customer (0 = free delivery)
-- product_cost   : what one unit costs us (COGS)
-- transport_cost : what delivering one order actually costs us
-- other_cost     : packaging, COD fees, etc. per order
-- ---------------------------------------------------------------------------
create table if not exists products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  short_description text,
  price            numeric(12, 2) not null check (price >= 0),
  compare_at_price numeric(12, 2) check (compare_at_price >= 0),
  shipping_price   numeric(12, 2) not null default 0 check (shipping_price >= 0),
  product_cost     numeric(12, 2) not null default 0 check (product_cost >= 0),
  transport_cost   numeric(12, 2) not null default 0 check (transport_cost >= 0),
  other_cost       numeric(12, 2) not null default 0 check (other_cost >= 0),
  image_path       text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint compare_at_price_is_higher
    check (compare_at_price is null or compare_at_price >= price)
);

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

create index if not exists products_active_idx on products (is_active) where is_active;

-- ---------------------------------------------------------------------------
-- abandoned_checkouts — a lead is recorded as soon as a valid phone number is
-- typed, long before (and independently of) any order submission.
-- ---------------------------------------------------------------------------
create table if not exists abandoned_checkouts (
  id             uuid primary key default gen_random_uuid(),
  session_id     text not null unique,
  full_name      text,
  phone          text not null,
  address        text,
  product_id     uuid references products (id) on delete set null,
  status         lead_status not null default 'NEW',
  converted_order_id uuid,
  admin_note     text,
  source         text,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  fbclid         text,
  ttclid         text,
  landing_url    text,
  referrer       text,
  user_agent     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists abandoned_checkouts_set_updated_at on abandoned_checkouts;
create trigger abandoned_checkouts_set_updated_at
  before update on abandoned_checkouts
  for each row execute function set_updated_at();

create index if not exists abandoned_checkouts_phone_idx      on abandoned_checkouts (phone);
create index if not exists abandoned_checkouts_status_idx     on abandoned_checkouts (status);
create index if not exists abandoned_checkouts_created_at_idx on abandoned_checkouts (created_at desc);
create index if not exists abandoned_checkouts_open_idx
  on abandoned_checkouts (created_at desc)
  where status <> 'CONVERTED';

-- ---------------------------------------------------------------------------
-- orders
--   total_amount = unit_price * quantity + shipping_charged   (revenue side)
--   profit       = total_amount - product_cost - shipping_cost
--                                - acquisition_cost - other_cost
-- shipping_charged : what the customer paid for delivery (0 = free delivery)
-- shipping_cost    : what the delivery actually costs us
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text not null unique,
  customer_name    text not null,
  phone            text not null,
  address          text not null,
  product_id       uuid references products (id) on delete restrict,
  quantity         integer not null default 1 check (quantity between 1 and 50),

  unit_price       numeric(12, 2) not null check (unit_price >= 0),
  shipping_charged numeric(12, 2) not null default 0 check (shipping_charged >= 0),
  total_amount     numeric(12, 2) not null check (total_amount >= 0),

  product_cost     numeric(12, 2) not null default 0 check (product_cost >= 0),
  shipping_cost    numeric(12, 2) not null default 0 check (shipping_cost >= 0),
  acquisition_cost numeric(12, 2) not null default 0 check (acquisition_cost >= 0),
  other_cost       numeric(12, 2) not null default 0 check (other_cost >= 0),

  profit           numeric(12, 2) generated always as (
    total_amount - product_cost - shipping_cost - acquisition_cost - other_cost
  ) stored,

  status           order_status not null default 'NEW',

  source           text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  fbclid           text,
  ttclid           text,
  landing_url      text,
  referrer         text,

  session_id       text,
  lead_id          uuid references abandoned_checkouts (id) on delete set null,
  idempotency_key  text unique,
  ip_hash          text,
  user_agent       text,
  admin_note       text,

  -- Server-side event dedup keys, so the browser pixel and the Conversions API
  -- can report the same event without double-counting.
  event_id         text,
  purchase_event_sent_at timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  confirmed_at     timestamptz,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  paid_at          timestamptz,
  cancelled_at     timestamptz,
  returned_at      timestamptz,
  failed_at        timestamptz
);

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
  before update on orders
  for each row execute function set_updated_at();

alter table abandoned_checkouts
  drop constraint if exists abandoned_checkouts_converted_order_id_fkey;
alter table abandoned_checkouts
  add constraint abandoned_checkouts_converted_order_id_fkey
  foreign key (converted_order_id) references orders (id) on delete set null;

create index if not exists orders_status_idx      on orders (status);
create index if not exists orders_created_at_idx  on orders (created_at desc);
create index if not exists orders_phone_idx       on orders (phone);
create index if not exists orders_order_number_idx on orders (order_number);
create index if not exists orders_utm_source_idx  on orders (utm_source);
create index if not exists orders_source_idx      on orders (source);
-- The dashboard's hottest query: paid revenue over a period.
create index if not exists orders_paid_at_idx on orders (paid_at desc) where status = 'PAID';
create index if not exists orders_status_created_at_idx on orders (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Status timestamps: keep the funnel consistent no matter which status the
-- admin jumps to. Moving an order to PAID implies it was confirmed, shipped
-- and delivered, so those timestamps are back-filled if they are missing.
-- ---------------------------------------------------------------------------
create or replace function sync_order_status_timestamps()
returns trigger
language plpgsql
as $$
declare
  ts timestamptz := now();
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status in ('CONFIRMED', 'SHIPPED', 'DELIVERED', 'PAID') then
    new.confirmed_at := coalesce(new.confirmed_at, ts);
  end if;
  if new.status in ('SHIPPED', 'DELIVERED', 'PAID') then
    new.shipped_at := coalesce(new.shipped_at, ts);
  end if;
  if new.status in ('DELIVERED', 'PAID') then
    new.delivered_at := coalesce(new.delivered_at, ts);
  end if;
  if new.status = 'PAID' then
    new.paid_at := coalesce(new.paid_at, ts);
  end if;
  if new.status = 'CANCELLED' then
    new.cancelled_at := coalesce(new.cancelled_at, ts);
  end if;
  if new.status = 'RETURNED' then
    new.returned_at := coalesce(new.returned_at, ts);
  end if;
  if new.status = 'FAILED' then
    new.failed_at := coalesce(new.failed_at, ts);
  end if;

  -- Rolling an order back out of PAID must also drop the paid timestamp,
  -- otherwise the revenue reports would keep counting it.
  if new.status <> 'PAID' then
    new.paid_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_sync_status_timestamps on orders;
create trigger orders_sync_status_timestamps
  before insert or update on orders
  for each row execute function sync_order_status_timestamps();

-- ---------------------------------------------------------------------------
-- Order numbers: EPS-YYMM-#### with a per-month counter.
-- ---------------------------------------------------------------------------
create sequence if not exists order_number_seq start 1;

create or replace function next_order_number()
returns text
language sql
volatile
as $$
  select 'EPS-' || to_char(now(), 'YYMM') || '-' ||
         lpad((nextval('order_number_seq') % 100000)::text, 5, '0');
$$;

-- ---------------------------------------------------------------------------
-- settings — singleton row holding the advertising cost model.
-- ad_cost_mode = 'CPA'      -> advertising cost = default_cpa * paid orders
-- ad_cost_mode = 'AD_SPEND' -> advertising cost = sum of ad_spend in range
-- ---------------------------------------------------------------------------
create table if not exists settings (
  id           boolean primary key default true check (id),
  ad_cost_mode text not null default 'CPA' check (ad_cost_mode in ('CPA', 'AD_SPEND')),
  default_cpa  numeric(12, 2) not null default 0 check (default_cpa >= 0),
  currency     text not null default 'MAD',
  store_name   text not null default 'دفاتر التربية البدنية',
  store_phone  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists settings_set_updated_at on settings;
create trigger settings_set_updated_at
  before update on settings
  for each row execute function set_updated_at();

insert into settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ad_spend — real advertising spend by day and platform, for exact ROAS/CPA.
-- ---------------------------------------------------------------------------
create table if not exists ad_spend (
  id         uuid primary key default gen_random_uuid(),
  spend_date date not null,
  platform   text not null default 'META',
  amount     numeric(12, 2) not null check (amount >= 0),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spend_date, platform)
);

drop trigger if exists ad_spend_set_updated_at on ad_spend;
create trigger ad_spend_set_updated_at
  before update on ad_spend
  for each row execute function set_updated_at();

create index if not exists ad_spend_date_idx on ad_spend (spend_date desc);

-- ---------------------------------------------------------------------------
-- Reporting functions. Money is returned as text so the client never turns it
-- into a float. Counts are returned as bigint.
-- ---------------------------------------------------------------------------

-- Revenue and cost totals over a period. REVENUE RULE: only status = 'PAID'
-- contributes to revenue, and it is attributed to paid_at, not created_at.
create or replace function report_financials(from_ts timestamptz, to_ts timestamptz)
returns table (
  paid_orders      bigint,
  paid_units       bigint,
  paid_revenue     text,
  product_costs    text,
  shipping_costs   text,
  other_costs      text,
  order_ad_costs   text
)
language sql
stable
set search_path = public
as $$
  select
    count(*)::bigint,
    coalesce(sum(quantity), 0)::bigint,
    coalesce(sum(total_amount), 0)::text,
    coalesce(sum(product_cost), 0)::text,
    coalesce(sum(shipping_cost), 0)::text,
    coalesce(sum(other_cost), 0)::text,
    coalesce(sum(acquisition_cost), 0)::text
  from orders
  where status = 'PAID'
    and paid_at >= from_ts
    and paid_at < to_ts;
$$;

-- Order funnel counts over a period, keyed on created_at so every order placed
-- in the window is counted exactly once regardless of its current status.
create or replace function report_funnel(from_ts timestamptz, to_ts timestamptz)
returns table (
  total_orders   bigint,
  confirmed      bigint,
  shipped        bigint,
  delivered      bigint,
  paid           bigint,
  cancelled      bigint,
  returned       bigint,
  failed         bigint,
  gross_amount   text
)
language sql
stable
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where confirmed_at is not null)::bigint,
    count(*) filter (where shipped_at   is not null)::bigint,
    count(*) filter (where delivered_at is not null)::bigint,
    count(*) filter (where status = 'PAID')::bigint,
    count(*) filter (where status = 'CANCELLED')::bigint,
    count(*) filter (where status = 'RETURNED')::bigint,
    count(*) filter (where status = 'FAILED')::bigint,
    coalesce(sum(total_amount), 0)::text
  from orders
  where created_at >= from_ts and created_at < to_ts;
$$;

-- Daily series: orders placed per day, and revenue/profit from orders PAID
-- that day. The two are deliberately measured on different timestamps.
create or replace function report_daily(from_ts timestamptz, to_ts timestamptz)
returns table (
  day          date,
  orders_count bigint,
  paid_count   bigint,
  revenue      text,
  profit       text
)
language sql
stable
set search_path = public
as $$
  with days as (
    select generate_series(from_ts::date, (to_ts - interval '1 day')::date, interval '1 day')::date as day
  ),
  placed as (
    select created_at::date as day, count(*) as n
    from orders
    where created_at >= from_ts and created_at < to_ts
    group by 1
  ),
  paid as (
    select paid_at::date as day,
           count(*) as n,
           sum(total_amount) as revenue,
           sum(profit) as profit
    from orders
    where status = 'PAID' and paid_at >= from_ts and paid_at < to_ts
    group by 1
  )
  select
    d.day,
    coalesce(p.n, 0)::bigint,
    coalesce(q.n, 0)::bigint,
    coalesce(q.revenue, 0)::text,
    coalesce(q.profit, 0)::text
  from days d
  left join placed p on p.day = d.day
  left join paid   q on q.day = d.day
  order by d.day;
$$;

-- Marketing source performance. Orders are grouped by created_at, while
-- revenue counts only the paid ones.
create or replace function report_sources(from_ts timestamptz, to_ts timestamptz)
returns table (
  source       text,
  campaign     text,
  orders_count bigint,
  paid_count   bigint,
  paid_revenue text,
  paid_profit  text
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(nullif(o.source, ''), 'direct') as source,
    coalesce(nullif(o.utm_campaign, ''), '—') as campaign,
    count(*)::bigint,
    count(*) filter (where o.status = 'PAID')::bigint,
    coalesce(sum(o.total_amount) filter (where o.status = 'PAID'), 0)::text,
    coalesce(sum(o.profit)       filter (where o.status = 'PAID'), 0)::text
  from orders o
  where o.created_at >= from_ts and o.created_at < to_ts
  group by 1, 2
  order by 3 desc;
$$;

-- Advertising spend booked in a period.
create or replace function report_ad_spend(from_ts timestamptz, to_ts timestamptz)
returns table (total text, entries bigint)
language sql
stable
set search_path = public
as $$
  select coalesce(sum(amount), 0)::text, count(*)::bigint
  from ad_spend
  where spend_date >= from_ts::date and spend_date < to_ts::date;
$$;

-- Abandoned checkout counts for the same period.
create or replace function report_leads(from_ts timestamptz, to_ts timestamptz)
returns table (
  total          bigint,
  new_leads      bigint,
  contacted      bigint,
  converted      bigint,
  not_interested bigint,
  invalid        bigint
)
language sql
stable
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter (where status = 'NEW')::bigint,
    count(*) filter (where status = 'CONTACTED')::bigint,
    count(*) filter (where status = 'CONVERTED')::bigint,
    count(*) filter (where status = 'NOT_INTERESTED')::bigint,
    count(*) filter (where status = 'INVALID')::bigint
  from abandoned_checkouts
  where created_at >= from_ts and created_at < to_ts;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security.
-- The public site never touches these tables directly: the landing page reads
-- the product through a server component and writes through route handlers
-- that use the service-role key. Everything here is therefore admin-only.
-- ---------------------------------------------------------------------------
alter table products            enable row level security;
alter table orders              enable row level security;
alter table abandoned_checkouts enable row level security;
alter table settings            enable row level security;
alter table ad_spend            enable row level security;
alter table admin_users         enable row level security;

drop policy if exists admin_all_products on products;
create policy admin_all_products on products
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_all_orders on orders;
create policy admin_all_orders on orders
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_all_leads on abandoned_checkouts;
create policy admin_all_leads on abandoned_checkouts
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_all_settings on settings;
create policy admin_all_settings on settings
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_all_ad_spend on ad_spend;
create policy admin_all_ad_spend on ad_spend
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists admin_read_self on admin_users;
create policy admin_read_self on admin_users
  for select to authenticated using (id = auth.uid());

-- Reporting functions are security definer, so restrict who may call them.
revoke all on function report_financials(timestamptz, timestamptz) from public, anon;
revoke all on function report_funnel(timestamptz, timestamptz)     from public, anon;
revoke all on function report_daily(timestamptz, timestamptz)      from public, anon;
revoke all on function report_sources(timestamptz, timestamptz)    from public, anon;
revoke all on function report_ad_spend(timestamptz, timestamptz)   from public, anon;
revoke all on function report_leads(timestamptz, timestamptz)      from public, anon;
revoke all on function is_admin() from public, anon;

grant execute on function report_financials(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function report_funnel(timestamptz, timestamptz)     to authenticated, service_role;
grant execute on function report_daily(timestamptz, timestamptz)      to authenticated, service_role;
grant execute on function report_sources(timestamptz, timestamptz)    to authenticated, service_role;
grant execute on function report_ad_spend(timestamptz, timestamptz)   to authenticated, service_role;
grant execute on function report_leads(timestamptz, timestamptz)      to authenticated, service_role;
grant execute on function is_admin() to authenticated, service_role;
