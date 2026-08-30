import { track } from '@vercel/analytics';

/**
 * The storefront's event vocabulary.
 *
 * Declared in one place and typed, so an event cannot be invented at a call
 * site and quietly become a second name for something already measured. A
 * funnel assembled from `add_to_cart` and `addToCart` measures nothing.
 *
 * WHAT MAY NOT GO IN A PROPERTY
 *
 * No email, name, address, phone, order reference or IP-adjacent value. This is
 * a research-chemical storefront: who bought what is exactly the information
 * that must not leave the database, and an analytics vendor is not a lawful
 * basis. Vercel Analytics is cookieless and does not build a visitor profile —
 * that only stays true if we do not hand it one.
 *
 * Properties are therefore restricted to catalogue facts (a slug, a variant id,
 * a count, a total in cents) which are the same for every visitor buying the
 * same thing.
 */
export type StorefrontEvent =
  /** Entry acknowledgement answered. */
  | { name: 'entry_accepted'; props?: never }
  | { name: 'entry_declined'; props?: never }
  /** A compound was added to the order. */
  | { name: 'add_to_cart'; props: { product: string; variant: string; quantity: number } }
  | { name: 'remove_from_cart'; props: { variant: string } }
  /** The buyer opened checkout with a non-empty cart. */
  | { name: 'checkout_started'; props: { lines: number; subtotal_cents: number } }
  /** The order was accepted by the server. */
  | { name: 'order_placed'; props: { lines: number; subtotal_cents: number } }
  /** Checkout was refused — the reason, never the input that caused it. */
  | { name: 'checkout_failed'; props: { reason: string } }
  /** A certificate of analysis was opened from a lot record. */
  | { name: 'certificate_opened'; props: { lot: string } }
  | { name: 'contact_submitted'; props?: never };

/**
 * Send an event. A no-op wherever Vercel Analytics is not enabled, which is
 * every local build and any deploy without it switched on — so nothing here
 * needs a guard at the call site.
 */
export function event(e: StorefrontEvent): void {
  try {
    if (e.props) track(e.name, e.props);
    else track(e.name);
  } catch {
    // Analytics must never be the reason a buyer cannot complete an order.
  }
}
