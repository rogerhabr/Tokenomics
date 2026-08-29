import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Button, Card, Container, Section, SectionTitle, PageHero } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Platform — Axis Labs',
  description:
    'Sixteen interlocking modules covering hardware supply, token throughput, demand, unit economics, and returns on invested capital.',
};

const GROUPS = [
  {
    group: 'Supply',
    blurb: 'What the installed fleet can physically produce.',
    modules: [
      { name: 'Hardware Installed Base', desc: 'Accelerator shipments by generation, retirement curves, and the surviving fleet.' },
      { name: 'Token Throughput', desc: 'Realistic tokens per second per accelerator under production serving conditions.' },
      { name: 'Compute Supply & Demand', desc: 'The clearing view: available FLOPs against consumed FLOPs, period by period.' },
    ],
  },
  {
    group: 'Demand',
    blurb: 'Who consumes the output, and what they will pay.',
    modules: [
      { name: 'SAAS Disruption', desc: 'Which software revenue pools are exposed to model-native substitution, and on what timeline.' },
      { name: 'Addressable Market', desc: 'Bottom-up sizing by workload category rather than top-down analyst extrapolation.' },
      { name: 'Token Pricing Trends', desc: 'Published rate cards over time, normalised for context window and capability tier.' },
      { name: 'Lab Financials', desc: 'Disclosed and estimated revenue, spend, and burn for the frontier labs.' },
    ],
  },
  {
    group: 'Economics',
    blurb: 'Whether the capital deployed earns its cost.',
    modules: [
      { name: 'ROIC Calculator', desc: 'Returns on invested capital across the build-out, with adjustable capital intensity.' },
      { name: 'HW Refresh Sensitivity', desc: 'How much the entire thesis rests on the assumed replacement cycle.' },
      { name: 'Hardware Demand Forecast', desc: 'Implied future accelerator demand derived from the token demand curve.' },
      { name: 'Revenue & Profit', desc: 'Modelled revenue and margin by layer of the value chain.' },
      { name: 'AI Data Center Costs', desc: 'Full facility cost stack: land, shell, power, cooling, networking, and silicon.' },
    ],
  },
  {
    group: 'Tokenomics',
    blurb: 'The cost anatomy of a single token.',
    modules: [
      { name: 'Token Cost Anatomy', desc: 'Cost per million tokens decomposed into its physical and financial components.' },
      { name: 'Workflow Allocation', desc: 'How token volume distributes across agentic, coding, chat, and retrieval workloads.' },
    ],
  },
  {
    group: 'Methodology',
    blurb: 'Where every number came from.',
    modules: [
      { name: 'Data Sources', desc: 'Complete source register with retrieval dates and estimate flags.' },
    ],
  },
];

const PRINCIPLES = [
  {
    title: 'Parameters are exposed, not embedded',
    body: 'Utilisation, refresh cycle, power cost, capital intensity, and margin assumptions all sit behind visible controls. Nothing decisive is hidden in a constant.',
  },
  {
    title: 'Scenarios, not point estimates',
    body: 'Bear, base, and bull parameter sets ship with the model. A forecast without a stated range is a guess wearing a suit.',
  },
  {
    title: 'Live inputs where they exist',
    body: 'Market prices, rental rates, and vendor financials refresh automatically, with fresh, aging, and stale states shown explicitly rather than silently.',
  },
];

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="Sixteen modules. One consistent set of assumptions."
        lede="Change a parameter in one module and every downstream figure moves with it. That coupling is the entire point — it is what stops a supply forecast and a demand forecast from quietly contradicting each other."
      />

      <Section id="modules">
        <SectionTitle
          eyebrow="Modules"
          title="What is inside the model."
          lede="Grouped by where they sit in the value chain, in the order the model evaluates them."
        />
        <div className="mt-14 space-y-16">
          {GROUPS.map((g) => (
            <div key={g.group}>
              <div className="flex flex-col gap-1 border-b border-axis-border pb-4 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="font-mono text-sm uppercase tracking-[0.16em] text-axis-accent">
                  {g.group}
                </h3>
                <p className="text-sm text-axis-faint">{g.blurb}</p>
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {g.modules.map((m) => (
                  <Card key={m.name}>
                    <h4 className="text-base font-semibold text-axis-text">{m.name}</h4>
                    <p className="mt-2.5 text-sm leading-relaxed text-axis-muted">{m.desc}</p>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="border-y border-axis-border bg-axis-surface">
        <Section>
          <SectionTitle eyebrow="How it behaves" title="Three design commitments." />
          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <div key={p.title}>
                <h3 className="text-base font-semibold text-axis-text">{p.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-axis-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section>
        <Container className="px-0">
          <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-axis-border bg-axis-card p-10 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-axis-text">
                The model is live.
              </h2>
              <p className="mt-2 text-sm text-axis-muted">
                Sign in to open the full interactive dashboard.
              </p>
            </div>
            <Button href="/dashboard">
              Open dashboard
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
