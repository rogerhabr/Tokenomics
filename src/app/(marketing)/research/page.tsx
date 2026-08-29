import type { Metadata } from 'next';
import { Card, Section, SectionTitle, PageHero } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Research — Axis Labs',
  description:
    'Published notes on AI compute supply, token demand, unit economics, and the methodology behind the Axis Labs model.',
};

const NOTES = [
  {
    tag: 'Supply',
    title: 'The installed base ceiling',
    summary:
      'Aggregate token supply is bounded by silicon that has already shipped. We reconstruct the surviving fleet by generation and show why several widely cited demand forecasts imply throughput the fleet cannot deliver.',
    date: '2026',
  },
  {
    tag: 'Unit economics',
    title: 'What a million tokens actually costs',
    summary:
      'A full decomposition of inference cost — accelerator amortisation, power, cooling, networking, memory bandwidth, and utilisation drag — and how sensitive the headline number is to each.',
    date: '2026',
  },
  {
    tag: 'Demand',
    title: 'Reasoning overhead and the token multiplier',
    summary:
      'Extended reasoning changes token intensity by an order of magnitude for the same user-visible task. We size the multiplier by workload and trace what it does to demand curves.',
    date: '2026',
  },
  {
    tag: 'Returns',
    title: 'ROIC on the build-out',
    summary:
      'Running modelled revenue against deployed capital under bear, base, and bull assumptions. The spread between scenarios is wider than the consensus range suggests.',
    date: '2026',
  },
  {
    tag: 'Software',
    title: 'Which SaaS revenue is actually exposed',
    summary:
      'Substitution risk is not uniform. We separate revenue pools by how much of their value sits in workflow lock-in versus in generating text that a model now generates for free.',
    date: '2026',
  },
  {
    tag: 'Hardware',
    title: 'Refresh cycle sensitivity',
    summary:
      'The assumed replacement interval quietly drives a large share of forecast hardware demand. We isolate the effect and show the range of defensible values.',
    date: '2026',
  },
];

const METHOD = [
  {
    title: 'Bottom-up before top-down',
    body: 'We build quantities from physical units — accelerators, watts, tokens per second — and only then convert to currency. Top-down market sizing enters as a cross-check, never as an input.',
  },
  {
    title: 'Estimates are labelled as estimates',
    body: 'Disclosed figures, derived figures, and our own estimates are visually distinct throughout the model. A reader should never have to guess which one they are looking at.',
  },
  {
    title: 'Assumptions travel with the output',
    body: 'Every chart in the dashboard reads from the same global parameter set. There is no way to publish a figure whose assumptions differ from the one next to it.',
  },
  {
    title: 'Disagreement is a feature',
    body: 'The controls exist so a reader can substitute their own view and see the consequence immediately. We would rather be tested than believed.',
  },
];

export default function ResearchPage() {
  return (
    <>
      <PageHero
        eyebrow="Research"
        title="Notes on where the money in AI actually goes."
        lede="Short, quantitative pieces that each answer one question and show the working. Every claim traces back to a figure in the model, and every figure traces back to a source."
      />

      <Section>
        <SectionTitle eyebrow="Publications" title="Recent notes." />
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {NOTES.map((n) => (
            <Card key={n.title} className="flex flex-col">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-axis-accent">
                  {n.tag}
                </span>
                <span className="font-mono text-xs text-axis-faint">{n.date}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold leading-snug text-axis-text">
                {n.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-axis-muted">{n.summary}</p>
            </Card>
          ))}
        </div>
      </Section>

      <div className="border-y border-axis-border bg-axis-surface">
        <Section id="method">
          <SectionTitle
            eyebrow="Methodology"
            title="How we decide what to believe."
            lede="Four rules that constrain the model. They are restrictive on purpose."
          />
          <div className="mt-12 grid gap-10 md:grid-cols-2">
            {METHOD.map((m) => (
              <div key={m.title}>
                <h3 className="text-base font-semibold text-axis-text">{m.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-axis-muted">{m.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section id="data">
        <SectionTitle
          eyebrow="Data"
          title="Inputs and their provenance."
          lede="The model mixes continuously refreshed market data with periodically reviewed structural datasets."
        />
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-axis-border-strong">
                <th className="pb-3 pr-6 font-mono text-xs uppercase tracking-[0.14em] text-axis-faint">
                  Input
                </th>
                <th className="pb-3 pr-6 font-mono text-xs uppercase tracking-[0.14em] text-axis-faint">
                  Cadence
                </th>
                <th className="pb-3 font-mono text-xs uppercase tracking-[0.14em] text-axis-faint">
                  Nature
                </th>
              </tr>
            </thead>
            <tbody className="text-axis-muted">
              {[
                ['Vendor equity prices', 'Daily', 'Market data'],
                ['GPU rental rates', 'Daily', 'Market data'],
                ['Model list pricing', 'Daily', 'Published rate cards'],
                ['Accelerator vendor financials', 'Quarterly', 'Company filings'],
                ['Installed base and shipments', 'Quarterly', 'Derived estimate'],
                ['Data centre cost stack', 'Periodic review', 'Derived estimate'],
                ['Workload token intensity', 'Periodic review', 'Axis Labs estimate'],
              ].map(([input, cadence, nature]) => (
                <tr key={input} className="border-b border-axis-border">
                  <td className="py-3.5 pr-6 text-axis-text">{input}</td>
                  <td className="py-3.5 pr-6 font-mono text-xs">{cadence}</td>
                  <td className="py-3.5">{nature}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-axis-faint">
          The complete source register, with retrieval timestamps, lives in the Data Sources
          module of the dashboard.
        </p>
      </Section>
    </>
  );
}
