import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * A session-free Supabase client for reading PUBLIC data.
 *
 * `server.ts` binds to request cookies so RLS can scope a query to the
 * signed-in user. That is correct for /api/profile and anything user-specific,
 * but reading cookies opts a route out of static generation — and the lot
 * register is public, anonymous, identical for every visitor, and rendered on
 * product pages we want to keep statically generated.
 *
 * So this client carries no session at all. It reads with the anon key and is
 * governed by exactly the same row-level security: the `lots` policy grants
 * anon SELECT only where `published = true`, so an unpublished row is
 * unreachable through it regardless of who is asking.
 *
 * Returns null rather than throwing when the environment is not configured —
 * a preview deploy without env vars must still render the marketing site.
 */
export function createPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;

  try {
    return createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    return null;
  }
}
