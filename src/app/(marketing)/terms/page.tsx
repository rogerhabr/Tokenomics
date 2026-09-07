import type { Metadata } from 'next';
import Link from 'next/link';
import PolicyPage from '@/components/marketing/PolicyPage';
import { RELEASE_SPEC_PCT } from '@/lib/lots';

export const metadata: Metadata = {
  title: 'Terms of Sale | Axis Labs',
  description:
    'The terms on which Axis Labs supplies research compounds: order and invoice sequence, the warranty limited to the published lot figure, and the purchaser’s obligations.',
};

const SECTIONS = [
  {
    n: '01',
    title: 'What an order is',
    body: [
      'Placing an order on this site is an offer to buy, not a completed sale. No payment is taken here and no card details are handled by this site.',
      'A contract is formed when we accept your order by issuing an invoice. Before that point either side may withdraw at no cost. We may decline an order without giving a reason — see the prohibited use policy for the usual grounds.',
    ],
  },
  {
    n: '02',
    title: 'Price and payment',
    body: [
      'Prices shown on this site are recomputed from our own catalogue when an order is submitted, so the figure invoiced is our published price for the item and quantity ordered, whatever was displayed. Shipping, duties and any applicable taxes are stated on the invoice.',
      'We invoice against a purchase order or a proforma. Material is dispatched once payment has cleared.',
    ],
  },
  {
    n: '03',
    title: 'Condition of sale',
    body: [
      'Every sale is made on the condition that the material is for laboratory research and in vitro study only, and will not be administered to humans or animals or used in any clinical, diagnostic, therapeutic or veterinary application.',
      'Your research-use attestation at checkout is a term of the contract, not a formality. Supply is conditional on it being true, and it survives delivery.',
    ],
  },
  {
    n: '04',
    title: 'What we warrant',
    body: [
      `We warrant that material supplied conforms, at the time it leaves our facility, to the purity figure stated on the certificate of analysis issued for its lot, assayed against our ≥${RELEASE_SPEC_PCT.toFixed(
        1
      )}% release specification.`,
      'That is the whole of the express warranty, and it is deliberately the one thing we can evidence. We give no warranty of merchantability, no warranty of fitness for any particular purpose, and no warranty that a compound will produce any particular result in your work. No statement on this site, in correspondence, or in any datasheet extends it.',
      'Storage and handling after delivery are outside our control and outside the warranty.',
    ],
  },
  {
    n: '05',
    title: 'Remedy and liability',
    body: [
      'Where material does not conform to the certificate for its lot, we will replace the lot or refund what you paid for it, at our option. That is your exclusive remedy.',
      'We are not liable for indirect or consequential loss, including lost time, lost data, cost of repeating work, or loss of profit. Our aggregate liability arising from an order does not exceed the amount paid for that order. Nothing here limits liability that cannot lawfully be limited.',
    ],
  },
  {
    n: '06',
    title: 'The purchaser’s obligations',
    body: [
      'You are responsible for confirming that possession, import and use of a compound is lawful where you are; for your own position on any patent or regulatory restriction that applies to it; and for handling, storage and disposal under your institution’s protocols.',
      'You are the importer of record on international shipments. See shipping and returns.',
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      rail="Policy"
      title="Terms of sale."
      standfirst="Short, and specific about the one thing we will stand behind: that the material conforms to the certificate issued for its lot. Everything else on this page follows from that."
      sections={SECTIONS}
      footnote={
        <p className="t-3 text-axis-ink-500">
          The contracting entity, its registered address, and the governing law and jurisdiction
          for your territory are stated on the invoice for your order and confirmed on request.
          For anything unclear before you order,{' '}
          <Link href="/contact" className="text-axis-ink underline underline-offset-[4px]">
            ask us
          </Link>
          .
        </p>
      }
    />
  );
}
