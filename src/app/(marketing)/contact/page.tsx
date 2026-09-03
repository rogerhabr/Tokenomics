import type { Metadata } from 'next';
import { Container, PageHead, Section, ResearchNotice } from '@/components/marketing/ui';
import ContactForm from '@/components/marketing/ContactForm';
import { CONTACT_REASONS, getContent, text } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Contact — Certificates, Pricing and Custom Sourcing | Axis Labs',
  description:
    'Contact Axis Labs for batch certificates of analysis, bulk pricing, institutional purchase orders, or custom sourcing enquiries.',
};



export default async function ContactPage() {
  const copy = await getContent();
  const reasons = CONTACT_REASONS.map((_, i) => ({
    n: String(i + 1).padStart(2, '0'),
    title: text(copy, `contact.reason.${i}.title`),
    body: text(copy, `contact.reason.${i}.body`),
  }));
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
                {reasons.map((r) => (
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
