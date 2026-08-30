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
  kit_size: number | null;
  kit_price_cents: number | null;
  sort_order: number;
};

const COLUMNS =
  'id, product_slug, label, size_mg, price_cents, kit_size, kit_price_cents, sort_order';

/**
 * A kit is the same concentration bought several at a time, so it is a column
 * on the size's row rather than a row of its own — one price change, both
 * prices, no drift. The storefront still needs it as a separately purchasable
 * thing, so the id is derived here and nowhere else.
 */
export function kitVariantId(baseId: string, kitSize: number): string {
  return `${baseId}-kit${kitSize}`;
}

/** Split a derived kit id back into the row it came from. */
function parseKitId(variantId: string): { baseId: string; kitSize: number } | null {
  const m = variantId.match(/^(.*)-kit(\d+)$/);
  if (!m) return null;
  const kitSize = Number(m[2]);
  return Number.isInteger(kitSize) && kitSize > 1 ? { baseId: m[1], kitSize } : null;
}

function toVariant(row: VariantRow): PricedVariant {
  return {
    id: row.id,
    label: row.label,
    priceCents: row.price_cents,
    // numeric() comes back as a string from PostgREST.
    sizeMg: row.size_mg === null ? null : Number(row.size_mg),
  };
}

/** The kit option a row offers, if it has been given a kit price. */
function toKitVariant(row: VariantRow): PricedVariant | null {
  const kitSize = row.kit_size ?? 10;
  if (row.kit_price_cents === null || row.kit_price_cents === undefined) return null;
  const sizeMg = row.size_mg === null ? null : Number(row.size_mg);
  return {
    id: kitVariantId(row.id, kitSize),
    // The label states the multiplication rather than a total, because a buyer
    // choosing a kit is counting vials, not milligrams.
    label: `${kitSize} x ${row.label}`,
    priceCents: row.kit_price_cents,
    sizeMg: sizeMg === null ? null : sizeMg * kitSize,
  };
}

/** A row expands into the single vial and, where priced, its kit. */
function expand(row: VariantRow): PricedVariant[] {
  const kit = toKitVariant(row);
  return kit ? [toVariant(row), kit] : [toVariant(row)];
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
    return (data as VariantRow[]).flatMap(expand);
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
      (grouped[row.product_slug] ??= []).push(...expand(row));
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

  // A kit id is derived, so it is not a row. Look up the row it came from and
  // price the kit from that row's own kit price — never from the single-vial
  // price multiplied here, which would let a client's chosen quantity define
  // the discount.
  const kit = parseKitId(variantId);
  const lookupId = kit ? kit.baseId : variantId;

  if (client) {
    try {
      const { data, error } = await client
        .from('product_variants')
        .select(COLUMNS)
        .eq('id', lookupId)
        .limit(1);
      if (!error && data && data.length > 0) {
        const row = data[0] as VariantRow;
        const product = PRODUCTS.find((p) => p.slug === row.product_slug);
        if (product) {
          const variant = kit ? toKitVariant(row) : toVariant(row);
          // A kit id whose row carries no kit price is not purchasable.
          if (variant && variant.id === variantId) {
            return { productSlug: product.slug, productName: product.name, variant };
          }
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
