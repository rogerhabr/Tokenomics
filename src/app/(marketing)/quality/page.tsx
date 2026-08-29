import type { Metadata } from 'next';
import { FlaskConical, FileCheck2, PackageCheck, Snowflake, ScrollText, Microscope } from 'lucide-react';
import { Button, Card, Container, Section, SectionTitle, PageHero, ResearchNotice } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Quality & Testing — Verified Purity | Axis Labs',
  description:
    'How Axis Labs verifies every batch: independent third-party HPLC and mass spectrometry analysis, published certificates of analysis, and batch-level traceability.',
};

const STEPS = [
  {
    n: '01',
    icon: Microscope,
    title: 'Raw material qualification',
    body: 'Every synthesis run starts from material that has been qualified against our own specification. Suppliers who cannot evidence consistency do not stay on the list.',
  },
  {
    n: '02',
    icon: FlaskConical,
    title: 'Independent assay',
    body: 'Each finished lot is sent to an external analytical laboratory. We do not self-certify purity, because a purity claim from the party selling the vial is not evidence.',
  },
  {
    n: '03',
    icon: FileCheck2,
    title: 'Certificate of analysis',
    body: 'The lab issues a certificate carrying the batch code, the HPLC chromatogram, and the mass spectrometry result. It is supplied with your order and available on request at any time.',
  },
  {
    n: '04',
    icon: PackageCheck,
    title: 'Batch-matched dispatch',
    body: 'The batch code on the certificate matches the code on your vial. If the two do not correspond, the material is not ours and we want to know about it.',
  },
];

const CHECKS = [
  {
    icon: FlaskConical,
    title: 'HPLC purity',
    body: 'High-performance liquid chromatography establishes the purity percentage. Our specification is 99%+; lots that assay below threshold are rejected rather than downgraded.',
  },
  {
    icon: Microscope,
    title: 'Mass spectrometry',
    body: 'Confirms molecular identity and weight, so purity is verified against the right molecule rather than a well-purified wrong one.',
  },
  {
    icon: Snowflake,
    title: 'Cold-chain integrity',
    body: 'Compounds that require it ship with appropriate cold packaging. Storage conditions are stated on every product page and repeated on the vial.',
  },
  {
    icon: ScrollText,
    title: 'Batch traceability',
    body: 'Every vial traces to a lot, and every lot to a certificate. Records are retained so a result can be reconciled long after the material has been used.',
  },
];

export default function QualityPage() {
  return (
    <>
      <PageHero
        eyebrow="Quality"
        title="Every batch tested by someone other than us."
        lede="The research peptide market runs on unverifiable purity claims. Our answer is procedural rather than rhetorical: independent assay on every lot, a published certificate, and a batch code you can match to the vial in your hand."
      />

      <Section>
        <SectionTitle
          eyebrow="Process"
          title="From raw material to your bench."
          lede="Four checkpoints, each of which a lot must clear before it is allowed to ship."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {STEPS.map(({ n, icon: Icon, title, body }) => (
            <Card key={n}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-axis-tint-strong">
                  <Icon size={19} className="text-axis-blue" />
                </span>
                <span className="text-sm font-bold text-axis-blue">{n}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-axis-navy">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-axis-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="border-y border-axis-border bg-axis-surface">
        <Section>
          <SectionTitle eyebrow="What we test for" title="Four checks on every lot." />
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {CHECKS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-5">
                <Icon size={22} className="mt-0.5 shrink-0 text-axis-blue" />
                <div>
                  <h3 className="text-base font-bold text-axis-navy">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <div className="rounded-2xl border border-axis-border bg-axis-tint p-10 sm:p-14">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-axis-navy">
              Want the certificate before you order?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-axis-muted">
              Send us the compound and we will return the current batch certificate of analysis.
              We would rather you check the paperwork first than take the claim on trust.
            </p>
            <div className="mt-8">
              <Button href="/contact">Request a certificate of analysis</Button>
            </div>
          </div>
        </div>

        <ResearchNotice className="mt-12" />
      </Section>
    </>
  );
}
