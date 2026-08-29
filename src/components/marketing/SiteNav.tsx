'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import Logo from './Logo';

export const NAV_LINKS = [
  { href: '/platform', label: 'Platform' },
  { href: '/research', label: 'Research' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile drawer whenever navigation actually happens.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? 'border-axis-border bg-axis-ink/85 backdrop-blur-xl'
          : 'border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-site items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Axis Labs home" className="rounded-md focus-ring">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`focus-ring rounded-md px-3.5 py-2 text-sm transition-colors ${
                  active ? 'text-axis-text' : 'text-axis-muted hover:text-axis-text'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/dashboard"
            className="focus-ring ml-3 rounded-lg border border-axis-border-strong px-4 py-2 text-sm text-axis-text transition-colors hover:border-axis-accent hover:text-axis-accent"
          >
            Open dashboard
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="focus-ring rounded-md p-2 text-axis-muted transition-colors hover:text-axis-text md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-axis-border bg-axis-ink px-5 pb-5 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-md px-2 py-3 text-sm text-axis-muted transition-colors hover:text-axis-text"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="mt-2 block rounded-lg border border-axis-border-strong px-4 py-3 text-center text-sm text-axis-text"
          >
            Open dashboard
          </Link>
        </div>
      )}
    </header>
  );
}
