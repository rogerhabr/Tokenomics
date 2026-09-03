import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin';
import { checkResearchUse, isContentKey, CONTENT_FIELDS } from '@/lib/content';

/**
 * Page-copy administration.
 *
 * Beyond the admin check, two rules apply to every string:
 *
 *  - The key must be one the registry declares. Arbitrary keys are refused, so
 *    this endpoint cannot be used to write unrendered junk into the table.
 *  - The value must pass the research-use guard. Making copy editable without
 *    that check would let anyone with the admin password turn a compliant
 *    catalogue page into a pretextual one, which is the single worst thing
 *    that could happen to this business.
 */

const MAX_LEN = 4000;
const MAX_FIELDS = 120;

/** Which routes a key affects, so a save purges the right pages. */
function pathsFor(key: string): string[] {
  if (key.startsWith('home.')) return ['/'];
  if (key.startsWith('quality.')) return ['/quality'];
  if (key.startsWith('contact.')) return ['/contact'];
  const product = key.match(/^product\.([a-z0-9-]+)\./);
  if (product) return [`/products/${product[1]}`, '/products'];
  return [];
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
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const changes = Array.isArray(body.changes)
    ? (body.changes as { key: string; value: string }[])
    : [];

  if (changes.length === 0) {
    return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  }
  if (changes.length > MAX_FIELDS) {
    return NextResponse.json({ error: 'Too many fields in one save.' }, { status: 400 });
  }

  for (const c of changes) {
    if (typeof c?.key !== 'string' || !isContentKey(c.key)) {
      return NextResponse.json({ error: `Unknown content field: ${c?.key}` }, { status: 400 });
    }
    if (typeof c.value !== 'string') {
      return NextResponse.json({ error: `${c.key} must be text.` }, { status: 400 });
    }
    if (c.value.length > MAX_LEN) {
      return NextResponse.json({ error: `${c.key} is too long.` }, { status: 400 });
    }

    const problems = checkResearchUse(c.value);
    if (problems.length > 0) {
      const label = CONTENT_FIELDS.find((f) => f.key === c.key)?.label ?? c.key;
      return NextResponse.json(
        {
          error: `“${label}” cannot be saved: it contains ${problems.join(', ')}. This catalogue is research-use-only — copy has to stay in laboratory-research terms.`,
        },
        { status: 400 }
      );
    }
  }

  const supabase = createClient();
  const paths = new Set<string>();

  try {
    for (const c of changes) {
      const trimmed = c.value.trim();

      // An empty value means "use the text in source", so the override row is
      // removed rather than stored blank. That keeps the table a record of what
      // has actually been changed.
      const { error } = trimmed
        ? await supabase.from('site_content').upsert(
            {
              key: c.key,
              value: trimmed,
              updated_at: new Date().toISOString(),
              updated_by: admin.userId,
            },
            { onConflict: 'key' }
          )
        : await supabase.from('site_content').delete().eq('key', c.key);

      if (error) {
        Sentry.captureException(error);
        return NextResponse.json({ error: `Could not save ${c.key}.` }, { status: 500 });
      }
      pathsFor(c.key).forEach((p) => paths.add(p));
    }
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: 'Could not save the copy.' }, { status: 500 });
  }

  Array.from(paths).forEach((p) => revalidatePath(p));

  return NextResponse.json({ ok: true, saved: changes.length });
}
