import { createClient } from '@/lib/supabase/server';

/**
 * The standard vial ladder offered when adding a size.
 *
 * It spans the range the research market actually sells, from 2 mg peptide vials
 * to 1000 mg NAD+. It is a convenience, not a constraint: the four blends are
 * sold by total fill with the split named in the label, and any size outside
 * this ladder can still be entered by hand.
 */
export const STANDARD_VIAL_SIZES_MG = [
  2, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 200, 500, 1000,
] as const;

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
