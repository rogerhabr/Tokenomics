'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatPrice } from '@/lib/products';

const FIELD =
  'w-full rounded-lg border border-axis-border bg-white px-3.5 py-2.5 text-sm text-axis-text placeholder:text-axis-faint outline-none transition-colors focus:border-axis-blue';
const LABEL = 'block text-xs font-bold uppercase tracking-[0.12em] text-axis-navy';

export default function CheckoutForm() {
  const { resolved, subtotalCents, clear, hydrated } = useCart();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!hydrated) {
    return <div className="h-96 animate-pulse rounded-xl border border-axis-border bg-axis-surface" />;
  }

  if (resolved.length === 0) {
    return (
      <div className="rounded-xl border border-axis-border bg-axis-surface px-6 py-20 text-center">
        <h2 className="text-xl font-bold text-axis-navy">Your cart is empty.</h2>
        <p className="mt-2 text-sm text-axis-muted">Add compounds before checking out.</p>
        <Link
          href="/products"
          className="focus-ring mt-7 inline-block rounded-lg bg-axis-blue px-5 py-3 text-sm font-semibold text-white hover:bg-axis-blue-hover"
        >
          Browse the catalogue
        </Link>
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
        setSubmitting(false);
        return;
      }

      clear();
      router.push(`/checkout/confirmed?ref=${encodeURIComponent(json.reference ?? '')}`);
    } catch {
      setError('Could not reach the server. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-10 lg:grid-cols-[1.5fr_1fr]">
      <div>
        {/* Honeypot — hidden from people, tempting to bots. */}
        <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <fieldset>
          <legend className="text-sm font-bold uppercase tracking-[0.12em] text-axis-blue">
            Contact
          </legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="name">Full name</label>
              <input id="name" name="name" required maxLength={120} autoComplete="name" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required maxLength={200} autoComplete="email" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="organization">
                Institution <span className="font-medium normal-case tracking-normal text-axis-faint">(optional)</span>
              </label>
              <input id="organization" name="organization" maxLength={160} autoComplete="organization" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="phone">
                Phone <span className="font-medium normal-case tracking-normal text-axis-faint">(optional)</span>
              </label>
              <input id="phone" name="phone" maxLength={40} autoComplete="tel" className={`mt-2 ${FIELD}`} />
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-10">
          <legend className="text-sm font-bold uppercase tracking-[0.12em] text-axis-blue">
            Shipping address
          </legend>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="addressLine1">Address</label>
              <input id="addressLine1" name="addressLine1" required maxLength={200} autoComplete="address-line1" className={`mt-2 ${FIELD}`} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="addressLine2">
                Apartment, suite, lab <span className="font-medium normal-case tracking-normal text-axis-faint">(optional)</span>
              </label>
              <input id="addressLine2" name="addressLine2" maxLength={200} autoComplete="address-line2" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="city">City</label>
              <input id="city" name="city" required maxLength={120} autoComplete="address-level2" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="region">
                State / region <span className="font-medium normal-case tracking-normal text-axis-faint">(optional)</span>
              </label>
              <input id="region" name="region" maxLength={120} autoComplete="address-level1" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="postalCode">Postal code</label>
              <input id="postalCode" name="postalCode" required maxLength={32} autoComplete="postal-code" className={`mt-2 ${FIELD}`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="country">Country</label>
              <input id="country" name="country" required maxLength={80} autoComplete="country-name" className={`mt-2 ${FIELD}`} />
            </div>
          </div>
        </fieldset>

        <fieldset className="mt-10">
          <legend className="text-sm font-bold uppercase tracking-[0.12em] text-axis-blue">
            Order notes
          </legend>
          <label className="sr-only" htmlFor="notes">Order notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            maxLength={2000}
            placeholder="Purchase order number, certificate requirements, delivery instructions."
            className={`mt-5 resize-y ${FIELD}`}
          />
        </fieldset>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-xl border border-axis-border bg-axis-surface p-7">
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-axis-navy">
            Order summary
          </h2>

          <ul className="mt-5 space-y-4">
            {resolved.map((line) => (
              <li key={line.variantId} className="flex justify-between gap-4 text-sm">
                <span className="min-w-0 text-axis-muted">
                  <span className="font-semibold text-axis-navy">{line.productName}</span>
                  <br />
                  {line.variantLabel} &times; {line.quantity}
                </span>
                <span className="shrink-0 font-semibold text-axis-navy">
                  {formatPrice(line.lineTotalCents)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t border-axis-border pt-5">
            <span className="text-sm font-semibold text-axis-navy">Subtotal</span>
            <span className="text-xl font-bold text-axis-navy">{formatPrice(subtotalCents)}</span>
          </div>
          <p className="mt-1.5 text-xs text-axis-faint">
            Shipping and any applicable duties are confirmed on your invoice.
          </p>

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-lg border border-axis-border-strong bg-white p-4">
            <input
              type="checkbox"
              name="researchUseAck"
              required
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#2E4C9E]"
            />
            <span className="text-xs leading-relaxed text-axis-navy">
              I confirm I am ordering these materials for laboratory research use only, and that
              they will not be used for human or veterinary consumption or any clinical purpose.
            </span>
          </label>

          {error && (
            <p role="alert" className="mt-5 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="focus-ring mt-6 flex w-full items-center justify-center rounded-lg bg-axis-blue px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-axis-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="mr-2 animate-spin" />}
            {submitting ? 'Placing order…' : 'Place order'}
          </button>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-axis-faint">
            <Lock size={13} className="mt-0.5 shrink-0" />
            No card details are collected here. We confirm stock and send a secure payment link
            with your invoice.
          </p>
        </div>
      </aside>
    </form>
  );
}
