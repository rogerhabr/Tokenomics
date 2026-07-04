import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isRateLimited } from '@/lib/rateLimit';

const PUBLIC_PATHS = ['/login', '/auth/callback'];

// .trim() guards against a trailing newline/space sneaking in from copy-paste
// into the Vercel dashboard — that alone is enough to make the Supabase SDK
// throw on an otherwise-valid URL/key.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

let warnedNotConfigured = false;
let warnedError = false;

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isApi = pathname.startsWith('/api');

  if (isApi && (await isRateLimited(request))) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // Supabase isn't configured yet (e.g. local dev before .env.local is set up,
  // or a preview deploy missing env vars) — let requests through unauthenticated
  // rather than hard-crashing every route. Auth-dependent routes (/login,
  // /api/profile) will still surface a clear error when actually used.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (!warnedNotConfigured) {
      console.warn('[middleware] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set — auth is disabled, all routes are open.');
      warnedNotConfigured = true;
    }
    return NextResponse.next();
  }

  try {
    let response = NextResponse.next({ request: { headers: request.headers } });

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Refreshes the session token if it's expired — required for Server
    // Components, which can't write cookies themselves.
    const { data: { user } } = await supabase.auth.getUser();

    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

    if (!user && !isPublic && !isApi) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (user && pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return response;
  } catch (err) {
    // A misconfigured URL/key (or a transient Supabase outage) should degrade
    // to "auth disabled" rather than 500 the entire site.
    if (!warnedError) {
      console.error('[middleware] Supabase auth check failed — letting requests through unauthenticated:', err);
      warnedError = true;
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)'],
};
