import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Saved business cases. Postgres RLS on `business_cases` scopes every query to
// the signed-in user — the `.eq('user_id', ...)` filters are a convenience,
// not the security boundary (same pattern as /api/profile).

const MAX_INPUTS_BYTES = 64 * 1024;

// Degrade to 503 (not a crash) when Supabase isn't configured — the UI then
// shows "sign in to save" and the model keeps working client-side.
function notConfigured() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
}
const NOT_CONFIGURED = () => NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function GET() {
  if (notConfigured()) return NOT_CONFIGURED();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('business_cases')
    .select('id, name, inputs, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  if (notConfigured()) return NOT_CONFIGURED();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!isPlainObject(body)) return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });

  const { id, name, inputs } = body as { id?: unknown; name?: unknown; inputs?: unknown };
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
    return NextResponse.json({ error: 'name must be 1–120 characters' }, { status: 400 });
  }
  if (!isPlainObject(inputs) || typeof inputs.itCapacityMW !== 'number') {
    return NextResponse.json({ error: 'inputs must be a BusinessCaseInputs object' }, { status: 400 });
  }
  if (JSON.stringify(inputs).length > MAX_INPUTS_BYTES) {
    return NextResponse.json({ error: 'inputs too large' }, { status: 413 });
  }

  const row = { user_id: user.id, name: name.trim(), inputs };
  const query = typeof id === 'string'
    ? supabase.from('business_cases').update(row).eq('id', id).eq('user_id', user.id).select().single()
    : supabase.from('business_cases').insert(row).select().single();

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  if (notConfigured()) return NOT_CONFIGURED();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase.from('business_cases').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
