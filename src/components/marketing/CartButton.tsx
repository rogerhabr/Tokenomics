'use client';

import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';

/**
 * The order tray, shown as a running line rather than a glyph with a bubble:
 * `Order · 2 · $328.00`.
 *
 * A visible subtotal in the header is a documented recovery driver, and it is
 * more on-register than an icon on a site whose whole voice is printed data.
 */
export default function CartButton({ className = '' }: { className?: string }) {
  const { itemCount, subtotalCents, setDrawerOpen, hydrated } = useCart();

  // The server cannot see the visitor's stored cart, so painting a count
  // before hydration would flash a wrong number.
  const label =
    hydrated && itemCount > 0
      ? `Order · ${itemCount} · ${formatPrice(subtotalCents)}`
      : 'Order';

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label={
        hydrated && itemCount > 0
          ? `Open order, ${itemCount} items, subtotal ${formatPrice(subtotalCents)}`
          : 'Open order, empty'
      }
      className={`t-2 inline-flex min-h-[38px] items-center rounded-plate border border-axis-rule-3 px-[13px] text-axis-ink transition-colors duration-[--dur-1] hover:bg-axis-sunk ${className}`}
    >
      {label}
    </button>
  );
}
