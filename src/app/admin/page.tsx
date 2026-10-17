import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Administration — Axis Labs' };

const SECTIONS = [
  {
    href: '/admin/pricing',
    title: 'Pricing',
    body: 'Vial sizes and prices for every compound. Add a size, change a price, or hide one from the storefront.',
  },
  {
    href: '/admin/content',
    title: 'Page copy',
    body: 'Headlines, standfirsts, compound summaries and research applications. Policy pages stay in source.',
  },
];

export default function AdminIndexPage() {
  return (
    <>
      <h1 className="t-7 text-axis-ink">Administration</h1>
      <div className="spec-rule mt-[26px]" />
      <ul className="mt-[39px] border-t border-axis-rule-2">
        {SECTIONS.map((s) => (
          <li key={s.href} className="border-b border-axis-rule-1">
            <Link
              href={s.href}
              className="block py-[20px] transition-colors duration-[--dur-1] hover:bg-axis-plate"
            >
              <span className="t-5 text-axis-ink">{s.title}</span>
              <span className="t-3 mt-[6px] block max-w-measure text-axis-ink-500">{s.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
