import type { Metadata } from 'next';
import { Section, PageHero, ResearchNotice } from '@/components/marketing/ui';
import ContactForm from '@/components/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — Pricing, Certificates & Custom Synthesis | Axis Labs',
  description:
    'Contact Axis Labs for research peptide pricing, batch certificates of analysis, bulk quantities, or custom sourcing enquiries.',
};

const REASONS = [
  {
    title: 'Pricing and quantities',
    body: 'Per-vial and bulk pricing, current stock, and lead times for any compound in the catalogue.',
  },
  {
    title: 'Certificates of analysis',
    body: 'Ask for the current batch certificate on any compound and we will send it before you order.',
  },
  {
    title: 'Custom sourcing',
    body: 'Compounds outside the catalogue. Tell us the molecule, the purity specification, and the quantity.',
  },
  {
    title: 'Institutional accounts',
    body: 'Purchase orders, recurring supply, and documentation for university and laboratory procurement.',
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Ask us for the paperwork."
        lede="Specification questions, batch certificates, bulk pricing, and custom sourcing all reach the same team. We answer technical questions technically."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-axis-blue">
              What we can help with
            </h2>
            <div className="mt-8 space-y-8">
              {REASONS.map((r) => (
                <div key={r.title}>
                  <h3 className="text-base font-bold text-axis-navy">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{r.body}</p>
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>

        <ResearchNotice className="mt-14" />
      </Section>
    </>
  );
}
