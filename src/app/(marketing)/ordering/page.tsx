import type { Metadata } from 'next';
import {
  Container,
  PageHead,
  Section,
  SectionHead,
  ArrowLink,
  ResearchNotice,
} from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Ordering, Shipping and Documentation | Axis Labs',
  description:
    'How ordering works at Axis Labs: no payment is taken on the site, we confirm stock, allocate a lot, and invoice with the certificate of analysis. Shipping, storage and terms answered plainly.',
};

const SEQUENCE = [
  {
    n: '01',
    title: 'You place the order',
    body: 'Nothing is charged. The order is a request that records what you want, where it is going, and your research-use attestation.',
  },
  {
    n: '02',
    title: 'We confirm stock and allocate a lot',
    body: 'We check availability and assign the specific lot that will ship to you.',
  },
  {
    n: '03',
    title: 'We reply with an invoice and the certificate',
    body: 'You receive an itemised invoice with a payment link, and the certificate of analysis for the allocated lot — before you pay.',
  },
  {
    n: '04',
    title: 'Payment clears',
    body: 'Payment is handled off this site. We invoice against a purchase order or a proforma.',
  },
  {
    n: '05',
    title: 'Dispatch',
    body: 'Material leaves our US facility with cold-chain packaging where the compound requires it.',
  },
];

const GROUPS = [
  {
    title: 'Quality and testing',
    items: [
      {
        q: 'Who performs your purity testing?',
        a: 'An independent external analytical laboratory. We do not self-certify, because a purity figure issued by the party selling the material is not independent evidence.',
      },
      {
        q: 'Can I see the certificate of analysis before ordering?',
        a: 'Yes. Tell us which compound you are looking at and we will send the current batch certificate. We would rather you verify first.',
      },
      {
        q: 'What does the release specification mean?',
        a: 'It is the purity threshold a lot must meet, established by HPLC on that specific lot and stated on its certificate. Molecular identity is separately confirmed by mass spectrometry, so the figure describes the correct molecule.',
      },
      {
        q: 'What happens if a batch fails specification?',
        a: 'It is rejected. We do not reprice or reclassify out-of-specification material into a lower tier — there is only one standard, and failures are recorded in the lot register alongside releases.',
      },
    ],
  },
  {
    title: 'Ordering and payment',
    items: [
      {
        q: 'Why does the site not take payment?',
        a: 'Because an order here is a request, not a transaction. We confirm stock and allocate a lot first, then invoice against a purchase order or a proforma. No card details are handled by this site.',
      },
      {
        q: 'Who can order from Axis Labs?',
        a: 'We supply laboratories, universities, research institutions and independent researchers purchasing for legitimate research purposes. Purchasers are responsible for compliance with the law and institutional policy in their jurisdiction.',
      },
      {
        q: 'Do you supply compounds that are not in the register?',
        a: 'Often, yes. Send us the compound, the purity specification and the quantity, and we will tell you whether we can source and assay it — including when the answer is no.',
      },
      {
        q: 'Do you handle institutional purchase orders?',
        a: 'Yes. Tell us your procurement requirements and we will supply the documentation your institution needs.',
      },
    ],
  },
  {
    title: 'Shipping, storage and handling',
    items: [
      {
        q: 'How long does delivery take?',
        a: 'Orders ship from our US facility. Domestic deliveries typically arrive within 2–5 business days; international transit times vary by destination and customs handling.',
      },
      {
        q: 'How is material packaged?',
        a: 'As sealed vials of lyophilised powder, with cold-chain packaging where the compound requires it. Storage conditions are stated on each compound page.',
      },
      {
        q: 'How should material be stored?',
        a: 'Storage conditions are specified per compound and printed on the vial. In general, lyophilised material is held at -20 °C and protected from light.',
      },
      {
        q: 'Do you provide reconstitution or usage protocols?',
        a: 'No. Handling, reconstitution and disposal are the responsibility of the receiving laboratory and should follow your own established protocols for research materials.',
      },
      {
        q: 'What does "research use only" actually mean?',
        a: 'Our products are supplied strictly for laboratory research and in vitro study. They are not drugs, foods, cosmetics or medical devices, and are not for human or veterinary consumption, clinical use, or diagnostic application.',
      },
    ],
  },
];

export default function OrderingPage() {
  return (
    <>
      <PageHead
        index="01"
        rail="Ordering"
        title="Ordering, shipping and documentation."
        standfirst="No payment is taken on this site. An order is a request — we confirm stock, allocate a lot, and send you an invoice and the certificate before anything is paid."
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <SectionHead index="02" rail="Sequence" title="What happens after you order." />
          <ol className="mt-[39px] border-t border-axis-rule-2">
            {SEQUENCE.map((s) => (
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
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <SectionHead index="03" rail="Questions" title="Answered plainly." />
          <div className="mt-[39px] space-y-[52px]">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="t-1 border-b border-axis-rule-3 pb-[10px] text-axis-ink-300">
                  {group.title}
                </h3>
                <dl>
                  {group.items.map((item) => (
                    <div key={item.q} className="border-b border-axis-rule-1 py-[20px]">
                      <dt className="t-4 text-axis-ink">{item.q}</dt>
                      <dd className="t-3 mt-[8px] max-w-measure text-axis-ink-500">{item.a}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="mt-[39px] flex flex-wrap gap-[26px]">
            <ArrowLink href="/contact">Ask something not covered here</ArrowLink>
            <ArrowLink href="/prohibited-use">Prohibited use policy</ArrowLink>
          </div>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
