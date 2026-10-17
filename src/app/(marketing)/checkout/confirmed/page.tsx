import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Container,
  PageHead,
  Section,
  Rule,
  ArrowLink,
  ResearchNotice,
} from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Order received — Axis Labs',
  description: 'Your Axis Labs research compound order has been received.',
};

const NEXT_STEPS = [
  {
    n: '01',
    title: 'Stock and lot allocation',
    body: 'We confirm availability and assign the specific lot that will ship against your order.',
  },
  {
    n: '02',
    title: 'Invoice',
    body: 'You receive an itemised invoice with a payment link. No card details were collected on this site.',
  },
  {
    n: '03',
    title: 'Certificate of analysis',
    body: 'The certificate for your allocated lot is sent with the invoice, before payment, so you can verify the material first.',
  },
  {
    n: '04',
    title: 'Dispatch',
    body: 'Once payment clears, the order ships from our US facility with cold-chain packaging where the compound requires it.',
  },
];

export default function OrderConfirmedPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  // Echoed from the API response rather than read back from the database —
  // anon has no select grant on orders, by design.
  const reference = typeof searchParams.ref === 'string' ? searchParams.ref.slice(0, 32) : '';

  return (
    <>
      <PageHead
        index="01"
        rail="Order received"
        title="Order received."
        standfirst="Nothing has been charged. We will reply by email with an itemised invoice and the certificate of analysis for your allocated lot."
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          {reference && (
            <div className="border-y border-axis-rule-2 py-[39px]">
              <p className="t-1 text-axis-ink-300">Your reference</p>
              {/* Selectable, at display size, in mono — this is the string the
                  buyer quotes back to us, so it has to be easy to read and
                  copy from a phone. */}
              <p className="data t-7 ident mt-[13px] select-all text-axis-ink">{reference}</p>
              <Rule className="mt-[20px]" />
              <p className="t-3 mt-[20px] max-w-measure text-axis-ink-500">
                Quote this reference in any correspondence about the order.
              </p>
            </div>
          )}

          <h2 className="t-1 mt-[52px] text-axis-ink-300">What happens next</h2>
          <ol className="mt-[20px] border-t border-axis-rule-2">
            {NEXT_STEPS.map((s) => (
              <li
                key={s.n}
                className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px] border-b border-axis-rule-1 py-[20px]"
              >
                <span className="t-1 pt-[4px] text-axis-ink-300">{s.n}</span>
                <div>
                  <h3 className="t-4 text-axis-ink">{s.title}</h3>
                  <p className="t-3 mt-[6px] max-w-measure text-axis-ink-500">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-[39px] flex flex-wrap gap-[26px]">
            <ArrowLink href="/products">Back to the register</ArrowLink>
            <ArrowLink href="/contact">Contact the team</ArrowLink>
          </div>

          <p className="t-2 mt-[39px] text-axis-ink-300">
            Did not receive an email?{' '}
            <Link href="/contact" className="text-axis-ink underline underline-offset-[4px]">
              Tell us
            </Link>{' '}
            and quote your reference.
          </p>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
