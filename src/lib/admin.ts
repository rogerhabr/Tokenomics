import { createClient } from '@/lib/supabase/server';

/**
 * The standard vial ladder offered when adding a size.
 *
 * It is a convenience, not a constraint: the catalogue already carries a 2 mg
 * oxytocin vial, a 60 mg tirzepatide vial and three multi-vial kits, none of
 * which are on this ladder, and all of which must keep working. Sizes outside
 * it can still be entered by hand.
 */
export const STANDARD_VIAL_SIZES_MG = [5, 10, 15, 20, 30, 40, 50, 80, 100] as const;

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; reason: 'unconfigured' | 'signed-out' | 'not-admin' };

/**
 * Whether the current session belongs to an administrator.
 *
 * Called on both the admin page and every admin API route. The page check is
 * for the person; the API check is the security boundary — a page that renders
 * is never a permission. Row-level security is the third layer: even if both
 * checks were bypassed, the `product_variants` write policies require
 * `profiles.role = 'admin'` and the request carries the caller's own session.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  let supabase;
  try {
    supabase = createClient();
  } catch {
    return { ok: false, reason: 'unconfigured' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'signed-out' };

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (error || data?.role !== 'admin') return { ok: false, reason: 'not-admin' };
  return { ok: true, userId: user.id };
}
