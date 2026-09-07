import { createPublicClient } from '@/lib/supabase/public';
import { variantsFor as seedVariantsFor, PRODUCTS } from '@/lib/products';
import { mgFromLabel, type PricedVariant } from '@/lib/pricing';

export type { PricedVariant };

/**
 * Vial sizes and prices.
 *
 * These live in the `product_variants` table so an administrator can change
 * them at /admin/pricing without a deploy. `src/lib/products.ts` keeps the same
 * data as a SEED and as the fallback: if Supabase is unconfigured (local dev, a
 * preview without env vars) or the table has not been migrated yet, the shop
 * still renders and still prices correctly, just from source.
 *
 * The fallback is deliberate rather than incidental. A storefront that shows no
 * prices is worse than one showing the prices its own repository documents.
 */

type VariantRow = {
  id: string;
  product_slug: string;
  label: string;
  size_mg: string | number | null;
  price_cents: number;
  sort_order: number;
};

const COLUMNS = 'id, product_slug, label, size_mg, price_cents, sort_order';

function toVariant(row: VariantRow): PricedVariant {
  return {
    id: row.id,
    label: row.label,
    priceCents: row.price_cents,
    // numeric() comes back as a string from PostgREST.
    sizeMg: row.size_mg === null ? null : Number(row.size_mg),
  };
}

/** The seed, shaped like a DB read, for the fallback path. */
function seedFor(slug: string): PricedVariant[] {
  return seedVariantsFor(slug).map((v) => ({ ...v, sizeMg: mgFromLabel(v.label) }));
}

/** Active variants for one compound, cheapest size first. */
export async function getVariantsFor(slug: string): Promise<PricedVariant[]> {
  const client = createPublicClient();
  if (!client) return seedFor(slug);
  try {
    const { data, error } = await client
      .from('product_variants')
      .select(COLUMNS)
      .eq('product_slug', slug)
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return seedFor(slug);
    return (data as VariantRow[]).map(toVariant);
  } catch {
    return seedFor(slug);
  }
}

/** Every active variant, keyed by product slug. One query, not seventeen. */
export async function getAllVariants(): Promise<Record<string, PricedVariant[]>> {
  const fallback = () =>
    Object.fromEntries(PRODUCTS.map((p) => [p.slug, seedFor(p.slug)])) as Record<
      string,
      PricedVariant[]
    >;

  const client = createPublicClient();
  if (!client) return fallback();
  try {
    const { data, error } = await client
      .from('product_variants')
      .select(COLUMNS)
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return fallback();

    const grouped: Record<string, PricedVariant[]> = {};
    for (const row of data as VariantRow[]) {
      (grouped[row.product_slug] ??= []).push(toVariant(row));
    }
    return grouped;
  } catch {
    return fallback();
  }
}

/**
 * Resolve one variant id to its product and price. This is what /api/orders
 * uses to price an order, so it must never trust anything the client sent
 * beyond the id itself.
 */
export async function resolveVariant(
  variantId: string
): Promise<{ productSlug: string; productName: string; variant: PricedVariant } | null> {
  const client = createPublicClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('product_variants')
        .select(COLUMNS)
        .eq('id', variantId)
        .limit(1);
      if (!error && data && data.length > 0) {
        const row = data[0] as VariantRow;
        const product = PRODUCTS.find((p) => p.slug === row.product_slug);
        if (product) {
          return {
            productSlug: product.slug,
            productName: product.name,
            variant: toVariant(row),
          };
        }
      }
    } catch {
      // Fall through to the seed.
    }
  }

  for (const product of PRODUCTS) {
    const match = seedFor(product.slug).find((v) => v.id === variantId);
    if (match) {
      return { productSlug: product.slug, productName: product.name, variant: match };
    }
  }
  return null;
}

/** Lowest price across a compound's sizes, for the register's "from" column. */
export function fromPrice(variants: PricedVariant[]): number | null {
  return variants.length ? Math.min(...variants.map((v) => v.priceCents)) : null;
}

/** Lowest price per milligram, for the register's comparison column. */
export function bestPerMg(variants: PricedVariant[]): number | null {
  const rates = variants
    .filter((v) => v.sizeMg !== null && v.sizeMg > 0)
    .map((v) => v.priceCents / (v.sizeMg as number));
  return rates.length ? Math.min(...rates) : null;
}
