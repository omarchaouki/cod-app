-- =============================================================================
-- Seed: the single product sold by the landing page.
-- Every value here is editable from /admin/products — nothing is hardcoded in
-- the frontend. These are starting values only.
-- =============================================================================

insert into products (
  slug, name, short_description,
  price, compare_at_price, shipping_price,
  product_cost, transport_cost, other_cost,
  image_path, is_active
)
values (
  'pack-cahiers-eps-2026-2027',
  'باك دفتر النصوص + الدفتر اليومي — التربية البدنية 2026/2027',
  'دفتران رسميان لأستاذ التربية البدنية والرياضية بالسلكين الإعدادي والتأهيلي، مطابقان للتوجيهات التربوية 2009 و2007.',
  149.00,   -- سعر البيع
  249.00,   -- السعر قبل التخفيض
  0.00,     -- التوصيل مجاني للزبون
  45.00,    -- تكلفة طبع الدفترين
  25.00,    -- تكلفة التوصيل التي نتحملها
  5.00,     -- تكاليف أخرى (التغليف، عمولة الدفع عند الاستلام)
  '/images/pack-cahiers.webp',
  true
)
on conflict (slug) do nothing;

-- Starting advertising model: a manual CPA until real ad spend is entered.
update settings
set default_cpa  = 30.00,
    ad_cost_mode = 'CPA',
    store_name   = 'دفاتر التربية البدنية',
    currency     = 'MAD'
where id = true;
