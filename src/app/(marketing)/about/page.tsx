import type { Metadata } from 'next';
import { Section, SectionTitle, PageHero, StatBlock, Container } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'About — Axis Labs',
  description:
    'Axis Labs is an independent research group modelling the economics of the AI build-out, from installed silicon to sold tokens.',
};

const PRINCIPLES = [
  {
    n: '01',
    title: 'Show the working',
    body: 'A conclusion without a visible derivation is an opinion. Every figure we publish can be traced to its inputs, and every input to its source.',
  },
  {
    n: '02',
    title: 'Physical units first',
    body: 'Accelerators, watts, and tokens per second are facts. Dollars are a downstream consequence. We model in that order and never the reverse.',
  },
  {
    n: '03',
    title: 'Publish the uncertainty',
    body: 'Where the data is thin, we say so and widen the range rather than picking a confident-sounding midpoint.',
  },
  {
    n: '04',
    title: 'Independent by construction',
    body: 'We take no position in the assets we model and accept no vendor funding for research output.',
  },
];

const FACTS = [
  { value: '2025', label: 'Founded' },
  { value: 'Independent', label: 'Funding model' },
  { value: 'Open', label: 'Assumption set' },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="An independent lab for the economics of compute."
        lede="Axis Labs exists because the most consequential capital allocation of this decade is being justified with numbers almost nobody can check. We build the model that makes those numbers checkable."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <SectionTitle eyebrow="Why we exist" title="The gap we are closing." />
            <div className="mt-8 space-y-5 text-base leading-relaxed text-axis-muted">
              <p>
                Hundreds of billions of dollars are being committed to AI infrastructure on the
                strength of forecasts whose assumptions are rarely stated and almost never
                adjustable. Supply-side projections and demand-side projections circulate
                independently, and when they are placed side by side they frequently describe
                incompatible worlds.
              </p>
              <p>
                We think that is a solvable problem. The physical constraints are knowable:
                accelerators ship in countable quantities, they draw measurable power, and they
                emit a bounded number of tokens per second. Starting from those constraints and
                working forward produces a much narrower and much more defensible range than
                starting from a market-size estimate and working backward.
              </p>
              <p>
                So we built one model that spans the whole chain — silicon, throughput, demand,
                price, and return on capital — with every assumption exposed as a control. It is
                designed to be disagreed with productively. If you think our utilisation figure
                is wrong, change it, and see precisely what your view implies.
              </p>
            </div>
          </div>

          <div className="space-y-8 lg:pt-24">
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
            title="Four commitments we hold ourselves to."
            lede="These constrain what we are willing to publish, and occasionally cost us a cleaner headline."
          />
          <div className="mt-14 grid gap-x-12 gap-y-12 md:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.n} className="flex gap-5">
                <span className="font-mono text-sm text-axis-accent">{p.n}</span>
                <div>
                  <h3 className="text-base font-semibold text-axis-text">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <Container className="px-0">
          <blockquote className="max-w-3xl border-l-2 border-axis-accent pl-7">
            <p className="text-xl leading-relaxed text-axis-text sm:text-2xl">
              A forecast you cannot take apart is not research. It is marketing with error bars
              removed.
            </p>
          </blockquote>
        </Container>
      </Section>
    </>
  );
}
