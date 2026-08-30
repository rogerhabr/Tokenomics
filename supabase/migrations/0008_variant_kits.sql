-- Vial and 10-vial-kit pricing for the whole catalogue, in the database.
--
-- 0005 put vial prices in `product_variants` and seeded them. Two things have
-- happened since: the catalogue grew from 17 compounds to 24 and every one was
-- given the vial ladder its market actually sells (51 rows to 68), and kits
-- need a price of their own rather than being a separate size row carrying a
-- hand-written label.
--
-- WHY A KIT COLUMN RATHER THAN A KIT ROW
--
-- A 10 x 10 mg kit is not a different size. It is the same size bought ten at a
-- time. Modelling it as its own row duplicates the size, the label and the
-- mass, and lets the three drift apart — a price change on the vial that never
-- reaches the kit. One row per concentration carrying both prices cannot drift,
-- and it matches how an administrator thinks about it: a line per strength,
-- two prices on it.
--
-- The storefront derives a second purchasable option from any row that has a
-- kit price, with the id `<variant id>-kit10`. A row whose kit price is null is
-- sold as single vials only — which is how a size is withdrawn from kit sale
-- without deleting anything.
--
-- Every figure here is PLACEHOLDER, like the rest of the pricing, and is meant
-- to be edited at /admin/pricing rather than in a migration.

alter table public.product_variants
  add column if not exists kit_size integer not null default 10
    check (kit_size > 1),
  add column if not exists kit_price_cents integer
    check (kit_price_cents is null or kit_price_cents >= 0);

-- Seed the current catalogue. `on conflict do nothing` so this can never
-- overwrite a price an administrator has already set: a migration that
-- silently reverted someone's pricing would be worse than one that did nothing.
insert into public.product_variants
  (id, product_slug, label, size_mg, price_cents, kit_size, kit_price_cents, sort_order)
