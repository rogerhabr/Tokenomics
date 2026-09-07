'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Logo from './Logo';
import CartButton from './CartButton';

/**
 * Deliberately flat, permanently.
 *
 * Seven classes over seventeen compounds averages under three products per
 * class — four times below the point at which an intermediary category layer
 * earns its place. Baymard's finding is that users misread such a layer as the
 * final product list and never reach the filters; here it would also be an
 * elaborate machine for making the catalogue look smaller than it is. The
 * classes live in the footer, where a long list belongs and is useful to
 * search, and as filter state on /products.
 *
 * Search, cart and Contact are controls rather than destinations, so they do
 * not break flatness. Contact sits in the identical position on every page
 * including inside the mobile sheet — WCAG 2.2 SC 3.2.6 Consistent Help is
 * normative at Level A, so moving it between pages is a conformance
 * regression, not a design choice.
 */
export const NAV_LINKS = [
  { href: '/products', label: 'Compounds' },
  { href: '/lots', label: 'Lot records' },
  { href: '/ordering', label: 'Ordering' },
  { href: '/about', label: 'About' },
];

export default function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      {/* Folio strip. States what the site is, in the site's data voice.
          It carries no quality-system claim — no revision, no sheet number,
          no 'controlled document': those are terms of art asserting a
          procedure AXIS does not operate, and the buyer being courted is
          exactly the person who would check. */}
      <div className="border-b border-axis-rule-1 bg-axis-sunk">
        <div className="mx-auto flex w-[88%] max-w-content items-center justify-between py-[6px]">
          <span className="t-1 text-axis-ink-300">Axis Labs — research compound supply</span>
          <span className="t-1 hidden text-axis-ink-300 sm:block">
            For laboratory research use only
          </span>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-axis-rule-2 bg-axis-paper/95 backdrop-blur print-hide">
        <nav
          aria-label="Primary"
          className="mx-auto flex h-[var(--header-h)] w-[88%] max-w-content items-center gap-[26px]"
        >
          <Link href="/" aria-label="Axis Labs home" className="rounded-plate">
            <Logo />
          </Link>

          <div className="hidden items-center gap-[20px] lg:flex">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`t-3 rounded-plate py-[4px] transition-colors duration-[--dur-1] ${
                    active
                      ? 'text-axis-ink underline decoration-axis-ink underline-offset-[6px]'
                      : 'text-axis-ink-500 hover:text-axis-ink'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-[13px]">
            {/* A visible field, not an icon. The catalogue is searched by
                abbreviation and code as often as by name — BPC-157, PT-141,
                LY3437943 — and an icon hides the one control that resolves
                those fastest. Plain GET, so it works without JavaScript. */}
            <form action="/products" method="get" className="hidden md:block" role="search">
              <label htmlFor="site-search" className="sr-only">
                Search compounds
              </label>
              <input
                id="site-search"
                name="q"
                type="search"
                placeholder="Search compounds"
                className="t-2 h-[38px] w-[210px] rounded-plate border border-axis-rule-3 bg-axis-plate px-[12px] text-axis-ink placeholder:text-axis-ink-300"
              />
            </form>

            <CartButton />

            <Link
              href="/contact"
              className="t-3 hidden min-h-[38px] items-center rounded-plate border border-axis-rule-3 px-[16px] text-axis-ink transition-colors duration-[--dur-1] hover:bg-axis-sunk sm:inline-flex"
            >
              Contact
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="t-1 min-h-[38px] rounded-plate border border-axis-rule-3 px-[13px] text-axis-ink lg:hidden"
            >
              {open ? 'Close' : 'Menu'}
            </button>
          </div>
        </nav>

        {/* The mobile sheet carries the entire catalogue grouped by class,
            which turns the hamburger's discoverability weakness into a reason
            to open it. */}
        {open && (
          <div
            id="mobile-menu"
            className="border-t border-axis-rule-2 bg-axis-paper px-[6%] py-[26px] lg:hidden"
          >
            <form action="/products" method="get" className="mb-[26px] md:hidden" role="search">
              <label htmlFor="mobile-search" className="sr-only">
                Search compounds
              </label>
              <input
                id="mobile-search"
                name="q"
                type="search"
                placeholder="Search compounds"
                className="t-3 h-[48px] w-full rounded-plate border border-axis-rule-3 bg-axis-plate px-[13px] text-axis-ink placeholder:text-axis-ink-300"
              />
            </form>

            <ul className="border-t border-axis-rule-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href} className="border-b border-axis-rule-1">
                  <Link href={link.href} className="t-4 block py-[13px] text-axis-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="border-b border-axis-rule-1">
                <Link href="/contact" className="t-4 block py-[13px] text-axis-ink">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        )}
      </header>
    </>
  );
}
