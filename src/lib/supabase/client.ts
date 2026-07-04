import { createBrowserClient } from '@supabase/ssr';

// .trim() guards against a trailing newline/space from copy-pasting the value
// into a dashboard — enough on its own to make the SDK reject an otherwise-valid URL.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Only call this when isSupabaseConfigured is true — createBrowserClient throws
// synchronously if the URL/key are missing.
export function createClient() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
