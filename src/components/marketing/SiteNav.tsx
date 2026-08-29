'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';

// Deliberately flat: four destinations and one action, no dropdowns or nested
// menus. Every page on the site is reachable in a single click from here.
export const NAV_LINKS = [
  { href: '/products', label: 'Products' },
  { href: '/quality', label: 'Quality' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <div className="bg-axis-navy py-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-white/80">
        Research use only — not for human consumption
      </div>

      <header className="sticky top-0 z-50 border-b border-axis-border bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-[72px] max-w-site items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Axis Labs home" className="focus-ring rounded-md">
            <Logo />
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`focus-ring rounded-md px-4 py-2 text-[15px] font-medium transition-colors ${
                    active ? 'text-axis-blue' : 'text-axis-navy hover:text-axis-blue'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/contact"
              className="focus-ring ml-3 rounded-lg bg-axis-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-axis-blue-hover"
            >
              Contact
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="focus-ring rounded-md p-2 text-axis-navy md:hidden"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {open && (
          <div className="border-t border-axis-border bg-white px-5 pb-5 pt-2 md:hidden">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-2 py-3.5 text-[15px] font-medium text-axis-navy"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/contact"
              className="mt-2 block rounded-lg bg-axis-blue px-4 py-3.5 text-center text-sm font-semibold text-white"
            >
              Contact
            </Link>
          </div>
        )}
      </header>
    </>
  );
}