values
  ('tirzepatide-5mg', 'tirzepatide', '5 mg vial', 5, 3900, 10, 31100, 0),
  ('tirzepatide-10mg', 'tirzepatide', '10 mg vial', 10, 6900, 10, 55100, 1),
  ('tirzepatide-15mg', 'tirzepatide', '15 mg vial', 15, 9900, 10, 79100, 2),
  ('tirzepatide-20mg', 'tirzepatide', '20 mg vial', 20, 12900, 10, 103100, 3),
  ('tirzepatide-30mg', 'tirzepatide', '30 mg vial', 30, 18900, 10, 151100, 4),
  ('tirzepatide-60mg', 'tirzepatide', '60 mg vial', 60, 33900, 10, 271100, 5),
  ('retatrutide-5mg', 'retatrutide', '5 mg vial', 5, 7900, 10, 63100, 0),
  ('retatrutide-10mg', 'retatrutide', '10 mg vial', 10, 15900, 10, 127100, 1),
  ('retatrutide-15mg', 'retatrutide', '15 mg vial', 15, 21900, 10, 175100, 2),
  ('retatrutide-20mg', 'retatrutide', '20 mg vial', 20, 28900, 10, 231100, 3),
  ('retatrutide-30mg', 'retatrutide', '30 mg vial', 30, 40900, 10, 327100, 4),
  ('cagrilintide-5mg', 'cagrilintide', '5 mg vial', 5, 8900, 10, 71100, 0),
  ('cagrilintide-10mg', 'cagrilintide', '10 mg vial', 10, 16900, 10, 135100, 1),
  ('cagrilintide-20mg', 'cagrilintide', '20 mg vial', 20, 31900, 10, 255100, 2),
  ('semax-5mg', 'semax', '5 mg vial', 5, 1900, 10, 15100, 0),
  ('semax-10mg', 'semax', '10 mg vial', 10, 3900, 10, 31100, 1),
  ('semax-30mg', 'semax', '30 mg vial', 30, 9900, 10, 79100, 2),
  ('selank-5mg', 'selank', '5 mg vial', 5, 1900, 10, 15100, 0),
  ('selank-10mg', 'selank', '10 mg vial', 10, 3900, 10, 31100, 1),
  ('selank-30mg', 'selank', '30 mg vial', 30, 9900, 10, 79100, 2),
  ('bpc-157-5mg', 'bpc-157', '5 mg vial', 5, 2900, 10, 23100, 0),
  ('bpc-157-10mg', 'bpc-157', '10 mg vial', 10, 5900, 10, 47100, 1),
  ('bpc-157-20mg', 'bpc-157', '20 mg vial', 20, 11900, 10, 95100, 2),
  ('tb-500-2mg', 'tb-500', '2 mg vial', 2, 1900, 10, 15100, 0),
  ('tb-500-5mg', 'tb-500', '5 mg vial', 5, 4900, 10, 39100, 1),
  ('tb-500-10mg', 'tb-500', '10 mg vial', 10, 8900, 10, 71100, 2),
  ('kpv-5mg', 'kpv', '5 mg vial', 5, 1900, 10, 15100, 0),
  ('kpv-10mg', 'kpv', '10 mg vial', 10, 3900, 10, 31100, 1),
  ('kpv-50mg', 'kpv', '50 mg vial', 50, 15900, 10, 127100, 2),
  ('bpc-157-tb-500-10mg', 'bpc-157-tb-500', '10 mg vial — 5 mg + 5 mg', 10, 7900, 10, 63100, 0),
  ('bpc-157-tb-500-20mg', 'bpc-157-tb-500', '20 mg vial — 10 mg + 10 mg', 20, 13900, 10, 111100, 1),
  ('klow-blend-80mg', 'klow-blend', '80 mg vial — 50 mg GHK-Cu + 10 mg each of KPV, BPC-157, TB-500', 80, 15900, 10, 127100, 0),
  ('tesamorelin-2mg', 'tesamorelin', '2 mg vial', 2, 2900, 10, 23100, 0),
  ('tesamorelin-5mg', 'tesamorelin', '5 mg vial', 5, 6900, 10, 55100, 1),
  ('tesamorelin-10mg', 'tesamorelin', '10 mg vial', 10, 11900, 10, 95100, 2),
  ('ipamorelin-2mg', 'ipamorelin', '2 mg vial', 2, 900, 10, 7100, 0),
  ('ipamorelin-5mg', 'ipamorelin', '5 mg vial', 5, 2900, 10, 23100, 1),
  ('ipamorelin-10mg', 'ipamorelin', '10 mg vial', 10, 5900, 10, 47100, 2),
  ('dual-pathway-research-blend-15mg', 'dual-pathway-research-blend', '15 mg vial — 10 mg tesamorelin + 5 mg ipamorelin', 15, 11900, 10, 95100, 0),
  ('cjc-1295-2mg', 'cjc-1295', '2 mg vial', 2, 1900, 10, 15100, 0),
  ('cjc-1295-5mg', 'cjc-1295', '5 mg vial', 5, 3900, 10, 31100, 1),
  ('cjc-1295-10mg', 'cjc-1295', '10 mg vial', 10, 7900, 10, 63100, 2),
  ('cjc-1295-ipamorelin-10mg', 'cjc-1295-ipamorelin', '10 mg vial — 5 mg + 5 mg', 10, 8900, 10, 71100, 0),
  ('cjc-1295-ipamorelin-20mg', 'cjc-1295-ipamorelin', '20 mg vial — 10 mg + 10 mg', 20, 16900, 10, 135100, 1),
  ('pt-141-5mg', 'pt-141', '5 mg vial', 5, 2900, 10, 23100, 0),
  ('pt-141-10mg', 'pt-141', '10 mg vial', 10, 4900, 10, 39100, 1),
  ('pt-141-20mg', 'pt-141', '20 mg vial', 20, 8900, 10, 71100, 2),
  ('oxytocin-2mg', 'oxytocin', '2 mg vial', 2, 900, 10, 7100, 0),
  ('oxytocin-5mg', 'oxytocin', '5 mg vial', 5, 1900, 10, 15100, 1),
  ('oxytocin-10mg', 'oxytocin', '10 mg vial', 10, 3900, 10, 31100, 2),
  ('kisspeptin-10-5mg', 'kisspeptin-10', '5 mg vial', 5, 4900, 10, 39100, 0),
  ('kisspeptin-10-10mg', 'kisspeptin-10', '10 mg vial', 10, 8900, 10, 71100, 1),
  ('ghk-cu-10mg', 'ghk-cu', '10 mg vial', 10, 900, 10, 7100, 0),
  ('ghk-cu-50mg', 'ghk-cu', '50 mg vial', 50, 2900, 10, 23100, 1),
  ('ghk-cu-100mg', 'ghk-cu', '100 mg vial', 100, 5900, 10, 47100, 2),
  ('ghk-cu-200mg', 'ghk-cu', '200 mg vial', 200, 10900, 10, 87100, 3),
  ('melanotan-i-10mg', 'melanotan-i', '10 mg vial', 10, 4900, 10, 39100, 0),
  ('melanotan-i-20mg', 'melanotan-i', '20 mg vial', 20, 8900, 10, 71100, 1),
  ('ss-31-10mg', 'ss-31', '10 mg vial', 10, 6900, 10, 55100, 0),
  ('ss-31-50mg', 'ss-31', '50 mg vial', 50, 28900, 10, 231100, 1),
  ('mots-c-5mg', 'mots-c', '5 mg vial', 5, 5900, 10, 47100, 0),
  ('mots-c-10mg', 'mots-c', '10 mg vial', 10, 10900, 10, 87100, 1),
  ('mots-c-20mg', 'mots-c', '20 mg vial', 20, 19900, 10, 159100, 2),
  ('nad-100mg', 'nad', '100 mg vial', 100, 1900, 10, 15100, 0),
  ('nad-500mg', 'nad', '500 mg vial', 500, 8900, 10, 71100, 1),
  ('nad-1000mg', 'nad', '1000 mg vial', 1000, 15900, 10, 127100, 2),
  ('methylcobalamin-5mg', 'methylcobalamin', '5 mg vial', 5, 900, 10, 7100, 0),
  ('methylcobalamin-30mg', 'methylcobalamin', '30 mg vial', 30, 2900, 10, 23100, 1)
