'use client';

import { useState } from 'react';
import { Check, ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, type Variant } from '@/lib/products';

export default function AddToCart({ variants }: { variants: Variant[] }) {
  const { add, setDrawerOpen } = useCart();
  const [selected, setSelected] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  if (variants.length === 0) return null;

  const variant = variants.find((v) => v.id === selected) ?? variants[0];

  function onAdd() {
    add(variant.id, quantity);
    setJustAdded(true);
    setDrawerOpen(true);
    window.setTimeout(() => setJustAdded(false), 1600);
  }

  return (
    <div>
      <fieldset>
        <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-axis-faint">
          Size
        </legend>
        <div className="mt-3 flex flex-wrap gap-2">
          {variants.map((v) => {
            const active = v.id === variant.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelected(v.id)}
                aria-pressed={active}
                className={`focus-ring rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-axis-blue bg-axis-tint text-axis-blue'
                    : 'border-axis-border bg-white text-axis-navy hover:border-axis-blue'
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-axis-navy">
          {formatPrice(variant.priceCents)}
        </span>
        <span className="text-sm text-axis-faint">per {variant.label.toLowerCase()}</span>
      </div>

      <div className="mt-5 flex items-stretch gap-3">
        <div className="flex items-center rounded-lg border border-axis-border">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="focus-ring rounded-l-lg px-3.5 py-2.5 text-lg leading-none text-axis-navy hover:bg-axis-tint"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-[2.5rem] px-1 py-2.5 text-center text-sm font-semibold text-axis-navy"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            aria-label="Increase quantity"
            className="focus-ring rounded-r-lg px-3.5 py-2.5 text-lg leading-none text-axis-navy hover:bg-axis-tint"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="focus-ring inline-flex flex-1 items-center justify-center rounded-lg bg-axis-blue px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-axis-blue-hover"
        >
          {justAdded ? (
            <>
              <Check size={16} className="mr-2" />
              Added
            </>
          ) : (
            <>
              <ShoppingCart size={16} className="mr-2" />
              Add to cart
            </>
          )}
        </button>
      </div>
    </div>
  );
}
