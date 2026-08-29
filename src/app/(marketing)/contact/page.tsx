import type { Metadata } from 'next';
import { Section, PageHero } from '@/components/marketing/ui';
import ContactForm from '@/components/marketing/ContactForm';

export const metadata: Metadata = {
  title: 'Contact — Axis Labs',
  description: 'Get in touch with Axis Labs about the model, the research, or the data behind it.',
};

const REASONS = [
  {
    title: 'Challenge an assumption',
    body: 'If you think one of our parameters is wrong, tell us which one and why. Well-argued corrections change the model.',
  },
  {
    title: 'Research access',
    body: 'For institutional access to the full model, historical parameter sets, and the underlying data.',
  },
  {
    title: 'Data partnerships',
    body: 'If you hold data that would sharpen the supply or demand side, we would like to hear about it.',
  },
  {
    title: 'Press',
    body: 'For citation, commentary, or clarification of a published figure.',
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Tell us where we are wrong."
        lede="We would rather be corrected than quoted. If you have a better number, a contradicting dataset, or a structural objection to the method, that is the most useful thing you can send us."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-axis-faint">
              What people write in about
            </h2>
            <div className="mt-8 space-y-8">
              {REASONS.map((r) => (
                <div key={r.title}>
                  <h3 className="text-base font-semibold text-axis-text">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{r.body}</p>
                </div>
              ))}
            </div>
          </div>

          <ContactForm />
        </div>
      </Section>
    </>
  );
}
