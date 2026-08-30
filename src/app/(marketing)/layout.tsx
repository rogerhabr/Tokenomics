import type { ReactNode } from 'react';
import { Archivo, Martian_Mono } from 'next/font/google';
import SiteNav from '@/components/marketing/SiteNav';
import SiteFooter from '@/components/marketing/SiteFooter';
import CartDrawer from '@/components/marketing/CartDrawer';
import EntryGate from '@/components/marketing/EntryGate';
import { CartProvider } from '@/contexts/CartContext';
import MotionProvider from '@/components/motion/MotionProvider';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

/**
 * Two families, both variable, both with a width axis. Declared here in the
 * route group rather than in the root layout so /dashboard pays nothing for
 * them.
 *
 * `weight` is deliberately omitted: passing it loads static cuts and makes
 * `axes` illegal, which would cost us the width axis the whole type system is
 * built on.
 *
 * Martian Mono is the deliberate escape from the Geist/JetBrains/IBM Plex
 * default — it reads as instrument print-out rather than as a code editor, and
 * it draws a disambiguated zero without needing an OpenType feature.
 */
const grot = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-grot',
  display: 'swap',
});

const data = Martian_Mono({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-data',
  display: 'swap',
});

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className={`${grot.variable} ${data.variable} flex min-h-screen flex-col bg-axis-paper text-axis-ink`}>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SiteNav />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
      <CartDrawer />
      <EntryGate />
      <MotionProvider />
      {/* Storefront only. The dashboard at /dashboard is an internal tool
          behind auth; measuring it would mix two unrelated audiences into one
          set of numbers. Both collectors no-op unless enabled on the Vercel
          project, so local and preview builds send nothing. */}
      <Analytics />
      <SpeedInsights />
    </CartProvider>
  );
}
