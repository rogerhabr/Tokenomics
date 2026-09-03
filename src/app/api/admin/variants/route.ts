import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { getProduct } from '@/lib/products';

/**
 * Price and vial-size administration.
 *
 * Two safeguards beyond the admin check: money is validated as integer cents
 * within a sane band before it reaches Postgres, and every write goes through
 * the caller's own session, so the row-level security policy on
 * `product_variants` is the last word regardless of what this handler does.
 */

// $0 to $100,000 a vial. Wide enough for any real bulk item, narrow enough that
// a slipped decimal or a pasted string is rejected rather than published.
const MAX_PRICE_CENTS = 10_000_000;
const MAX_ROWS = 200;

type UpdatePayload = { id: string; priceCents: number; active?: boolean };
type CreatePayload = { productSlug: string; sizeMg: number; priceCents: number };

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function validPrice(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_PRICE_CENTS;
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    const status = admin.reason === 'signed-out' ? 401 : admin.reason === 'not-admin' ? 403 : 503;
    return NextResponse.json(
      {
        error:
          admin.reason === 'unconfigured'
            ? 'Supabase is not configured on this deployment.'
            : 'Administrator access required.',
      },
      { status }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest('Expected a JSON body.');
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const updates = Array.isArray(body.updates) ? (body.updates as UpdatePayload[]) : [];
  const creates = Array.isArray(body.creates) ? (body.creates as CreatePayload[]) : [];

  if (updates.length + creates.length === 0) return badRequest('Nothing to save.');
  if (updates.length + creates.length > MAX_ROWS) return badRequest('Too many rows in one save.');

  for (const u of updates) {
    if (typeof u?.id !== 'string' || !u.id) return badRequest('A row is missing its id.');
    if (!validPrice(u.priceCents)) {
      return badRequest(`Price for ${u.id} must be a whole number of cents.`);
    }
  }

  for (const c of creates) {
    if (!getProduct(c?.productSlug)) return badRequest('Unknown compound.');
    if (!Number.isFinite(c?.sizeMg) || c.sizeMg <= 0 || c.sizeMg > 100_000) {
      return badRequest('Vial size must be a positive number of milligrams.');
    }
    if (!validPrice(c.priceCents)) return badRequest('Price must be a whole number of cents.');
  }

  const supabase = createClient();
  const touchedSlugs = new Set<string>();

  // Resolve slugs by querying, never by parsing the id. Variant ids are not
  // uniformly `<slug>-<size>`: the blend's rows are `dual-pathway-15mg` while
  // its slug is `dual-pathway-research-blend`, so string-splitting would
  // silently skip revalidating that product's page.
  if (updates.length > 0) {
    const { data } = await supabase
      .from('product_variants')
      .select('id, product_slug')
      .in(
        'id',
        updates.map((u) => u.id)
      );
    for (const row of (data ?? []) as { product_slug: string }[]) {
      touchedSlugs.add(row.product_slug);
    }
  }

  try {
    for (const u of updates) {
      const { error } = await supabase
        .from('product_variants')
        .update({
          price_cents: u.priceCents,
          ...(typeof u.active === 'boolean' ? { active: u.active } : {}),
          updated_at: new Date().toISOString(),
          updated_by: admin.userId,
        })
        .eq('id', u.id);
      if (error) {
        Sentry.captureException(error);
        return NextResponse.json({ error: `Could not save ${u.id}.` }, { status: 500 });
      }
    }

    for (const c of creates) {
      // Deterministic id in the same shape the catalogue already uses, so a
      // size added here is indistinguishable from a seeded one.
      const id = `${c.productSlug}-${c.sizeMg}mg`;
      const { error } = await supabase.from('product_variants').upsert(
        {
          id,
          product_slug: c.productSlug,
          label: `${c.sizeMg} mg vial`,
          size_mg: c.sizeMg,
          price_cents: c.priceCents,
          active: true,
          sort_order: Math.round(c.sizeMg),
          updated_at: new Date().toISOString(),
          updated_by: admin.userId,
        },
        { onConflict: 'id' }
      );
      if (error) {
        Sentry.captureException(error);
        return NextResponse.json({ error: `Could not add ${id}.` }, { status: 500 });
      }
      touchedSlugs.add(c.productSlug);
    }
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Could not save prices.' }, { status: 500 });
  }

  // Product pages are statically generated with an hourly revalidate, so
  // without this a price change would not appear for up to an hour. Purge the
  // affected pages now; the price list endpoint carries its own short cache.
  revalidatePath('/products');
  revalidatePath('/api/catalogue');
  Array.from(touchedSlugs).forEach((slug) => {
    if (getProduct(slug)) revalidatePath(`/products/${slug}`);
  });

  return NextResponse.json({ ok: true, updated: updates.length, created: creates.length });
}
