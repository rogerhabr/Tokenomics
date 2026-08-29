import Link from 'next/link';
import Logo from './Logo';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/platform', label: 'Platform' },
      { href: '/platform#modules', label: 'Modules' },
      { href: '/dashboard', label: 'Live dashboard' },
    ],
  },
  {
    title: 'Research',
    links: [
      { href: '/research', label: 'Publications' },
      { href: '/research#method', label: 'Methodology' },
      { href: '/research#data', label: 'Data sources' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/about#principles', label: 'Principles' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-axis-border bg-axis-surface">
      <div className="mx-auto max-w-site px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-axis-muted">
              Quantitative research on the economics of artificial intelligence — from
              silicon to sold tokens.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-axis-faint">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-axis-muted transition-colors hover:text-axis-text"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-axis-border pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-axis-faint">
            &copy; {new Date().getFullYear()} Axis Labs. All rights reserved.
          </p>
          <p className="font-mono text-xs text-axis-faint">
            Built for research use. Not investment advice.
          </p>
        </div>
      </div>
    </footer>
  );
}
