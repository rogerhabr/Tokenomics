'use client';

import Link from 'next/link';
import { Trash2, ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';

export default function CartView() {
  const { resolved, subtotalCents, setQuantity, remove, hydrated } = useCart();

  // The cart lives in the visitor's browser, so there is nothing meaningful to
  // render server-side. Hold a neutral placeholder until it is read.
  if (!hydrated) {
    return <div className="h-64 animate-pulse rounded-xl border border-axis-border bg-axis-surface" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="rounded-xl border border-axis-border bg-axis-surface px-6 py-20 text-center">
        <ShoppingCart size={32} className="mx-auto text-axis-faint" />
        <h2 className="mt-4 text-xl font-bold text-axis-navy">Your cart is empty.</h2>
        <p className="mt-2 text-sm text-axis-muted">
          Browse the catalogue to add research compounds.
        </p>
        <Link
          href="/products"
          className="focus-ring mt-7 inline-block rounded-lg bg-axis-blue px-5 py-3 text-sm font-semibold text-white hover:bg-axis-blue-hover"
        >
          Browse the catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
      <div className="overflow-hidden rounded-xl border border-axis-border">
        <ul className="divide-y divide-axis-border">
          {resolved.map((line) => (
            <li key={line.variantId} className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/products/${line.productSlug}`}
                  className="focus-ring rounded text-base font-bold text-axis-navy hover:text-axis-blue"
                >
                  {line.productName}
                </Link>
                <p className="mt-1 text-sm text-axis-faint">{line.variantLabel}</p>
                <p className="mt-1 text-sm text-axis-muted">
                  {formatPrice(line.unitPriceCents)} each
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-axis-border">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                    aria-label={`Decrease quantity of ${line.productName}`}
                    className="focus-ring rounded-l-lg px-3 py-2 leading-none text-axis-navy hover:bg-axis-tint"
                  >
                    −
                  </button>
                  <span className="min-w-[2.25rem] text-center text-sm font-semibold text-axis-navy">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                    aria-label={`Increase quantity of ${line.productName}`}
                    className="focus-ring rounded-r-lg px-3 py-2 leading-none text-axis-navy hover:bg-axis-tint"
                  >
                    +
                  </button>
                </div>
                <span className="min-w-[5rem] text-right text-base font-bold text-axis-navy">
                  {formatPrice(line.lineTotalCents)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(line.variantId)}
                  aria-label={`Remove ${line.productName} from cart`}
                  className="focus-ring rounded-md p-2 text-axis-faint hover:text-axis-navy"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-xl border border-axis-border bg-axis-surface p-7">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-axis-navy">
            Order summary
          </h2>
          <div className="mt-5 flex items-center justify-between border-b border-axis-border pb-4">
            <span className="text-sm text-axis-muted">Subtotal</span>
            <span className="text-lg font-bold text-axis-navy">{formatPrice(subtotalCents)}</span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm text-axis-muted">Shipping</span>
            <span className="text-sm text-axis-muted">Calculated at checkout</span>
          </div>
          <Link
            href="/checkout"
            className="focus-ring mt-7 block rounded-lg bg-axis-blue px-5 py-3 text-center text-sm font-semibold text-white hover:bg-axis-blue-hover"
          >
            Proceed to checkout
          </Link>
          <Link
            href="/products"
            className="focus-ring mt-3 block rounded-lg px-5 py-2 text-center text-sm font-semibold text-axis-blue hover:text-axis-blue-hover"
          >
            Continue shopping
          </Link>
        </div>
      </aside>
    </div>
  );
}