on conflict (id) do nothing;

-- Rows that 0005 already seeded were skipped by the conflict clause above, so
-- they kept the null kit price the new column gave them — leaving some sizes
-- offering a kit and others not, for no reason a buyer could see. Backfill
-- them at the same eight-vials-for-ten rate.
--
-- This is safe to do unconditionally precisely once: the column is created in
-- this migration, so every null here predates any administrator's ability to
-- set one. It must never be repeated in a later migration, where a null would
-- mean "withdrawn from kit sale" rather than "never had a price".
update public.product_variants
   set kit_price_cents = round(price_cents * 8 / 100.0) * 100 - 100
 where kit_price_cents is null
   and price_cents > 0;

-- Sizes that predate the researched ladder and are no longer in the catalogue
-- are retired rather than deleted: historical order_items must still resolve to
-- a label. An administrator can re-activate any of them at /admin/pricing.
update public.product_variants
   set active = false
 where id not in (
    'tirzepatide-5mg',
    'tirzepatide-10mg',
    'tirzepatide-15mg',
    'tirzepatide-20mg',
    'tirzepatide-30mg',
    'tirzepatide-60mg',
    'retatrutide-5mg',
    'retatrutide-10mg',
    'retatrutide-15mg',
    'retatrutide-20mg',
    'retatrutide-30mg',
    'cagrilintide-5mg',
    'cagrilintide-10mg',
    'cagrilintide-20mg',
    'semax-5mg',
    'semax-10mg',
    'semax-30mg',
    'selank-5mg',
    'selank-10mg',
    'selank-30mg',
    'bpc-157-5mg',
    'bpc-157-10mg',
    'bpc-157-20mg',
    'tb-500-2mg',
    'tb-500-5mg',
    'tb-500-10mg',
    'kpv-5mg',
    'kpv-10mg',
    'kpv-50mg',
    'bpc-157-tb-500-10mg',
    'bpc-157-tb-500-20mg',
    'klow-blend-80mg',
    'tesamorelin-2mg',
    'tesamorelin-5mg',
    'tesamorelin-10mg',
    'ipamorelin-2mg',
    'ipamorelin-5mg',
    'ipamorelin-10mg',
    'dual-pathway-research-blend-15mg',
    'cjc-1295-2mg',
    'cjc-1295-5mg',
    'cjc-1295-10mg',
    'cjc-1295-ipamorelin-10mg',
    'cjc-1295-ipamorelin-20mg',
    'pt-141-5mg',
    'pt-141-10mg',
    'pt-141-20mg',
    'oxytocin-2mg',
    'oxytocin-5mg',
    'oxytocin-10mg',
    'kisspeptin-10-5mg',
    'kisspeptin-10-10mg',
    'ghk-cu-10mg',
    'ghk-cu-50mg',
    'ghk-cu-100mg',
    'ghk-cu-200mg',
    'melanotan-i-10mg',
    'melanotan-i-20mg',
    'ss-31-10mg',
    'ss-31-50mg',
    'mots-c-5mg',
    'mots-c-10mg',
    'mots-c-20mg',
    'nad-100mg',
    'nad-500mg',
    'nad-1000mg',
    'methylcobalamin-5mg',
    'methylcobalamin-30mg'
  );
