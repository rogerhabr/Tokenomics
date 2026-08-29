'use client';

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice, type Variant } from '@/lib/products';
import { centsPerMg, formatPerMg } from '@/lib/pricing';
import { OrderButton } from './ui';

/**
 * Vial-size selection and the one filled control on the site.
 *
 * Each size shows its own $/mg beneath the label, so the choice between a 5 mg
 * and a 30 mg vial is made on the rate rather than on the headline price —
 * which is how this buyer actually decides, and which makes the larger vial's
 * value legible without a "best value" badge.
 */
export default function AddToCart({ variants }: { variants: Variant[] }) {
  const { add, setDrawerOpen } = useCart();
  const [selected, setSelected] = useState(variants[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);

  if (variants.length === 0) {
    return (
      <p className="t-3 text-axis-ink-500">
        Pricing for this compound is quoted on request.
      </p>
    );
  }

  const variant = variants.find((v) => v.id === selected) ?? variants[0];
  const rate = centsPerMg(variant);

  function onAdd() {
    add(variant.id, quantity);
    // The drawer opening IS the confirmation — a conversion affordance, not a
    // flourish, so there is no separate "Added" state to time out.
    setDrawerOpen(true);
  }

  return (
    <div>
      <fieldset className="border-0 p-0">
        <legend className="t-1 text-axis-ink-300">Vial size</legend>
        <div className="mt-[13px] flex flex-wrap gap-[8px]">
          {variants.map((v) => {
            const active = v.id === variant.id;
            const vRate = centsPerMg(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelected(v.id)}
                aria-pressed={active}
                className={`min-h-[48px] rounded-plate border px-[13px] py-[6px] text-left transition-colors duration-[--dur-1] ${
                  active
                    ? 'border-axis-ink bg-axis-plate'
                    : 'border-axis-rule-3 hover:bg-axis-plate'
                }`}
              >
                <span className="t-2 block text-axis-ink">{v.label}</span>
                {vRate !== null && (
                  <span className="data t-1 block normal-case text-axis-ink-300">{formatPerMg(vRate)}</span>
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-[26px] flex items-baseline gap-[10px]">
        <span className="data t-6 text-axis-ink">{formatPrice(variant.priceCents)}</span>
        {rate !== null && (
          <span className="data t-2 text-axis-ink-500">{formatPerMg(rate)}</span>
        )}
      </div>

      <div className="mt-[20px] flex items-stretch gap-[8px]">
        <div className="flex items-stretch rounded-plate border border-axis-rule-3">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
            className="t-4 min-h-[48px] w-[44px] text-axis-ink hover:bg-axis-plate"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="data t-2 flex min-w-[44px] items-center justify-center text-axis-ink"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(99, q + 1))}
            aria-label="Increase quantity"
            className="t-4 min-h-[48px] w-[44px] text-axis-ink hover:bg-axis-plate"
          >
            +
          </button>
        </div>

        <OrderButton type="button" onClick={onAdd} className="flex-1">
          Add to order
        </OrderButton>
      </div>
    </div>
  );
}
