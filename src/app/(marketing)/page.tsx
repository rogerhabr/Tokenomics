import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FlaskConical, FileCheck2, Truck, ShieldCheck } from 'lucide-react';
import { Button, Card, Container, Section, SectionTitle, StatBlock, ResearchNotice } from '@/components/marketing/ui';
import { CATEGORIES, PRODUCTS } from '@/lib/products';
import HelixMark from '@/components/marketing/HelixMark';

export const metadata: Metadata = {
  title: 'Axis Labs — Research Peptides at 99%+ Purity',
  description:
    'Axis Labs supplies third-party tested research peptides at 99%+ purity for neuroscience, metabolic, tissue repair, endocrine, and cosmetic research. Research use only.',
};

const PILLARS = [
  {
    icon: FileCheck2,
    title: 'Third-party tested, every batch',
    body: 'Each lot is independently assayed by an external analytical laboratory. Certificates of analysis are published against a batch code you can match to your vial.',
  },
  {
    icon: FlaskConical,
    title: '99%+ HPLC purity',
    body: 'We specify purity by HPLC and publish the chromatogram. Where a compound assays below our threshold, the lot does not ship.',
  },
  {
    icon: Truck,
    title: 'Shipped from the US',
    body: 'Orders leave our US facility with cold-chain packaging where the compound requires it. Domestic delivery typically lands in 2–5 business days.',
  },
  {
    icon: ShieldCheck,
    title: 'Research-first, always',
    body: 'We supply laboratories, universities, and independent researchers. Every listing is written for research context and nothing else.',
  },
];

const STATS = [
  { value: '99%+', label: 'HPLC purity specification' },
  { value: '100%', label: 'Batches third-party assayed' },
  { value: '2–5', label: 'Business days, US delivery' },
  { value: `${PRODUCTS.length}`, label: 'Compounds in catalogue' },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <div className="border-b border-axis-border bg-gradient-to-b from-axis-tint to-white">
        <Container className="py-16 sm:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-axis-blue">
                Advancing peptide research
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.08] tracking-tight text-axis-navy sm:text-[56px]">
                Research peptides you can actually verify.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-axis-muted">
                Axis Labs supplies third-party tested research peptides at 99%+ HPLC purity, with
                a certificate of analysis published for every batch. No unverifiable claims — just
                the assay, the chromatogram, and the batch code.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button href="/products">
                  Browse the catalogue
                  <ArrowRight size={16} className="ml-2" />
                </Button>
                <Button href="/quality" variant="secondary">
                  See our testing
                </Button>
              </div>
            </div>

            {/* Decorative helix panel */}
            <div className="relative hidden aspect-square items-center justify-center rounded-2xl border border-axis-border bg-white lg:flex">
              <HelixMark size={330} strokeWidth={2.9} idPrefix="axis-hero-helix" />
            </div>
          </div>
        </Container>
      </div>

      {/* Stats */}
      <div className="border-b border-axis-border bg-white">
        <Container className="py-12">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map((s) => (
              <StatBlock key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
        </Container>
      </div>

      {/* Research areas */}
      <Section className="bg-axis-surface">
        <SectionTitle
          eyebrow="Research areas"
          title="Six catalogues, one standard."
          lede="Every compound we list is held to the same purity specification and the same testing regime, whichever area it belongs to."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <Link key={c.id} href={`/products?category=${c.id}`} className="focus-ring rounded-xl">
              <Card className="h-full">
                <h3 className="text-lg font-bold text-axis-navy">{c.name}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-axis-muted">{c.blurb}</p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-axis-blue">
                  View compounds
                  <ArrowRight size={15} className="ml-1.5" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </Section>

      {/* Why Axis */}
      <Section>
        <SectionTitle
          eyebrow="Why Axis Labs"
          title="Verification, not assurances."
          lede="Purity claims are easy to make and hard to check. We built the process so you never have to take our word for it."
        />
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-axis-tint-strong">
                <Icon size={20} className="text-axis-blue" />
              </span>
              <div>
                <h3 className="text-base font-bold text-axis-navy">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-axis-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <div className="bg-axis-navy">
        <Container className="py-16 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Need a compound that is not listed?
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              We source and assay custom research peptides for laboratory and institutional
              programmes. Tell us the compound, the purity you need, and the quantity.
            </p>
            <div className="mt-8">
              <Button href="/contact" variant="onDark">
                Talk to our team
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </div>
          </div>
        </Container>
      </div>

      <Container className="py-12">
        <ResearchNotice />
      </Container>
    </>
  );
}
