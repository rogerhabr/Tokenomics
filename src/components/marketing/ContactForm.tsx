'use client';

import { useState, type FormEvent } from 'react';
import { OrderButton } from './ui';
import { event as trackEvent } from '@/lib/analytics';

type Status = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Fields sit on the plate ground with a rule-3 border — the only borders on the
 * site that clear 3:1, which is what WCAG 1.4.11 requires of a control
 * boundary. 16px minimum text size prevents iOS zooming on focus.
 */
const FIELD =
  'mt-[8px] w-full rounded-plate border border-axis-rule-3 bg-axis-plate px-[13px] py-[11px] text-[16px] text-axis-ink outline-none placeholder:text-axis-ink-300';
const LABEL = 't-1 block text-axis-ink-300';

export default function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('sending');
    setError('');

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }
      form.reset();
      trackEvent({ name: 'contact_submitted' });
      setStatus('sent');
    } catch {
      setError('Could not reach the server. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
        <p className="t-1 text-axis-released">Enquiry received</p>
        <h3 className="t-6 mt-[13px] text-axis-ink">Thank you.</h3>
        <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">
          We answer specification, certificate and pricing enquiries directly, and will be in
          touch shortly.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="t-3 mt-[26px] text-axis-ink underline underline-offset-[4px]"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
      {/* Honeypot — hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-[20px] sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="name">
            Name
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
      </div>

      <div className="mt-[20px]">
        <label className={LABEL} htmlFor="organization">
          Institution or organisation <span className="normal-case">(optional)</span>
        </label>
        <input
          id="organization"
          name="organization"
          maxLength={160}
          autoComplete="organization"
          className={FIELD}
        />
      </div>

      <div className="mt-[20px]">
        <label className={LABEL} htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          placeholder="Which compound, what purity specification, and what quantity?"
          className={`${FIELD} resize-y`}
        />
      </div>

      {status === 'error' && (
        <p role="alert" className="t-3 mt-[20px] text-axis-rejected">
          {error}
        </p>
      )}

      <div className="mt-[26px]">
        <OrderButton disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send enquiry'}
        </OrderButton>
      </div>
    </form>
  );
}
