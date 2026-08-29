import type { Metadata } from 'next';
import { Button, Container, Section, PageHero, ResearchNotice } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'FAQ — Quality, Shipping & Ordering | Axis Labs',
  description:
    'Answers to common questions about Axis Labs research peptides: purity testing, certificates of analysis, storage, shipping, and research-use-only terms.',
};

const GROUPS = [
  {
    title: 'Quality & testing',
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
        q: 'What does 99%+ purity mean here?',
        a: 'It is the purity established by HPLC on the specific lot, stated on that lot certificate. Molecular identity is separately confirmed by mass spectrometry, so the figure describes the correct molecule.',
      },
      {
        q: 'What happens if a batch fails specification?',
        a: 'It is rejected. We do not reprice or reclassify out-of-specification material into a lower tier — there is only one standard.',
      },
    ],
  },
  {
    title: 'Ordering & shipping',
    items: [
      {
        q: 'Who can order from Axis Labs?',
        a: 'We supply laboratories, universities, research institutions, and independent researchers purchasing for legitimate research purposes. Purchasers are responsible for compliance with the law and institutional policy in their jurisdiction.',
      },
      {
        q: 'How long does delivery take?',
        a: 'Orders ship from our US facility. Domestic deliveries typically arrive within 2–5 business days; international transit times vary by destination and customs handling.',
      },
      {
        q: 'How is material packaged?',
        a: 'As sealed vials of lyophilised powder, with cold-chain packaging where the compound requires it. Storage conditions are stated on each product page.',
      },
      {
        q: 'Do you supply compounds that are not in the catalogue?',
        a: 'Often, yes. Send us the compound, the purity specification, and the quantity, and we will tell you whether we can source and assay it.',
      },
    ],
  },
  {
    title: 'Handling & terms',
    items: [
      {
        q: 'How should material be stored?',
        a: 'Storage conditions are specified per compound and printed on the vial. In general, lyophilised material is held at -20 °C and protected from light.',
      },
      {
        q: 'Do you provide reconstitution or usage protocols?',
        a: 'No. Handling, reconstitution, and disposal are the responsibility of the receiving laboratory and should follow your own established protocols for research materials.',
      },
      {
        q: 'What does "research use only" actually mean?',
        a: 'Our products are supplied strictly for laboratory research and in vitro study. They are not drugs, foods, cosmetics, or medical devices, and are not for human or veterinary consumption, clinical use, or diagnostic application.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Common questions."
        lede="Quality, ordering, and handling — answered plainly. If something is not covered here, ask us directly."
      />

      <Section>
        <div className="max-w-3xl space-y-14">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="border-b border-axis-border pb-3 text-xs font-bold uppercase tracking-[0.14em] text-axis-blue">
                {group.title}
              </h2>
              <dl className="mt-6 space-y-7">
                {group.items.map((item) => (
                  <div key={item.q}>
                    <dt className="text-lg font-bold leading-snug text-axis-navy">{item.q}</dt>
                    <dd className="mt-2.5 text-[15px] leading-relaxed text-axis-muted">{item.a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-6 rounded-2xl border border-axis-border bg-axis-tint p-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-axis-navy">
              Still have a question?
            </h2>
            <p className="mt-2 text-sm text-axis-muted">
              Specification and testing questions get a direct answer.
            </p>
          </div>
          <Button href="/contact">Contact us</Button>
        </div>

        <ResearchNotice className="mt-12" />
      </Section>
    </>
  );
}
