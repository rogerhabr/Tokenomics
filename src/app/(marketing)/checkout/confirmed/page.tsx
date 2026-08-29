import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Container, ResearchNotice } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Order received — Axis Labs',
  description: 'Your Axis Labs research compound order has been received.',
};

const NEXT_STEPS = [
  {
    n: '01',
    title: 'Stock and batch confirmation',
    body: 'We confirm availability and identify the batch that will ship against your order.',
  },
  {
    n: '02',
    title: 'Invoice and payment link',
    body: 'You receive an invoice with a secure payment link. No card details were collected on this site.',
  },
  {
    n: '03',
    title: 'Certificate of analysis',
    body: 'The certificate for your specific batch is sent with the invoice, before payment, so you can verify the material first.',
  },
  {
    n: '04',
    title: 'Dispatch',
    body: 'Once payment clears, the order ships from our US facility with cold-chain packaging where required.',
  },
];

export default function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  // The reference is echoed from the API response rather than read back from
  // the database — anon has no select grant on orders by design.
  const reference = typeof searchParams.ref === 'string' ? searchParams.ref.slice(0, 32) : '';

  return (
    <Container className="py-20">
      <div className="mx-auto max-w-2xl text-center">
        <CheckCircle2 size={44} className="mx-auto text-axis-signal" />
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-axis-navy">Order received.</h1>
        {reference && (
          <p className="mt-4 text-base text-axis-muted">
            Your reference is{' '}
            <span className="font-bold tracking-wide text-axis-navy">{reference}</span>. Quote it in
            any correspondence about this order.
          </p>
        )}
        <p className="mt-4 text-base leading-relaxed text-axis-muted">
          A confirmation is on its way to the email address you gave us. Nothing has been charged.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-axis-blue">
          What happens next
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          {NEXT_STEPS.map((s) => (
            <div key={s.n} className="flex gap-4">
              <span className="text-sm font-bold text-axis-blue">{s.n}</span>
              <div>
                <h3 className="text-base font-bold text-axis-navy">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-axis-muted">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link
            href="/products"
            className="focus-ring rounded-lg bg-axis-blue px-5 py-3 text-sm font-semibold text-white hover:bg-axis-blue-hover"
          >
            Continue shopping
          </Link>
          <Link
            href="/contact"
            className="focus-ring rounded-lg border border-axis-border-strong px-5 py-3 text-sm font-semibold text-axis-navy hover:border-axis-blue hover:text-axis-blue"
          >
            Question about this order
          </Link>
        </div>

        <ResearchNotice className="mt-14" />
      </div>
    </Container>
  );
}
