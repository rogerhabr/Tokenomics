/**
 * The canonical origin for absolute URLs (sitemap, robots, Open Graph, JSON-LD).
 *
 * Vercel exposes the deployment host but not the production domain, so the
 * canonical origin has to be configured. Falls back to the Vercel URL for
 * previews and to localhost in development rather than emitting a broken
 * absolute URL — a wrong canonical is worse than a preview-scoped one.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  'http://localhost:3000'
).replace(/\/$/, '');

export const SITE_NAME = 'Axis Labs';

export function absolute(path: string): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
