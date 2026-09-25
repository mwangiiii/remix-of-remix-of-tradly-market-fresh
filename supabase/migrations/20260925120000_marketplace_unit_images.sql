-- Per-variety images for marketplace product units.
--
-- A product (e.g. Potatoes) can be sold in several varieties/packs — per kg,
-- per bucket, per sack — each already carrying its own price and
-- availability on marketplace_product_units. This adds an ordered list of
-- image URLs per unit so the product page can show the bucket's photos when
-- the buyer picks "Bucket", the sack's photos for "Sack", and so on.
--
-- Empty array = no variety-specific images; the storefront falls back to
-- the product gallery. Images live in the existing marketplace-media bucket.
--
-- Safe to re-run. Existing RLS policies on marketplace_product_units cover
-- the new column (public read of published products, super-admin write).

alter table public.marketplace_product_units
  add column if not exists image_urls text[] not null default '{}'::text[];

comment on column public.marketplace_product_units.image_urls is
  'Ordered public URLs (marketplace-media bucket) shown on the product page when this unit is selected. Empty = use the product gallery.';

-- Make PostgREST pick up the new column immediately.
notify pgrst, 'reload schema';
