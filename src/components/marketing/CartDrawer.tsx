'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { X, Trash2, ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';

export default function CartDrawer() {
  const { resolved, itemCount, subtotalCents, drawerOpen, setDrawerOpen, setQuantity, remove } =
    useCart();
  const pathname = usePathname();

  // Close on navigation, and on Escape while open.
  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    // Prevent the page behind the drawer from scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close cart"
        onClick={() => setDrawerOpen(false)}
        className="absolute inset-0 bg-axis-navy/40"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-axis-border px-6 py-5">
          <h2 className="text-lg font-bold text-axis-navy">
            Cart {itemCount > 0 && <span className="text-axis-faint">({itemCount})</span>}
          </h2>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close cart"
            className="focus-ring rounded-md p-1.5 text-axis-muted hover:text-axis-navy"
          >
            <X size={20} />
          </button>
        </header>

        {resolved.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <ShoppingCart size={32} className="text-axis-faint" />
            <p className="mt-4 text-base font-semibold text-axis-navy">Your cart is empty.</p>
            <p className="mt-2 text-sm text-axis-muted">
              Browse the catalogue to add research compounds.
            </p>
            <Link
              href="/products"
              className="focus-ring mt-6 rounded-lg bg-axis-blue px-5 py-3 text-sm font-semibold text-white hover:bg-axis-blue-hover"
            >
              Browse the catalogue
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-axis-border overflow-y-auto px-6">
              {resolved.map((line) => (
                <li key={line.variantId} className="py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        href={`/products/${line.productSlug}`}
                        className="focus-ring rounded text-sm font-bold text-axis-navy hover:text-axis-blue"
                      >
                        {line.productName}
                      </Link>
                      <p className="mt-0.5 text-xs text-axis-faint">{line.variantLabel}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-axis-navy">
                      {formatPrice(line.lineTotalCents)}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex items-center rounded-lg border border-axis-border">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                        aria-label={`Decrease quantity of ${line.productName}`}
                        className="focus-ring rounded-l-lg px-3 py-1.5 leading-none text-axis-navy hover:bg-axis-tint"
                      >
                        −
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold text-axis-navy">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                        aria-label={`Increase quantity of ${line.productName}`}
                        className="focus-ring rounded-r-lg px-3 py-1.5 leading-none text-axis-navy hover:bg-axis-tint"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line.variantId)}
                      aria-label={`Remove ${line.productName} from cart`}
                      className="focus-ring rounded-md p-1.5 text-axis-faint hover:text-axis-navy"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-axis-border px-6 py-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-axis-muted">Subtotal</span>
                <span className="text-xl font-bold text-axis-navy">
                  {formatPrice(subtotalCents)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-axis-faint">
                Shipping calculated at checkout.
              </p>
              <Link
                href="/checkout"
                className="focus-ring mt-5 block rounded-lg bg-axis-blue px-5 py-3 text-center text-sm font-semibold text-white hover:bg-axis-blue-hover"
              >
                Checkout
              </Link>
              <Link
                href="/cart"
                className="focus-ring mt-2.5 block rounded-lg border border-axis-border-strong px-5 py-3 text-center text-sm font-semibold text-axis-navy hover:border-axis-blue hover:text-axis-blue"
              >
                View cart
              </Link>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
