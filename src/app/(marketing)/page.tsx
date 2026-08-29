import type { Metadata } from 'next';
import {
  Container,
  Section,
  PageHead,
  SectionHead,
  Rail,
  Rule,
  ArrowLink,
  HairlineLink,
  ResearchNotice,
} from '@/components/marketing/ui';
import { RegisterExtract } from '@/components/marketing/Register';
import PurityPlot from '@/components/marketing/PurityPlot';
import { PRODUCTS } from '@/lib/products';
import { getAllLots, summarise, RELEASE_SPEC_PCT } from '@/lib/lots';

export const metadata: Metadata = {
  title: 'Axis Labs — Research Compounds, Assayed Against a Published Specification',
  description:
    'Axis Labs supplies research compounds for laboratory and in vitro study. Every lot is assayed by an independent laboratory against a ≥99.0% release specification, and the record is published.',
};

// The register is read at request time but changes rarely; an hour of cache
// keeps the home page fast without letting a newly published lot go unseen for
// long.
export const revalidate = 3600;

const METHOD = [
  {
    n: '01',
    title: 'Independent assay',
    body: 'Every finished lot goes to an external analytical laboratory. We do not self-certify, because a purity figure issued by the party selling the vial is not evidence.',
  },
  {
    n: '02',
    title: 'One specification',
    body: `A lot either meets the ${RELEASE_SPEC_PCT.toFixed(1)}% release specification or it does not ship. There is no second line, no downgrade tier, and no repricing of out-of-specification material.`,
  },
  {
    n: '03',
    title: 'Identity, not just purity',
    body: 'Mass spectrometry confirms the molecule before purity means anything. A well-purified wrong compound is still a wrong compound.',
  },
  {
    n: '04',
    title: 'The record is published',
    body: 'Assays are recorded against a lot code you can match to the vial. Rejections are recorded in the same register as releases.',
  },
];

export default async function HomePage() {
  const { lots, available } = await getAllLots();
  const counts = summarise(lots);

  return (
    <>
      <PageHead
        index="01"
        rail="Axis Labs"
        title="Purity you can check, not purity we assert."
        standfirst="Axis Labs supplies research compounds for laboratory and in vitro study. Every lot is assayed by an independent laboratory against a release specification you can see, and the result is recorded whether it passes or fails."
      >
        <div className="mt-[26px] flex flex-wrap gap-[13px]">
          <HairlineLink href="/products">Browse the register</HairlineLink>
          <HairlineLink href="/quality">How a lot is released</HairlineLink>
        </div>
      </PageHead>

      {/* The counter-form. One non-list object at scale: the release
          specification itself, drawn against the line the whole site is
          measured against. This is a statement of the standard we hold, not a
          claim about any particular batch. */}
      <Section>
        <Container>
          <Rail label="Release specification" index="02">
            <div className="border-y border-axis-rule-2 py-[39px]">
              <p className="t-8 text-axis-ink">≥{RELEASE_SPEC_PCT.toFixed(1)}%</p>
              <div className="spec-rule draw mt-[13px]" />
              <p className="t-3 mt-[20px] max-w-measure text-axis-ink-500">
                Purity by high-performance liquid chromatography, established on the specific lot
                by an external laboratory. This is the number every assay on this site is drawn
                against — above the line a lot is released, below it a lot is not sold.
              </p>
            </div>
          </Rail>
        </Container>
      </Section>

      {/* The register extract. Real catalogue data, no invented figures. */}
      <Section className="pt-0">
        <Container>
          <SectionHead
            index="03"
            rail="Catalogue"
            title={`${PRODUCTS.length} compounds, one standard.`}
            standfirst="Every compound is supplied as a lyophilised powder and held to the same specification, whichever research class it belongs to."
          />
          <div className="mt-[39px]">
            <RegisterExtract products={PRODUCTS.slice(0, 8)} />
          </div>
          <div className="mt-[26px]">
            <ArrowLink href="/products">
              All {PRODUCTS.length} compounds, with mass and rate
            </ArrowLink>
          </div>
        </Container>
      </Section>

      {/* The lot register. Renders an honest empty state until real records
          are loaded — never a placeholder curve or a designed example. */}
      <Section className="pt-0">
        <Container>
          <SectionHead
            index="04"
            rail="Lot records"
            title="Every assay, including the failures."
            standfirst="A supplier who only publishes the lots that passed has published nothing. The register carries releases, retentions and rejections in the same table."
          />

          <div className="mt-[39px]">
            <PurityPlot lots={lots} scope="the catalogue" />
          </div>

          {available && counts.assayed > 0 ? (
            <dl className="mt-[26px] grid gap-[26px] sm:grid-cols-3">
              <div>
                <dt className="t-1 text-axis-ink-300">Lots assayed</dt>
                <dd className="data t-6 mt-[4px] text-axis-ink">{counts.assayed}</dd>
              </div>
              <div>
                <dt className="t-1 text-axis-ink-300">Released</dt>
                <dd className="data t-6 mt-[4px] text-axis-ink">{counts.released}</dd>
              </div>
              <div>
                <dt className="t-1 text-axis-ink-300">Rejected</dt>
                <dd className="data t-6 mt-[4px] text-axis-ink">{counts.rejected}</dd>
              </div>
            </dl>
          ) : (
            <p className="t-3 mt-[26px] max-w-measure text-axis-ink-500">
              The public register is not yet populated. Certificates of analysis are supplied with
              every order and available on request before you order — ask us for the current batch
              certificate on any compound.
            </p>
          )}

          <div className="mt-[26px]">
            <ArrowLink href="/lots">Open the lot register</ArrowLink>
          </div>
        </Container>
      </Section>

      {/* Method. Numbered marginalia rather than icons in tinted squares. */}
      <Section className="pt-0">
        <Container>
          <SectionHead index="05" rail="Method" title="How a lot is released." />
          <div className="mt-[39px] grid gap-x-[52px] gap-y-[39px] lg:grid-cols-2">
            {METHOD.map((m) => (
              <div key={m.n} className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px]">
                <span className="t-1 pt-[4px] text-axis-ink-300">{m.n}</span>
                <div>
                  <h3 className="t-4 text-axis-ink">{m.title}</h3>
                  <p className="t-3 mt-[8px] text-axis-ink-500">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      {/* Ink band — one of two full-bleed dark registers on this page. */}
      <div className="bg-[#101215] text-[#eae7e0]">
        <Container className="py-[78px] lg:py-[104px]">
          <div className="max-w-[46ch]">
            <p className="t-1 text-[#9ca0a7]">06 — Custom sourcing</p>
            <h2 className="t-6 mt-[20px] text-[#eae7e0]">
              Need a compound that is not in the register?
            </h2>
            <p className="t-3 mt-[20px] text-[#9ca0a7]">
              Tell us the molecule, the purity specification and the quantity. We will tell you
              whether we can source and assay it, and what the lead time is — including when the
              answer is no.
            </p>
            <div className="mt-[39px]">
              <Rule />
              <a
                href="/contact"
                className="t-3 mt-[20px] inline-flex min-h-[44px] items-center gap-[8px] rounded-plate border border-[#606570] px-[20px] text-[#eae7e0] transition-colors duration-[--dur-1] hover:bg-[#1a1d22]"
              >
                Send a sourcing enquiry
                <span aria-hidden="true" className="data">
                  →
                </span>
              </a>
            </div>
          </div>
        </Container>
      </div>

      <ResearchNotice />
    </>
  );
}
