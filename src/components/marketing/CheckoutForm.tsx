'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';
import { COUNTRIES } from '@/lib/countries';
import { OrderButton, ArrowLink, Rule } from './ui';
import { event as trackEvent } from '@/lib/analytics';
import { useEffect } from 'react';

const FIELD =
  'mt-[8px] w-full rounded-plate border border-axis-rule-3 bg-axis-plate px-[13px] py-[11px] text-[16px] text-axis-ink outline-none placeholder:text-axis-ink-300';
const LABEL = 't-1 block text-axis-ink-300';
const OPTIONAL = <span className="normal-case">(optional)</span>;

/**
 * The order sequence, stated once. Baymard's finding is that perceived
 * security comes from ENCAPSULATION rather than from real card fields — so the
 * absence of a payment step is given the same bordered, sunk panel a card form
 * would get, and framed as procurement rather than as a missing feature.
 */
const SEQUENCE = [
  'You place this order — nothing is charged.',
  'We confirm stock and allocate a lot.',
  'We reply by email with an itemised invoice and the lot certificate.',
  'Payment clears.',
  'Dispatch.',
];

export default function CheckoutForm() {
  const { resolved, subtotalCents, clear, hydrated } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);

  // Above the early returns, or this is a conditional hook. Fires once per
  // mount, the first time there is a real cart to check out with — not on every
  // re-render, and not for someone who lands here with an empty order.
  useEffect(() => {
    if (started.current || !hydrated || resolved.length === 0) return;
    started.current = true;
    trackEvent({
      name: 'checkout_started',
      props: { lines: resolved.length, subtotal_cents: subtotalCents },
    });
  }, [hydrated, resolved.length, subtotalCents]);

  if (!hydrated) {
    return <div className="h-[420px] border border-axis-rule-1 bg-axis-sunk" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="border-y border-axis-rule-2 py-[52px]">
        <h2 className="t-6 text-axis-ink">Your order is empty.</h2>
        <p className="t-3 mt-[13px] text-axis-ink-500">
          Add compounds to the order before continuing.
        </p>
        <div className="mt-[26px]">
          <ArrowLink href="/products">Open the register</ArrowLink>
        </div>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          researchUseAck: data.researchUseAck === 'on',
          // Only ids and quantities are sent: the server prices the order from
          // the catalogue, so nothing here can set its own price.
          items: resolved.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        // The reason, never the input that produced it — a rejected address is
        // still an address.
        trackEvent({ name: 'checkout_failed', props: { reason: res.status === 400 ? 'validation' : `http_${res.status}` } });
        setSubmitting(false);
        return;
      }

      trackEvent({
        name: 'order_placed',
        props: { lines: resolved.length, subtotal_cents: subtotalCents },
      });
      clear();
      router.push(`/checkout/confirmed?ref=${encodeURIComponent(json.reference ?? '')}`);
    } catch {
      setError('Could not reach the server. Please try again.');
      trackEvent({ name: 'checkout_failed', props: { reason: 'network' } });
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-[52px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-[78px]"
    >
      <div>
        {/* Honeypot — hidden from people, tempting to bots. */}
        <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Stated once, at the top, in procurement language. */}
        <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
          <h2 className="t-1 text-axis-ink-300">How this order is processed</h2>
          <ol className="mt-[16px] border-t border-axis-rule-2">
            {SEQUENCE.map((step, i) => (
              <li
                key={step}
                className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px] border-b border-axis-rule-1 py-[10px]"
              >
                <span className="data t-1 text-axis-ink-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="t-3 text-axis-ink">{step}</span>
              </li>
            ))}
          </ol>
          <p className="t-2 mt-[16px] text-axis-ink-500">
            Axis Labs invoices against a purchase order or a proforma. No payment details are
            handled by this site.
          </p>
        </div>

        <fieldset className="mt-[52px] border-0 p-0">
          <legend className="t-1 text-axis-ink-300">01 — Contact</legend>
          <div className="mt-[20px] grid gap-[20px] sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                name="name"
                required
                maxLength={120}
                autoComplete="name"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={200}
                autoComplete="email"
                inputMode="email"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="organization">
                Institution {OPTIONAL}
              </label>
              <input
                id="organization"
                name="organization"
                maxLength={160}
                autoComplete="organization"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="phone">
                Phone {OPTIONAL}
              </label>
              <input
                id="phone"
                name="phone"
                maxLength={40}
                autoComplete="tel"
                inputMode="tel"
                className={FIELD}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-[52px] border-0 p-0">
          <legend className="t-1 text-axis-ink-300">02 — Shipping address</legend>
          <div className="mt-[20px] grid gap-[20px] sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="addressLine1">
                Address
              </label>
              <input
                id="addressLine1"
                name="addressLine1"
                required
                maxLength={200}
                autoComplete="address-line1"
                className={FIELD}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="addressLine2">
                Apartment, suite, lab {OPTIONAL}
              </label>
              <input
                id="addressLine2"
                name="addressLine2"
                maxLength={200}
                autoComplete="address-line2"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                required
                maxLength={120}
                autoComplete="address-level2"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="region">
                State or region {OPTIONAL}
              </label>
              <input
                id="region"
                name="region"
                maxLength={120}
                autoComplete="address-level1"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="postalCode">
                Postal code
              </label>
              <input
                id="postalCode"
                name="postalCode"
                required
                maxLength={32}
                autoComplete="postal-code"
                className={FIELD}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="country">
                Country
              </label>
              {/* A list rather than a text field: "USA", "U.S." and "Untied
                  States" all arrive from a free-text country box, and none of
                  them resolve to a carrier's country code. */}
              <select
                id="country"
                name="country"
                required
                defaultValue=""
                autoComplete="country-name"
                className={FIELD}
              >
                <option value="" disabled>
                  Select a country
                </option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-[52px] border-0 p-0">
          <legend className="t-1 text-axis-ink-300">03 — Order notes</legend>
          <label className="sr-only" htmlFor="notes">
            Order notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            placeholder="Purchase order number, certificate requirements, delivery instructions."
            className={`${FIELD} resize-y`}
          />
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--header-h)+26px)] lg:self-start">
        <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
          <h2 className="t-1 text-axis-ink-300">Your order</h2>

          <ul className="mt-[20px] border-t border-axis-rule-2">
            {resolved.map((line) => (
              <li
                key={line.variantId}
                className="flex justify-between gap-[20px] border-b border-axis-rule-1 py-[13px]"
              >
                <span className="min-w-0">
                  <span className="t-3 block text-axis-ink">{line.productName}</span>
                  <span className="data t-2 block text-axis-ink-500">
                    {line.variantLabel} × {line.quantity}
                  </span>
                </span>
                <span className="data t-3 shrink-0 text-axis-ink">
                  {formatPrice(line.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-[16px] flex items-baseline justify-between">
            <span className="t-3 text-axis-ink-500">Subtotal</span>
            <span className="data t-5 text-axis-ink">{formatPrice(subtotalCents)}</span>
          </div>
          <p className="t-2 mt-[6px] text-axis-ink-500">
            Shipping and any applicable duties are confirmed on your invoice.
          </p>

          <Rule className="mt-[20px]" />

          <label className="mt-[20px] flex cursor-pointer items-start gap-[13px] border border-axis-rule-3 bg-axis-plate p-[16px]">
            <input
              type="checkbox"
              name="researchUseAck"
              required
              className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[#101215]"
            />
            <span className="t-2 text-axis-ink">
              I confirm I am ordering these materials for laboratory research use only, and that
              they will not be used for human or veterinary consumption or any clinical purpose.
            </span>
          </label>

          {error && (
            <p role="alert" className="t-3 mt-[16px] text-axis-rejected">
              {error}
            </p>
          )}

          <div className="mt-[20px]">
            <OrderButton disabled={submitting}>
              {submitting ? 'Placing order…' : 'Place order'}
            </OrderButton>
          </div>

          <p className="t-2 mt-[16px] text-axis-ink-500">
            No card details are collected here. Nothing is charged until you have the invoice and
            the lot certificate.
          </p>
        </div>
      </aside>
    </form>
  );
}
