import type { MetadataRoute } from 'next';
import { absolute } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard',
          '/login',
          '/auth/',
          // Faceted and search views of the register: same compounds, different
          // order. Indexing them competes with /products for the same terms.
          '/products?',
          '/cart',
          '/checkout',
        ],
      },
    ],
    sitemap: absolute('/sitemap.xml'),
  };
}
