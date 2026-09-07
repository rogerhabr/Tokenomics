'use client';

import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';
import { formatPerMg } from '@/lib/pricing';
import { OrderLink, ArrowLink, Rule } from './ui';

export default function CartView() {
  const { resolved, subtotalCents, setQuantity, remove, hydrated } = useCart();

  // The order lives in the visitor's browser, so there is nothing meaningful to
  // render server-side. Hold a neutral block until it is read, rather than
  // painting an empty state that would flash and then be replaced.
  if (!hydrated) {
    return <div className="h-[280px] border border-axis-rule-1 bg-axis-sunk" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="border-y border-axis-rule-2 py-[52px]">
        <h2 className="t-6 text-axis-ink">Your order is empty.</h2>
        <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">
          The register lists every compound we supply, with molecular mass and price per
          milligram.
        </p>
        <div className="mt-[26px]">
          <ArrowLink href="/products">Open the register</ArrowLink>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-[52px] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-[78px]">
      <div>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Compounds in your order</caption>
          <thead>
            <tr className="hidden border-b border-axis-rule-3 lg:table-row">
              <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
                Compound
              </th>
              <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
                Quantity
              </th>
              <th scope="col" className="t-1 py-[10px] text-right text-axis-ink-300">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {resolved.map((line) => {
              const rate =
                line.sizeMg && line.sizeMg > 0 ? line.unitPriceCents / line.sizeMg : null;
              return (
                <tr
                  key={line.variantId}
                  className="block border-b border-axis-rule-1 py-[13px] lg:table-row lg:py-0"
                >
                  <td className="block pr-[20px] align-top lg:table-cell lg:py-[16px]">
                    <Link
                      href={`/products/${line.productSlug}`}
                      className="t-4 text-axis-ink underline decoration-axis-rule-2 underline-offset-[4px]"
                    >
                      {line.productName}
                    </Link>
                    <span className="data t-2 mt-[2px] block text-axis-ink-500">
                      {line.variantLabel} · {formatPrice(line.unitPriceCents)} each
                      {rate !== null && ` · ${formatPerMg(rate)}`}
                    </span>
                  </td>

                  <td className="block pt-[13px] align-top lg:table-cell lg:py-[16px] lg:pr-[20px]">
                    <div className="flex items-center gap-[13px]">
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
                      <button
                        type="button"
                        onClick={() => remove(line.variantId)}
                        className="t-2 min-h-[44px] text-axis-ink-500 underline underline-offset-[4px] hover:text-axis-ink"
                      >
                        Remove
                        <span className="sr-only"> {line.productName}</span>
                      </button>
                    </div>
                  </td>

                  <td className="block pt-[8px] align-top lg:table-cell lg:py-[16px] lg:text-right">
                    <span className="data t-4 text-axis-ink">
                      {formatPrice(line.lineTotalCents)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--header-h)+26px)] lg:self-start">
        <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
          <h2 className="t-1 text-axis-ink-300">Summary</h2>

          <dl className="mt-[20px] border-t border-axis-rule-2">
            <div className="flex items-baseline justify-between border-b border-axis-rule-1 py-[13px]">
              <dt className="t-3 text-axis-ink-500">Subtotal</dt>
              <dd className="data t-5 text-axis-ink">{formatPrice(subtotalCents)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-[13px]">
              <dt className="t-3 text-axis-ink-500">Shipping</dt>
              <dd className="t-2 text-axis-ink-500">Quoted on the invoice</dd>
            </div>
          </dl>

          <Rule className="mt-[13px]" />

          <div className="mt-[26px]">
            <OrderLink href="/checkout">Continue to order details</OrderLink>
          </div>

          <p className="t-2 mt-[20px] text-axis-ink-500">
            Nothing is charged on this site. We confirm stock, allocate a lot, and reply with an
            itemised invoice and the lot certificate.
          </p>

          <div className="mt-[20px]">
            <ArrowLink href="/products">Add another compound</ArrowLink>
          </div>
        </div>
      </aside>
    </div>
  );
}
