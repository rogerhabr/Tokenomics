'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';
import { OrderLink } from './ui';

export default function CartDrawer() {
  const { resolved, itemCount, subtotalCents, drawerOpen, setDrawerOpen, setQuantity, remove } =
    useCart();
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close on navigation.
  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;

    // Remember what had focus so it can be restored on close — otherwise focus
    // falls back to <body> and a keyboard user loses their place in the page.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      // Trap focus inside the dialog. Without this, tabbing walks into the
      // page behind an aria-modal dialog, which is a 2.4.3 failure.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close order"
        onClick={() => setDrawerOpen(false)}
        className="absolute inset-0 bg-[#101215]/45"
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Your order"
        className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-axis-rule-3 bg-axis-paper"
      >
        <header className="flex items-center justify-between border-b border-axis-rule-2 px-[26px] py-[16px]">
          <h2 className="t-1 text-axis-ink-300">
            Your order{itemCount > 0 && <span className="data"> · {itemCount}</span>}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="t-2 min-h-[44px] px-[8px] text-axis-ink-500 hover:text-axis-ink"
          >
            Close
          </button>
        </header>

        {resolved.length === 0 ? (
          <div className="flex flex-1 flex-col justify-center px-[26px]">
            <p className="t-4 text-axis-ink">Your order is empty.</p>
            <p className="t-3 mt-[8px] text-axis-ink-500">
              The register lists every compound we supply.
            </p>
            <Link
              href="/products"
              className="t-3 mt-[26px] inline-flex min-h-[44px] items-center justify-center rounded-plate border border-axis-rule-3 px-[20px] text-axis-ink hover:bg-axis-sunk"
            >
              Open the register
            </Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-[26px]">
              {resolved.map((line) => (
                <li key={line.variantId} className="border-b border-axis-rule-1 py-[20px]">
                  <Link
                    href={`/products/${line.productSlug}`}
                    className="t-4 text-axis-ink underline decoration-axis-rule-2 underline-offset-[4px]"
                  >
                    {line.productName}
                  </Link>
                  <p className="t-2 mt-[2px] text-axis-ink-500">{line.variantLabel}</p>

                  <div className="mt-[13px] flex items-center justify-between gap-[13px]">
                    <div className="flex items-stretch rounded-plate border border-axis-rule-3">
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                        aria-label={`Decrease quantity of ${line.productName}`}
                        className="t-4 min-h-[44px] w-[40px] text-axis-ink hover:bg-axis-plate"
                      >
                        −
                      </button>
                      <span className="data t-2 flex min-w-[40px] items-center justify-center text-axis-ink">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                        aria-label={`Increase quantity of ${line.productName}`}
                        className="t-4 min-h-[44px] w-[40px] text-axis-ink hover:bg-axis-plate"
                      >
                        +
                      </button>
                    </div>

                    <span className="data t-3 text-axis-ink">
                      {formatPrice(line.lineTotalCents)}
                    </span>

                    <button
                      type="button"
                      onClick={() => remove(line.variantId)}
                      className="t-2 min-h-[44px] text-axis-ink-500 underline underline-offset-[4px] hover:text-axis-ink"
                    >
                      Remove
                      <span className="sr-only"> {line.productName}</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-axis-rule-2 bg-axis-sunk px-[26px] py-[20px]">
              <div className="flex items-baseline justify-between">
                <span className="t-3 text-axis-ink-500">Subtotal</span>
                <span className="data t-5 text-axis-ink">{formatPrice(subtotalCents)}</span>
              </div>
              <p className="t-2 mt-[6px] text-axis-ink-500">Shipping quoted on the invoice.</p>
              <div className="mt-[16px]">
                <OrderLink href="/cart">Review the order</OrderLink>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
