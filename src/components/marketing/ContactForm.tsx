'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, Check } from 'lucide-react';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const FIELD =
  'w-full rounded-lg border border-axis-border bg-axis-ink px-3.5 py-2.5 text-sm text-axis-text placeholder:text-axis-faint outline-none transition-colors focus:border-axis-accent';
const LABEL = 'block text-xs font-medium uppercase tracking-[0.12em] text-axis-faint';

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
      setStatus('sent');
    } catch {
      setError('Could not reach the server. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-xl border border-axis-border bg-axis-card p-8">
        <Check size={22} className="text-axis-signal" />
        <h3 className="mt-4 text-lg font-semibold text-axis-text">Message received.</h3>
        <p className="mt-2 text-sm leading-relaxed text-axis-muted">
          Thank you — we read everything that comes in and will reply if a response is
          warranted.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="focus-ring mt-6 rounded-md text-sm text-axis-accent hover:text-axis-accent-hover"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-axis-border bg-axis-card p-8">
      {/* Honeypot — hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="name">
            Name
          </label>
          <input id="name" name="name" required maxLength={120} className={`mt-2 ${FIELD}`} />
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
            className={`mt-2 ${FIELD}`}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className={LABEL} htmlFor="organization">
          Organisation <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="organization"
          name="organization"
          maxLength={160}
          className={`mt-2 ${FIELD}`}
        />
      </div>

      <div className="mt-5">
        <label className={LABEL} htmlFor="message">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          className={`mt-2 resize-y ${FIELD}`}
        />
      </div>

      {status === 'error' && (
        <p role="alert" className="mt-5 text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="focus-ring mt-7 inline-flex items-center justify-center rounded-lg bg-axis-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-axis-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'sending' && <Loader2 size={16} className="mr-2 animate-spin" />}
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}
