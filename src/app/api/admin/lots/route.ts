import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { PRODUCTS } from '@/lib/products';

/**
 * The write path for the lot register.
 *
 * Three layers guard it, and all three are deliberate: the page check at
 * /admin/lots (for the person), this check (the security boundary), and RLS on
 * `lots` (the last word — every policy requires `profiles.role = 'admin'` and
 * every query carries the caller's own session). A page that renders is never
 * a permission.
 *
 * Nothing here invents data. The route validates shape and range only; the
 * figures come from whatever the administrator transcribes off a real
 * certificate, which is why `hplc_purity_pct` is range-checked here AND
 * constrained in the schema — a transposed digit should fail at the boundary,
 * not render as a plot mark off the canvas.
 */

const STATUSES = ['released', 'retained', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

const LIMITS = {
  lot_code: 64,
  product_slug: 80,
  vial_size: 60,
  method: 200,
  ms_result: 200,
  lab_legal_name: 200,
  lab_accreditation_body: 120,
  lab_accreditation_number: 80,
  report_number: 120,
  verify_url: 500,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function nullableStr(v: unknown, max: number): string | null | undefined {
  const s = str(v);
  if (!s) return null;
  return s.length > max ? undefined : s;
}

function nullableDate(v: unknown): string | null | undefined {
  const s = str(v);
  if (!s) return null;
  if (!ISO_DATE.test(s) || Number.isNaN(Date.parse(s))) return undefined;
  return s;
}

/** Revalidate every surface that reads the register. */
function revalidateLotSurfaces(productSlug?: string | null) {
  revalidatePath('/');
  revalidatePath('/lots');
  revalidatePath('/quality');
  if (productSlug) revalidatePath(`/products/${productSlug}`);
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.reason === 'unconfigured' ? 503 : 403 });
  }

  const supabase = createClient();
  // The admin select policy returns unpublished rows too — that is the point of
  // this screen.
  const { data, error } = await supabase
    .from('lots')
    .select('*')
    .order('assay_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Could not read the register.' }, { status: 500 });
  }
  return NextResponse.json({ lots: data ?? [] });
}

type Parsed = Record<string, string | number | boolean | null>;

function parseBody(body: Record<string, unknown>, { partial }: { partial: boolean }):
  | { ok: true; values: Parsed }
  | { ok: false; error: string } {
  const values: Parsed = {};

  const lotCode = str(body.lot_code);
  if (!partial || body.lot_code !== undefined) {
    if (!lotCode) return { ok: false, error: 'A lot code is required.' };
    if (lotCode.length > LIMITS.lot_code) return { ok: false, error: 'That lot code is too long.' };
    values.lot_code = lotCode;
  }

  const slug = str(body.product_slug);
  if (!partial || body.product_slug !== undefined) {
    if (!slug) return { ok: false, error: 'A compound is required.' };
    // Lots attach to catalogue compounds; a free-text slug would silently
    // orphan the record on every page that joins them.
    if (!PRODUCTS.some((p) => p.slug === slug)) {
      return { ok: false, error: 'That compound is not in the catalogue.' };
    }
    values.product_slug = slug;
  }

  if (!partial || body.status !== undefined) {
    const status = str(body.status) as Status;
    if (!STATUSES.includes(status)) return { ok: false, error: 'Status must be released, retained or rejected.' };
    values.status = status;
  }

  if (body.hplc_purity_pct !== undefined) {
    const raw = str(body.hplc_purity_pct);
    if (raw === '') {
      values.hplc_purity_pct = null;
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return { ok: false, error: 'Purity must be a percentage between 0 and 100.' };
      }
      values.hplc_purity_pct = n;
    }
  }

  for (const [key, max] of [
    ['vial_size', LIMITS.vial_size],
    ['method', LIMITS.method],
    ['ms_result', LIMITS.ms_result],
    ['lab_legal_name', LIMITS.lab_legal_name],
    ['lab_accreditation_body', LIMITS.lab_accreditation_body],
    ['lab_accreditation_number', LIMITS.lab_accreditation_number],
    ['report_number', LIMITS.report_number],
    ['verify_url', LIMITS.verify_url],
  ] as const) {
    if (body[key] === undefined) continue;
    const v = nullableStr(body[key], max);
    if (v === undefined) return { ok: false, error: `The ${key.replace(/_/g, ' ')} field is too long.` };
    values[key] = v;
  }

  if (values.verify_url && !/^https:\/\//i.test(String(values.verify_url))) {
    return { ok: false, error: 'The verification link must be an https:// URL.' };
  }

  for (const key of ['receipt_date', 'assay_date'] as const) {
    if (body[key] === undefined) continue;
    const v = nullableDate(body[key]);
    if (v === undefined) return { ok: false, error: `The ${key.replace(/_/g, ' ')} must be a valid date.` };
    values[key] = v;
  }

  if (body.published !== undefined) values.published = body.published === true;

  return { ok: true, values };
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.reason === 'unconfigured' ? 503 : 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const parsed = parseBody(body, { partial: false });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const supabase = createClient();
  const { data, error } = await supabase.from('lots').insert(parsed.values).select('*').single();

  if (error) {
    // 23505 is a unique violation — the lot code already exists, which is a
    // user error worth naming rather than a 500.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A lot with that code already exists.' }, { status: 409 });
    }
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Could not save the lot.' }, { status: 500 });
  }

  revalidateLotSurfaces(data.product_slug);
  return NextResponse.json({ lot: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.reason === 'unconfigured' ? 503 : 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const id = str(body.id);
  if (!id) return NextResponse.json({ error: 'A lot id is required.' }, { status: 400 });

  const parsed = parseBody(body, { partial: true });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.values).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('lots')
    .update(parsed.values)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A lot with that code already exists.' }, { status: 409 });
    }
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Could not update the lot.' }, { status: 500 });
  }

  revalidateLotSurfaces(data.product_slug);
  return NextResponse.json({ lot: data });
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.reason }, { status: admin.reason === 'unconfigured' ? 503 : 403 });
  }

  const id = str(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'A lot id is required.' }, { status: 400 });

  const supabase = createClient();

  // A lot that has ever been published must be unpublished rather than deleted:
  // a buyer holding that vial has to be able to find out what happened to its
  // record. Deletion is for rows entered in error, before anyone saw them.
  const { data: existing } = await supabase
    .from('lots')
    .select('published, product_slug, coa_path')
    .eq('id', id)
    .maybeSingle();

  if (existing?.published) {
    return NextResponse.json(
      { error: 'Unpublish this lot before deleting it — a published record must stay resolvable.' },
      { status: 409 }
    );
  }

  if (existing?.coa_path) {
    // Best effort: an orphaned object is untidy, not dangerous, and its read
    // policy already denies everyone once the row is gone.
    await supabase.storage.from('certificates').remove([existing.coa_path]);
  }

  const { error } = await supabase.from('lots').delete().eq('id', id);
  if (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: 'Could not delete the lot.' }, { status: 500 });
  }

  revalidateLotSurfaces(existing?.product_slug);
  return NextResponse.json({ ok: true });
}
