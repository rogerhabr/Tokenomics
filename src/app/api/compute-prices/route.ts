import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import {
  ORNN_ALLOWED_ROLES, ORNN_BASE_URL, ORNN_REVALIDATE_SECONDS, parseOrnnDailyIndex,
  type ComputePricesResponse,
} from '@/lib/ornn';

// Licensed data: every response is private and uncached at the edge, so a CDN
// can never hand one user's Ornn prices to another visitor.
const PRIVATE = { 'Cache-Control': 'private, no-store' };

// Per-user auth check on every request — never prerender this route at build.
export const dynamic = 'force-dynamic';

function reply(body: ComputePricesResponse, status = 200) {
  return NextResponse.json(body, { status, headers: PRIVATE });
}

export async function GET() {
  // Fail closed: unlike rate limiting, this gate protects licensed data, so an
  // unconfigured or broken auth path denies rather than opens.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return reply({ source: 'unavailable', reason: 'not-configured' });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return reply({ source: 'unavailable', reason: 'unauthenticated' }, 401);

  // RLS scopes this to the caller's own row; role is not user-writable (0002).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || !(ORNN_ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return reply({ source: 'unavailable', reason: 'forbidden' }, 403);
  }

  try {
    const key = process.env.ORNN_API_KEY?.trim();
    // Shared server-side data cache: at most one upstream call per hour per
    // region, well inside Ornn's 60 req/min public limit.
    const res = await fetch(`${ORNN_BASE_URL}/api/daily-index/all`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      next: { revalidate: ORNN_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`Ornn HTTP ${res.status}`);
    const parsed = parseOrnnDailyIndex(await res.json());
    if (!parsed) throw new Error('Ornn response failed validation');
    return reply(parsed);
  } catch (err) {
    Sentry.captureException(err);
    return reply({ source: 'unavailable', reason: 'upstream-error' });
  }
}
