import type { Metadata } from 'next';
import {
  Container,
  PageHead,
  Section,
  ArrowLink,
  ResearchNotice,
} from '@/components/marketing/ui';

export const metadata: Metadata = {
  title: 'Prohibited Use Policy | Axis Labs',
  description:
    'What Axis Labs research compounds may not be used for, who we will not supply, and the grounds on which we refuse or cancel an order.',
};

const SECTIONS = [
  {
    n: '01',
    title: 'Permitted use',
    body: [
      'Material supplied by Axis Labs is sold for laboratory research and in vitro study only. It is intended for use by qualified personnel in an appropriately equipped facility, under the purchaser’s own institutional protocols for handling research chemicals.',
      'Nothing we supply is a drug, food, cosmetic, dietary supplement, or medical device. Nothing we supply has been evaluated for safety or efficacy in humans or animals, and nothing we supply is manufactured to pharmaceutical standards.',
    ],
  },
  {
    n: '02',
    title: 'Prohibited use',
    body: [
      'Material supplied by Axis Labs may not be administered to humans or animals under any circumstances. It may not be used in, or in preparation for, any clinical, diagnostic, therapeutic, cosmetic, or veterinary application.',
      'It may not be resold, repackaged, relabelled, compounded, or redistributed for any of those purposes, and it may not be represented to any third party as suitable for them.',
    ],
  },
  {
    n: '03',
    title: 'What we do not supply',
    body: [
      'We do not supply reconstitution consumables, injection equipment, syringes, needles, bacteriostatic water, or any other item whose only purpose is preparing material for administration. We do not recommend or link to suppliers of those items.',
      'We do not publish dosing information, reconstitution protocols, administration guidance, cycle information, or any other content framed around use in a human or animal body — and we will not provide it on request.',
    ],
  },
  {
    n: '04',
    title: 'Grounds for refusal',
    body: [
      'We refuse or cancel orders where the stated application is not a research application, where correspondence indicates an intent to administer the material, where the shipping destination is one we do not supply, or where supply would breach a law or regulation applicable to us or to the purchaser.',
      'We may decline any order without giving a reason. Where an order is cancelled before dispatch, nothing is charged — this site takes no payment at the point of order.',
    ],
  },
  {
    n: '05',
    title: 'The purchaser’s responsibility',
    body: [
      'Purchasers are responsible for determining that possession, import, and use of a given compound is lawful in their jurisdiction, and for complying with their institution’s requirements for the receipt, handling, storage, and disposal of research chemicals.',
      'Some compounds in our register are the subject of live patents or are analogues of approved medicines in some territories. Purchasers are responsible for their own position on intellectual property and regulatory compliance.',
    ],
  },
  {
    n: '06',
    title: 'Reporting a concern',
    body: [
      'If you believe material supplied by Axis Labs is being represented or used contrary to this policy, tell us. We investigate every report and will refuse further supply where a breach is established.',
    ],
  },
];

export default function ProhibitedUsePage() {
  return (
    <>
      <PageHead
        index="01"
        rail="Policy"
        title="Prohibited use."
        standfirst="Research use only is not a disclaimer we print to cover ourselves — it is the condition of sale. This page sets out what our material may not be used for, and what we will not supply."
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <div className="prose-measure">
            {SECTIONS.map((s) => (
              <section key={s.n} className="border-t border-axis-rule-2 py-[26px] first:border-t-0 first:pt-0">
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

          <div className="mt-[39px] flex flex-wrap gap-[26px]">
            <ArrowLink href="/contact">Report a concern</ArrowLink>
            <ArrowLink href="/terms">Terms of sale</ArrowLink>
          </div>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
