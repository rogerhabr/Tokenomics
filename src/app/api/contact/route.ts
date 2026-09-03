import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';

const LIMITS = { name: 120, email: 200, organization: 160, message: 4000 } as const;

// Deliberately permissive — real validation is "can this plausibly be an
// address", not RFC 5322 conformance.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const name = readString(body.name);
  const email = readString(body.email);
  const organization = readString(body.organization);
  const message = readString(body.message);

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: 'Name, email, and message are required.' },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'That email address does not look valid.' }, { status: 400 });
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    organization.length > LIMITS.organization ||
    message.length > LIMITS.message
  ) {
    return NextResponse.json({ error: 'One or more fields are too long.' }, { status: 400 });
  }

  // Honeypot: a real browser leaves this hidden field empty. Accept silently so
  // a bot cannot distinguish rejection from success.
  if (readString(body.website)) {
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = createClient();
    // Written through the RLS-scoped client: the anon insert policy in
    // 0002_contact_messages.sql is what authorises this, and no select policy
    // exists for anon, so nothing can be read back.
    const { error } = await supabase
      .from('contact_messages')
      .insert({ name, email, organization: organization || null, message });

    if (error) {
      Sentry.captureException(error);
      return NextResponse.json({ error: 'Could not save your message.' }, { status: 500 });
    }
  } catch (err) {
    // Supabase unconfigured (local dev, a preview deploy missing env vars) must
    // not 500 the marketing site — surface a clear, non-crashing message.
    Sentry.captureException(err);
    return NextResponse.json(
      { error: 'Contact form is not configured on this deployment.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
