import type { Metadata } from 'next';
import { Container, PageHead, Section, ResearchNotice } from '@/components/marketing/ui';
import ContactForm from '@/components/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — Certificates, Pricing and Custom Sourcing | Axis Labs',
  description:
    'Contact Axis Labs for batch certificates of analysis, bulk pricing, institutional purchase orders, or custom sourcing enquiries.',
};

const REASONS = [
  {
    n: '01',
    title: 'Certificates of analysis',
    body: 'Ask for the current batch certificate on any compound and we will send it before you order.',
  },
  {
    n: '02',
    title: 'Pricing and quantities',
    body: 'Per-vial and bulk pricing, current stock, and lead times for anything in the register.',
  },
  {
    n: '03',
    title: 'Custom sourcing',
    body: 'Compounds outside the register. Tell us the molecule, the purity specification and the quantity.',
  },
  {
    n: '04',
    title: 'Institutional accounts',
    body: 'Purchase orders, recurring supply, and documentation for university and laboratory procurement.',
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHead
        index="01"
        rail="Contact"
        title="Ask us for the paperwork."
        standfirst="Specification questions, batch certificates, bulk pricing and custom sourcing all reach the same team. We answer technical questions technically."
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <div className="grid gap-[52px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-[78px]">
            <div>
              <h2 className="t-1 text-axis-ink-300">What we can help with</h2>
              <div className="mt-[20px] border-t border-axis-rule-2">
                {REASONS.map((r) => (
                  <div
                    key={r.n}
                    className="grid grid-cols-[36px_minmax(0,1fr)] gap-[13px] border-b border-axis-rule-1 py-[20px]"
                  >
                    <span className="t-1 pt-[4px] text-axis-ink-300">{r.n}</span>
                    <div>
                      <h3 className="t-4 text-axis-ink">{r.title}</h3>
                      <p className="t-3 mt-[6px] text-axis-ink-500">{r.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ContactForm />
          </div>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
