import type { Metadata } from 'next';
import { Button, Container, Section, SectionTitle, PageHero, StatBlock, ResearchNotice } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'About Axis Labs — Verified Research Peptide Supplier',
  description:
    'Axis Labs was founded to fix the verification problem in research peptides: independent testing on every batch, published certificates, and honest specifications.',
};

const VALUES = [
  {
    n: '01',
    title: 'Evidence over adjectives',
    body: 'Words like premium and pharmaceutical-grade mean nothing without an assay behind them. We publish the certificate and let it speak.',
  },
  {
    n: '02',
    title: 'One specification, no tiers',
    body: 'We do not run a budget line alongside a premium line. There is a single purity standard, and material that misses it is rejected rather than repriced.',
  },
  {
    n: '03',
    title: 'Say what we do not know',
    body: 'Where a specification comes from the certificate rather than our own claim, the product page says so. Blank is more useful than invented.',
  },
  {
    n: '04',
    title: 'Research context, always',
    body: 'Every listing is written for laboratory use. We do not publish dosing guidance, human-use suggestions, or anything that reads as clinical advice.',
  },
];

const FACTS = [
  { value: '99%+', label: 'Single purity standard' },
  { value: 'US', label: 'Fulfilment facility' },
  { value: '100%', label: 'Batches independently assayed' },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Built around one unglamorous problem: verification."
        lede="Axis Labs exists because researchers routinely cannot confirm what is in the vial they just bought. Purity claims are printed without evidence, batch codes lead nowhere, and certificates — when they exist at all — cannot be matched to the material."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <SectionTitle eyebrow="Our story" title="Why we started." />
            <div className="mt-8 space-y-5 text-base leading-relaxed text-axis-muted">
              <p>
                The research peptide market has a structural honesty problem. Purity is the entire
                basis on which a compound is selected, and it is also the one property a buyer
                cannot assess by looking. That gap invites exactly the behaviour you would expect:
                confident numbers printed on labels, with nothing standing behind them.
              </p>
              <p>
                For a researcher this is not an inconvenience, it is a contaminated result. An
                experiment run on material that is 87% pure when the label said 99% does not fail
                loudly. It produces a number that looks plausible and is quietly wrong, and the
                error is usually discovered — if at all — long after the work has been built on.
              </p>
              <p>
                Axis Labs was founded to close that gap procedurally rather than by asking for
                trust. Every lot we sell is assayed by an independent laboratory that has no stake
                in the result. The certificate carries a batch code that matches the vial. If our
                material does not meet specification, the certificate says so and the lot does not
                ship.
              </p>
              <p>
                That is the whole proposition. We are not asking anyone to believe our purity
                claims. We are handing over the evidence and inviting the check.
              </p>
            </div>
          </div>

          <div className="space-y-10 lg:pt-24">
            {FACTS.map((f) => (
              <StatBlock key={f.label} value={f.value} label={f.label} />
            ))}
          </div>
        </div>
      </Section>

      <div className="border-y border-axis-border bg-axis-surface">
        <Section id="principles">
          <SectionTitle
            eyebrow="Principles"
            title="Four rules we hold to."
            lede="These occasionally cost us a sale. That is the point of having them."
          />
          <div className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.n} className="flex gap-5">
                <span className="text-sm font-bold text-axis-blue">{v.n}</span>
                <div>
                  <h3 className="text-base font-bold text-axis-navy">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{v.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-axis-border bg-axis-tint p-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-axis-navy">
              Questions about our process?
            </h2>
            <p className="mt-2 text-sm text-axis-muted">
              We answer specification and testing questions directly.
            </p>
          </div>
          <Button href="/contact">Get in touch</Button>
        </div>

        <ResearchNotice className="mt-12" />
      </Section>
    </>
  );
}
