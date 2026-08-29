import type { ReactNode } from 'react';
import SiteNav from '@/components/marketing/SiteNav';
import SiteFooter from '@/components/marketing/SiteFooter';
import CartDrawer from '@/components/marketing/CartDrawer';
import { CartProvider } from '@/contexts/CartContext';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-white text-axis-text antialiased">
        <SiteNav />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
