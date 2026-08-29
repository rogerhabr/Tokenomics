import Link from 'next/link';
import Logo from './Logo';
import { CATEGORIES } from '@/lib/products';

export default function SiteFooter() {
  return (
    <footer className="bg-axis-navy text-white/70">
      <div className="mx-auto max-w-site px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr]">
          <div>
            <Logo inverted />
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              Third-party tested research peptides for laboratory and in vitro study, shipped
              worldwide from our US facility.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">
              Research areas
            </h3>
            <ul className="mt-4 space-y-2.5">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/products?category=${c.id}`}
                    className="text-sm transition-colors hover:text-white"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-white">Company</h3>
            <ul className="mt-4 space-y-2.5">
              {[
                { href: '/products', label: 'All products' },
                { href: '/quality', label: 'Quality & testing' },
                { href: '/about', label: 'About us' },
                { href: '/faq', label: 'FAQ' },
                { href: '/contact', label: 'Contact' },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 border-t border-white/15 pt-8">
          <p className="text-xs leading-relaxed text-white/60">
            <strong className="font-semibold text-white/85">Research use only.</strong> All
            products supplied by Axis Labs are intended strictly for laboratory research and in
            vitro study. They are not drugs, foods, cosmetics, or medical devices, and are not
            approved for human or veterinary consumption, clinical use, or diagnostic
            application. Purchasers are responsible for ensuring compliance with all applicable
            laws and institutional requirements in their jurisdiction.
          </p>
          <p className="mt-6 text-xs text-white/50">
            &copy; {new Date().getFullYear()} Axis Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
