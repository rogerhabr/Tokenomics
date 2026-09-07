import type { Metadata } from 'next';
import Link from 'next/link';
import PolicyPage from '@/components/marketing/PolicyPage';

export const metadata: Metadata = {
  title: 'Shipping & Returns | Axis Labs',
  description:
    'How Axis Labs ships research compounds, what happens at customs, and the circumstances in which material can be returned or replaced.',
};

const SECTIONS = [
  {
    n: '01',
    title: 'Dispatch',
    body: [
      'Orders leave our US facility once payment against the invoice has cleared. Compounds requiring cold chain ship with appropriate packaging; storage conditions are stated on every compound page and on the vial.',
      'Domestic deliveries typically arrive within 2–5 business days. International transit times vary by destination and by customs handling, and we cannot guarantee a delivery date on any international shipment.',
    ],
  },
  {
    n: '02',
    title: 'Customs, duties and import',
    body: [
      'The purchaser is the importer of record. Duties, taxes, brokerage and any charges levied on import are the purchaser’s responsibility and are not included in the invoice unless stated on it.',
      'The purchaser is responsible for confirming that import and possession of a compound is lawful at the destination before ordering. We do not refund shipments detained or destroyed by a customs authority where the compound was not lawful to import.',
    ],
  },
  {
    n: '03',
    title: 'Damage and shortage in transit',
    body: [
      'Inspect the shipment on arrival. Tell us within seven days of delivery if material arrives damaged, if a cold-chain shipment arrives warm, or if the shipment is short against the packing list, and we will replace it.',
      'Keep the packaging and the vial. We will usually ask for a photograph of the outer carton, the cold-chain pack, and the vial label showing the lot code.',
    ],
  },
  {
    n: '04',
    title: 'Material outside specification',
    body: [
      'If independent analysis shows material we supplied falls below the release specification stated on its certificate, we will replace the lot or refund it. Send us your analytical report and the lot code from the vial.',
      'This is the substantive remedy this business offers, and it is why the lot code on the certificate must match the vial. If the two do not correspond, the material did not come from us and we want to know about it.',
    ],
  },
  {
    n: '05',
    title: 'Returns',
    body: [
      'Research chemicals cannot be restocked once they have left our control: we cannot evidence their storage history, and we will not resell material whose chain of custody we cannot account for. Orders are therefore not returnable for change of mind.',
      'An order can be cancelled at no cost at any point before dispatch. Since no payment is taken at the point of order, cancelling before the invoice is paid costs nothing at all.',
    ],
  },
];

export default function ShippingReturnsPage() {
  return (
    <PolicyPage
      rail="Policy"
      title="Shipping and returns."
      standfirst="How material reaches you, who carries the import obligations, and the two circumstances in which we replace a lot: damage in transit, and material that does not meet the specification on its certificate."
      sections={SECTIONS}
      footnote={
        <p className="t-3 text-axis-ink-500">
          To raise a shipping problem or a specification query,{' '}
          <Link href="/contact" className="text-axis-ink underline underline-offset-[4px]">
            contact us
          </Link>{' '}
          with your order reference and the lot code from the vial.
        </p>
      }
    />
  );
}
