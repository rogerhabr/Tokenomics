'use client';

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';
import { formatPerMg, type PricedVariant } from '@/lib/pricing';
import { OrderButton } from './ui';
import { event as trackEvent } from '@/lib/analytics';

function perMg(v: PricedVariant): number | null {
  return v.sizeMg && v.sizeMg > 0 ? v.priceCents / v.sizeMg : null;
}

/**
 * Vial size selection and the one filled control on the site.
 *
 * A dropdown rather than chips: compounds carry up to nine sizes, and nine
 * wrapped chips is a wall. Each option prints its own price so the choice is
 * made in the list rather than after it, and the selected size's $/mg sits
 * under the price — which is how this buyer actually compares a 5 mg vial
 * against a 50 mg one.
 */
export default function AddToCart({
  variants,
  productSlug,
}: {
  variants: PricedVariant[];
  /** Passed explicitly: variant ids do not uniformly embed the slug — the
   *  blends use their own shapes — so parsing one out would be wrong exactly
   *  where the catalogue is least regular. */
  productSlug: string;
}) {
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
  const rate = perMg(variant);

  function onAdd() {
    add(variant.id, quantity);
    trackEvent({
      name: 'add_to_cart',
      props: { product: productSlug, variant: variant.id, quantity: quantity },
    });
    // The drawer opening IS the confirmation — a conversion affordance, not a
    // flourish, so there is no separate "Added" state to time out.
    setDrawerOpen(true);
  }

  return (
    <div>
      <label htmlFor="vial-size" className="t-1 block text-axis-ink-300">
        Vial size
      </label>
      <select
        id="vial-size"
        value={variant.id}
        onChange={(e) => setSelected(e.target.value)}
        className="data mt-[8px] h-[48px] w-full rounded-plate border border-axis-rule-3 bg-axis-plate px-[13px] text-[16px] text-axis-ink"
      >
        {variants.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label} — {formatPrice(v.priceCents)}
          </option>
        ))}
      </select>

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
