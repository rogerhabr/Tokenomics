import type { Metadata } from 'next';
import Link from 'next/link';
import PolicyPage from '@/components/marketing/PolicyPage';

export const metadata: Metadata = {
  title: 'Accessibility | Axis Labs',
  description:
    'The accessibility standard this site is built to, the specific choices behind it, and how to report a barrier.',
};

const SECTIONS = [
  {
    n: '01',
    title: 'The standard',
    body: [
      'This site targets WCAG 2.2 Level AA. That is the standard the design system is measured against, not an aspiration bolted on afterwards.',
    ],
  },
  {
    n: '02',
    title: 'What that means in practice here',
    body: [
      'Every text colour in the palette is checked against all three page grounds, not just one, and the lightest tone permitted to carry a word clears 4.5:1. Every border that signals state or bounds a control clears 3:1.',
      'Lot status is never communicated by colour alone: released, retained and rejected each carry a distinct glyph and a written label, so the register survives greyscale printing and colour-vision deficiency.',
      'The catalogue, the lot register and the order are real tables and lists with real headers. Prices, masses and lot codes are set in tabular figures so columns align.',
    ],
  },
  {
    n: '03',
    title: 'Motion',
    body: [
      'Motion on this site is decorative and minimal — a hairline rule that draws itself under a heading. It is authored so that reduced motion is its absence rather than an override, and it honours your system preference automatically.',
      'No content is ever hidden behind an animation. Nothing on this site scroll-jacks, auto-plays, marquees, or replaces your cursor.',
    ],
  },
  {
    n: '04',
    title: 'Keyboard and assistive technology',
    body: [
      'A skip link is the first thing in the page. Focus is visible everywhere, using one focus treatment applied globally so no component can omit it, and in-page anchors account for the sticky header rather than scrolling their target underneath it.',
      'The order panel traps focus while open, returns focus where it came from on close, and closes on Escape.',
    ],
  },
  {
    n: '05',
    title: 'Known gaps',
    body: [
      'This page will be updated as gaps are found and closed. We would rather list a real limitation than publish a conformance claim we have not tested.',
    ],
  },
];

export default function AccessibilityPage() {
  return (
    <PolicyPage
      rail="Policy"
      title="Accessibility."
      standfirst="This site targets WCAG 2.2 Level AA. If something here blocks you, tell us — a barrier you hit is more useful to us than a conformance badge."
      sections={SECTIONS}
      footnote={
        <p className="t-3 text-axis-ink-500">
          Report a barrier through{' '}
          <Link href="/contact" className="text-axis-ink underline underline-offset-[4px]">
            our contact form
          </Link>
          . Tell us the page, what you were trying to do, and the assistive technology you use if
          that is relevant.
        </p>
      }
    />
  );
}
