'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export default function CartButton({ className = '' }: { className?: string }) {
  const { itemCount, setDrawerOpen, hydrated } = useCart();

  return (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-label={itemCount > 0 ? `Cart, ${itemCount} items` : 'Cart, empty'}
      className={`focus-ring relative rounded-md p-2.5 text-axis-navy transition-colors hover:text-axis-blue ${className}`}
    >
      <ShoppingCart size={20} />
      {/* Rendered only after hydration: the server has no access to the
          visitor's stored cart, so painting a count before then would flash a
          wrong number. */}
      {hydrated && itemCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-axis-blue px-1 text-[10px] font-bold text-white">
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </button>
  );
}
