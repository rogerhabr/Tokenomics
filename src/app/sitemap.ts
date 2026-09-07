import type { MetadataRoute } from 'next';
import { PRODUCTS } from '@/lib/products';
import { getAllLots } from '@/lib/lots';
import { absolute } from '@/lib/site';

/**
 * Only canonical, indexable URLs. The faceted views of the register
 * (/products?class=…, /products?q=…) are deliberately excluded and disallowed
 * in robots.ts — they are the same seventeen compounds in a different order,
 * and letting a crawler enumerate them splits the register's own ranking.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    { path: '/', priority: 1 },
    { path: '/products', priority: 0.9 },
    { path: '/lots', priority: 0.8 },
    { path: '/quality', priority: 0.8 },
    { path: '/about', priority: 0.6 },
    { path: '/ordering', priority: 0.6 },
    { path: '/contact', priority: 0.6 },
    { path: '/prohibited-use', priority: 0.4 },
    { path: '/terms', priority: 0.3 },
    { path: '/privacy', priority: 0.3 },
    { path: '/shipping-returns', priority: 0.3 },
    { path: '/accessibility', priority: 0.3 },
  ].map((r) => ({
    url: absolute(r.path),
    changeFrequency: 'monthly' as const,
    priority: r.priority,
  }));

  const productRoutes = PRODUCTS.map((p) => ({
    url: absolute(`/products/${p.slug}`),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }));

  // Lot permalinks are only listed once real records exist; the register
  // degrades to an empty list rather than failing the build when Supabase is
  // unconfigured.
  const { lots } = await getAllLots();
  const lotRoutes = lots.map((l) => ({
    url: absolute(`/lots/${encodeURIComponent(l.lotCode)}`),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...productRoutes, ...lotRoutes];
}
