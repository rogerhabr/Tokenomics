import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  LineChart,
  Layers,
  Database,
  GitBranch,
  ShieldCheck,
} from 'lucide-react';
import { Button, Card, Container, Eyebrow, Section, SectionTitle, StatBlock } from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Axis Labs — The economics of artificial intelligence',
  description:
    'Axis Labs builds quantitative models of the AI value chain: hardware installed base, token throughput, unit costs, and returns on invested capital.',
};

const CAPABILITIES = [
  {
    icon: Cpu,
    title: 'Supply-side modelling',
    body: 'Accelerator shipments, installed base decay, and effective FLOPs by generation — reconciled against reported vendor revenue rather than assumed.',
  },
  {
    icon: LineChart,
    title: 'Demand reconstruction',
    body: 'Token consumption rebuilt bottom-up from workload mix, context lengths, and reasoning overhead, then cross-checked against disclosed inference volumes.',
  },
  {
    icon: Layers,
    title: 'Unit economics',
    body: 'Cost per million tokens decomposed into silicon, power, networking, memory, and amortisation, so margin claims can be tested line by line.',
  },
  {
    icon: Database,
    title: 'Live data pipeline',
    body: 'Hardware pricing, GPU rental rates, model list prices, and vendor financials refreshed continuously with explicit staleness thresholds.',
  },
  {
    icon: GitBranch,
    title: 'Scenario analysis',
    body: 'Bear, base, and bull parameter sets over every assumption, with sensitivity surfaced instead of buried in a spreadsheet cell.',
  },
  {
    icon: ShieldCheck,
    title: 'Auditable by design',
    body: 'Every figure carries a source tag. Where a number is an estimate, the model says so and shows the derivation.',
  },
];

const STATS = [
  { value: '16', label: 'Interlocking model sections' },
  { value: '2029', label: 'Forecast horizon' },
  { value: '24h', label: 'Live data refresh cadence' },
  { value: '100%', label: 'Figures with source attribution' },
];

const STEPS = [
  {
    n: '01',
    title: 'Anchor on hardware',
    body: 'Start from what has physically shipped. Installed base, utilisation, and realistic throughput per accelerator set a hard ceiling on how many tokens can exist.',
  },
  {
    n: '02',
    title: 'Reconstruct demand',
    body: 'Build consumption from workloads upward — agents, coding, search, and long-context reasoning each carry very different token intensity.',
  },
  {
    n: '03',
    title: 'Close the loop on price',
    body: 'Where supply meets demand, price falls out. Compare the implied clearing price against published rate cards to locate the gap.',
  },
  {
    n: '04',
    title: 'Test the returns',
    body: 'Run the resulting revenue against capital deployed. ROIC is the question the whole build-out ultimately answers.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-axis-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #232833 1px, transparent 1px), linear-gradient(to bottom, #232833 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)',
          }}
        />
        <Container className="relative py-24 sm:py-36">
          <div className="max-w-3xl animate-fade-up">
            <Eyebrow>Quantitative AI research</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-axis-text sm:text-6xl">
              The economics of artificial intelligence, modelled end to end.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-axis-muted">
              Axis Labs traces the AI value chain from installed silicon to sold tokens —
              and prices every step. One model, fully sourced, built to be argued with.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/dashboard">
                Explore the model
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button href="/research" variant="secondary">
                Read the research
              </Button>
            </div>
          </div>
        </Container>
      </div>

      {/* Stats */}
      <div className="border-b border-axis-border bg-axis-surface">
        <Container className="py-14">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {STATS.map((s) => (
              <StatBlock key={s.label} value={s.value} label={s.label} />
            ))}
          </div>
        </Container>
      </div>

      {/* Capabilities */}
      <Section>
        <SectionTitle
          eyebrow="What we build"
          title="A single model, not a folder of disconnected spreadsheets."
          lede="Most AI market analysis picks one layer and extrapolates. We model the layers together, so a change in hardware assumptions propagates through throughput, price, and returns."
        />
        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <Icon size={20} className="text-axis-accent" />
              <h3 className="mt-4 text-base font-semibold text-axis-text">{title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-axis-muted">{body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Method */}
      <div className="border-y border-axis-border bg-axis-surface">
        <Section>
          <SectionTitle
            eyebrow="Method"
            title="Four steps, in strict order."
            lede="The sequence matters. Demand estimates that ignore the physical supply ceiling produce numbers that cannot happen."
          />
          <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2">
            {STEPS.map((step) => (
              <div key={step.n} className="flex gap-5">
                <span className="font-mono text-sm text-axis-accent">{step.n}</span>
                <div>
                  <h3 className="text-base font-semibold text-axis-text">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* CTA */}
      <Section>
        <div className="rounded-2xl border border-axis-border bg-gradient-to-br from-axis-card to-axis-surface p-10 sm:p-14">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-axis-text sm:text-4xl">
              See the assumptions. Change them.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-axis-muted">
              Every parameter in the model is exposed and adjustable. Disagree with our
              utilisation figure or refresh cycle? Move the slider and watch the
              conclusions move with it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/dashboard">
                Open the dashboard
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <Link
                href="/contact"
                className="focus-ring inline-flex items-center px-2 py-2.5 text-sm text-axis-muted transition-colors hover:text-axis-text"
              >
                Talk to the team
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
