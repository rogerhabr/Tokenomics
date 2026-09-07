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
  title: 'About Axis Labs — Verification, Not Assurances',
  description:
    'Axis Labs exists to close the verification gap in research compounds: independent assay on every lot, a published release specification, and honest specifications.',
};

const PRINCIPLES = [
  {
    n: '01',
    title: 'Evidence over adjectives',
    body: 'Words like premium and pharmaceutical-grade mean nothing without an assay behind them. We publish the number and let it speak.',
  },
  {
    n: '02',
    title: 'One specification, no tiers',
    body: 'We do not run a budget line alongside a premium line. There is a single release specification, and material that misses it is rejected rather than repriced.',
  },
  {
    n: '03',
    title: 'Say what we do not know',
    body: 'Where a value comes from a public registry rather than our own certificate, the page says so — and where we cannot confirm a field at all, it prints as unconfirmed. Blank is more useful than invented.',
  },
  {
    n: '04',
    title: 'Research context, always',
    body: 'Every listing is written for laboratory use. We do not publish dosing guidance, reconstitution protocols, human-use suggestions, or anything that reads as clinical advice.',
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHead
        index="01"
        rail="About"
        title="Built around one unglamorous problem: verification."
        standfirst="Researchers routinely cannot confirm what is in the vial they just bought. Purity claims are printed without evidence, batch codes lead nowhere, and certificates — when they exist at all — cannot be matched to the material."
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <div className="grid gap-[52px] lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-[78px]">
            <div className="prose-measure space-y-[26px]">
              <p className="t-4 text-axis-ink-500">
                The research compound market has a structural honesty problem. Purity is the entire
                basis on which a compound is selected, and it is also the one property a buyer
                cannot assess by looking. That gap invites exactly the behaviour you would expect:
                confident numbers printed on labels, with nothing standing behind them.
              </p>
              <p className="t-4 text-axis-ink-500">
                For a researcher this is not an inconvenience, it is a contaminated result. An
                experiment run on material that is 87% pure when the label said 99% does not fail
                loudly. It produces a number that looks plausible and is quietly wrong, and the
                error is usually discovered — if at all — long after the work has been built on it.
              </p>
              <p className="t-4 text-axis-ink-500">
                Axis Labs was founded to close that gap procedurally rather than by asking for
                trust. Every lot we sell is assayed by an independent laboratory that has no stake
                in the result. The certificate carries a batch code that matches the vial. If
                material does not meet specification, the certificate says so and the lot does not
                ship.
              </p>
              <p className="t-4 text-axis-ink">
                That is the whole proposition. We are not asking anyone to believe our purity
                claims. We are handing over the evidence and inviting the check.
              </p>
            </div>

            <aside className="lg:pt-[26px]">
              <div className="border-y border-axis-rule-2 py-[26px]">
                <p className="t-1 text-axis-ink-300">The check</p>
                <p className="t-3 mt-[13px] text-axis-ink-500">
                  Every assay we publish appears in the lot register, including the lots that
                  failed specification and were never sold.
                </p>
                <div className="mt-[20px]">
                  <ArrowLink href="/lots">Lot register</ArrowLink>
                </div>
              </div>
            </aside>
          </div>
        </Container>
      </Section>

      <Section className="pt-0" id="principles">
        <Container>
          <SectionHead
            index="02"
            rail="Principles"
            title="Four rules we hold to."
            standfirst="These occasionally cost us a sale. That is the point of having them."
          />
          <div className="mt-[39px] grid gap-x-[52px] gap-y-[39px] lg:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.n} className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px]">
                <span className="t-1 pt-[4px] text-axis-ink-300">{p.n}</span>
                <div>
                  <h3 className="t-4 text-axis-ink">{p.title}</h3>
                  <p className="t-3 mt-[8px] text-axis-ink-500">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="pt-0" id="supplier-record">
        <Container>
          <SectionHead index="03" rail="Supply" title="How we operate." />
          <div className="mt-[39px] grid gap-[26px] lg:grid-cols-2 lg:gap-[78px]">
            <p className="t-3 text-axis-ink-500">
              Orders ship from our US facility with cold-chain packaging where the compound
              requires it. We supply laboratories, universities, research institutions and
              independent researchers purchasing for legitimate research purposes.
            </p>
            <p className="t-3 text-axis-ink-500">
              We do not handle payment details on this site. An order is a request; we confirm
              stock, allocate a lot, and reply with an itemised invoice and the lot certificate
              before anything is paid.
            </p>
          </div>
          <div className="mt-[26px]">
            <ArrowLink href="/ordering">How ordering works</ArrowLink>
          </div>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
