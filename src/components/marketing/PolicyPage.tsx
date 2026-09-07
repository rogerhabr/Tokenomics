import type { ReactNode } from 'react';
import { Container, PageHead, Section, ResearchNotice } from './ui';

export type PolicySection = {
  n: string;
  title: string;
  body: string[];
};

/**
 * The shared shell for the footer policy pages. They share one structure — a
 * head, a numbered set of prose sections on the measure, and the research-use
 * notice — so they share one component rather than four near-identical files.
 */
export default function PolicyPage({
  rail,
  title,
  standfirst,
  sections,
  footnote,
}: {
  rail: string;
  title: string;
  standfirst: string;
  sections: PolicySection[];
  footnote?: ReactNode;
}) {
  return (
    <>
      <PageHead index="01" rail={rail} title={title} standfirst={standfirst} />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <div className="prose-measure">
            {sections.map((s) => (
              <section
                key={s.n}
                className="border-t border-axis-rule-2 py-[26px] first:border-t-0 first:pt-0"
              >
                <h2 className="t-1 text-axis-ink-300">
                  {s.n} — {s.title}
                </h2>
                {s.body.map((para) => (
                  <p key={para} className="t-3 mt-[13px] text-axis-ink-500">
                    {para}
                  </p>
                ))}
              </section>
            ))}
          </div>

          {footnote && (
            <div className="prose-measure mt-[39px] border-t border-axis-rule-2 pt-[26px]">
              {footnote}
            </div>
          )}
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
