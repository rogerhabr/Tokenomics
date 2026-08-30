import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { resolveVariant } from '@/lib/variants';
import { isKnownCountry } from '@/lib/countries';

const LIMITS = {
  name: 120,
  email: 200,
  organization: 160,
  phone: 40,
  addressLine1: 200,
  addressLine2: 200,
  city: 120,
  region: 120,
  postalCode: 32,
  country: 80,
  notes: 2000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LINES = 50;
const MAX_QTY = 99;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Short, human-quotable order reference (e.g. AX-7K2P4M). */
function orderReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  bytes.forEach((b) => {
    suffix += alphabet[b % alphabet.length];
  });
  return `AX-${suffix}`;
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;

  // Honeypot: a real browser leaves this empty. Accept silently so a bot cannot
  // tell rejection from success.
  if (readString(body.website)) {
    return NextResponse.json({ ok: true, reference: orderReference() });
  }

  const fields = {
    name: readString(body.name),
    email: readString(body.email),
    organization: readString(body.organization),
    phone: readString(body.phone),
    addressLine1: readString(body.addressLine1),
    addressLine2: readString(body.addressLine2),
    city: readString(body.city),
    region: readString(body.region),
    postalCode: readString(body.postalCode),
    country: readString(body.country),
    notes: readString(body.notes),
  };

  const required: (keyof typeof fields)[] = [
    'name',
    'email',
    'addressLine1',
    'city',
    'postalCode',
    'country',
  ];
  if (required.some((k) => !fields[k])) {
    return NextResponse.json(
      { error: 'Name, email, address, city, postal code, and country are required.' },
      { status: 400 }
    );
  }
  // The form offers a fixed list, so anything else was not chosen from it.
  // Checked server-side because a select element constrains a browser, not a
  // request.
  if (!isKnownCountry(fields.country)) {
    return NextResponse.json(
      { error: 'Select a country from the list.' },
      { status: 400 }
    );
  }

  if (!EMAIL_RE.test(fields.email)) {
    return NextResponse.json({ error: 'That email address does not look valid.' }, { status: 400 });
  }
  if ((Object.keys(fields) as (keyof typeof fields)[]).some((k) => fields[k].length > LIMITS[k])) {
    return NextResponse.json({ error: 'One or more fields are too long.' }, { status: 400 });
  }

  // Research-use acknowledgement is a hard gate, not a formality.
  if (body.researchUseAck !== true) {
    return NextResponse.json(
      { error: 'You must confirm the order is for laboratory research use only.' },
      { status: 400 }
    );
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }
  if (rawItems.length > MAX_LINES) {
    return NextResponse.json({ error: 'Too many line items.' }, { status: 400 });
  }

  // Prices are resolved on the server from the price list, never from the
  // request body — the client sends only a variant id and a quantity, so a
  // tampered payload cannot set its own price. This now reads the same
  // `product_variants` table the administrator edits, so an order is always
  // charged at the current price even if the buyer's tab is hours old.
  const items: {
    variant_id: string;
    product_slug: string;
    product_name: string;
    variant_label: string;
    unit_price_cents: number;
    quantity: number;
    line_total_cents: number;
  }[] = [];

  for (const raw of rawItems) {
    const entry = (raw ?? {}) as Record<string, unknown>;
    const variantId = readString(entry.variantId);
    const quantity = Number(entry.quantity);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return NextResponse.json({ error: 'Invalid quantity in cart.' }, { status: 400 });
    }
    const found = await resolveVariant(variantId);
    if (!found) {
      return NextResponse.json(
        { error: 'Your cart contains an item that is no longer available.' },
        { status: 400 }
      );
    }
    items.push({
      variant_id: found.variant.id,
      product_slug: found.productSlug,
      product_name: found.productName,
      variant_label: found.variant.label,
      unit_price_cents: found.variant.priceCents,
      quantity,
      line_total_cents: found.variant.priceCents * quantity,
    });
  }

  const subtotalCents = items.reduce((n, i) => n + i.line_total_cents, 0);
  const reference = orderReference();

  try {
    const supabase = createClient();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        reference,
        email: fields.email,
        name: fields.name,
        organization: fields.organization || null,
        phone: fields.phone || null,
        address_line1: fields.addressLine1,
        address_line2: fields.addressLine2 || null,
        city: fields.city,
        region: fields.region || null,
        postal_code: fields.postalCode,
        country: fields.country,
        notes: fields.notes || null,
        subtotal_cents: subtotalCents,
        research_use_ack: true,
      })
      .select('id')
      .single();

    if (orderError || !order) {
      Sentry.captureException(orderError ?? new Error('Order insert returned no row'));
      return NextResponse.json({ error: 'Could not place your order.' }, { status: 500 });
    }

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(items.map((i) => ({ ...i, order_id: order.id })));

    if (itemsError) {
      // The order row exists but has no items — flag it rather than leaving a
      // silently incomplete order in the table.
      Sentry.captureException(itemsError);
      await supabase.from('orders').update({ status: 'failed' }).eq('id', order.id);
      return NextResponse.json({ error: 'Could not place your order.' }, { status: 500 });
    }
  } catch (err) {
    // Supabase unconfigured (local dev, a preview deploy missing env vars) must
    // not crash checkout.
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'Ordering is not configured on this deployment.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, reference, subtotalCents }, { status: 201 });
}
