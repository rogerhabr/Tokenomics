import type { Metadata } from 'next';
import {
  Container,
  PageHead,
  Section,
  SectionHead,
  Rail,
  ArrowLink,
  ResearchNotice,
} from '@/components/marketing/ui';
import { RELEASE_SPEC_PCT } from '@/lib/lots';
import { getContent, text } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Release Specification & Method | Axis Labs',
  description:
    'How Axis Labs releases a lot: independent HPLC assay against a ≥99.0% release specification, mass spectrometry identity confirmation, and a certificate carrying the batch code.',
};

const STEPS = [
  {
    n: '01',
    title: 'Raw material qualification',
    body: 'A synthesis run starts from material qualified against our own specification. Suppliers who cannot evidence consistency do not stay on the list.',
  },
  {
    n: '02',
    title: 'Independent assay',
    body: 'The finished lot goes to an external analytical laboratory. We do not self-certify, because a purity figure issued by the party selling the vial is not independent evidence.',
  },
  {
    n: '03',
    title: 'Release decision',
    body: `The lot is measured against the ${RELEASE_SPEC_PCT.toFixed(1)}% release specification. Above it, the lot is released. Below it, the lot is not sold — it is not repriced, reclassified, or moved to a second line.`,
  },
  {
    n: '04',
    title: 'Batch-matched dispatch',
    body: 'The batch code on the certificate matches the code on the vial. If the two do not correspond, the material is not ours and we want to know about it.',
  },
];

const CHECKS = [
  {
    n: '01',
    title: 'HPLC purity',
    body: 'High-performance liquid chromatography establishes the purity percentage on the specific lot. This is the figure the release decision is made on.',
  },
  {
    n: '02',
    title: 'Mass spectrometry',
    body: 'Confirms molecular identity and mass, so purity is verified against the right molecule rather than a well-purified wrong one.',
  },
  {
    n: '03',
    title: 'Cold-chain integrity',
    body: 'Compounds that require it ship with appropriate cold packaging. Storage conditions are stated on every compound page and repeated on the vial.',
  },
  {
    n: '04',
    title: 'Batch traceability',
    body: 'Every vial traces to a lot and every lot to a certificate. Records are retained so a result can be reconciled long after the material has been used.',
  },
];

export default async function QualityPage() {
  const copy = await getContent();
  return (
    <>
      <PageHead
        index="01"
        rail="Specification"
        title={text(copy, 'quality.title')}
        standfirst={text(copy, 'quality.standfirst')}
      />

      {/* The counter-form: the specification at scale, on its own line. */}
      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <Rail label="Release specification" index="02">
            <div className="border-y border-axis-rule-2 py-[39px]">
              <p className="t-8 text-axis-ink">≥{RELEASE_SPEC_PCT.toFixed(1)}%</p>
              <div className="spec-rule draw mt-[13px]" />
              <p className="t-3 mt-[20px] max-w-measure text-axis-ink-500">
                Purity by HPLC, established on the specific lot by an external laboratory and
                stated on that lot&rsquo;s certificate. Molecular identity is separately confirmed
                by mass spectrometry, so the figure describes the correct molecule.
              </p>
            </div>
          </Rail>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <SectionHead
            index="03"
            rail="Method"
            title="From raw material to your bench."
            standfirst="Four checkpoints, each of which a lot must clear before it is allowed to ship."
          />
          <div className="mt-[39px] grid gap-x-[52px] gap-y-[39px] lg:grid-cols-2">
            {STEPS.map((s) => (
              <div key={s.n} className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px]">
                <span className="t-1 pt-[4px] text-axis-ink-300">{s.n}</span>
                <div>
                  <h3 className="t-4 text-axis-ink">{s.title}</h3>
                  <p className="t-3 mt-[8px] text-axis-ink-500">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <SectionHead index="04" rail="Tests" title="What is measured on every lot." />
          <div className="mt-[39px] grid gap-x-[52px] gap-y-[39px] lg:grid-cols-2">
            {CHECKS.map((c) => (
              <div key={c.n} className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px]">
                <span className="t-1 pt-[4px] text-axis-ink-300">{c.n}</span>
                <div>
                  <h3 className="t-4 text-axis-ink">{c.title}</h3>
                  <p className="t-3 mt-[8px] text-axis-ink-500">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <div className="bg-[#101215] text-[#eae7e0]">
        <Container className="py-[78px] lg:py-[104px]">
          <div className="max-w-[46ch]">
            <p className="t-1 text-[#9ca0a7]">05 — Verification</p>
            <h2 className="t-6 mt-[20px] text-[#eae7e0]">
              Ask for the certificate before you order.
            </h2>
            <p className="t-3 mt-[20px] text-[#9ca0a7]">
              Tell us the compound and we will send the current batch certificate of analysis. We
              would rather you check the paperwork first than take the claim on trust.
            </p>
            <a
              href="/contact"
              className="t-3 mt-[39px] inline-flex min-h-[44px] items-center gap-[8px] rounded-plate border border-[#606570] px-[20px] text-[#eae7e0] transition-colors duration-[--dur-1] hover:bg-[#1a1d22]"
            >
              Request a certificate of analysis
              <span aria-hidden="true" className="data">
                →
              </span>
            </a>
          </div>
        </Container>
      </div>

      <Section>
        <Container>
          <ArrowLink href="/lots">See the lot register</ArrowLink>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
