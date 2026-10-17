import Link from 'next/link';
import Logo from './Logo';
import { CATEGORIES } from '@/lib/products';

const COMPANY = [
  { href: '/products', label: 'All compounds' },
  { href: '/lots', label: 'Lot records' },
  { href: '/quality', label: 'Release specification' },
  { href: '/about', label: 'About' },
  { href: '/ordering', label: 'Ordering' },
  { href: '/contact', label: 'Contact' },
];

const LEGAL = [
  { href: '/prohibited-use', label: 'Prohibited use' },
  { href: '/terms', label: 'Terms of sale' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/shipping-returns', label: 'Shipping & returns' },
  { href: '/accessibility', label: 'Accessibility' },
];

/**
 * The footer is an ink band — one of exactly two full-bleed dark registers a
 * long page may carry. The seven research classes live here rather than in the
 * nav: a long list belongs where a long list is useful, and these are the
 * indexable entry points for compound-class search.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-auto bg-[#101215] text-[#eae7e0] print-hide">
      <div className="mx-auto w-[88%] max-w-content py-[78px]">
        <div className="grid gap-[52px] lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Logo inverted />
            <p className="t-3 mt-[26px] max-w-[34ch] text-[#9ca0a7]">
              Research compounds supplied for laboratory and in vitro study, assayed by an
              independent laboratory against a published release specification.
            </p>
          </div>

          <nav aria-labelledby="footer-classes">
            <h2 id="footer-classes" className="t-1 text-[#9ca0a7]">
              Research classes
            </h2>
            <ul className="mt-[20px] space-y-[10px]">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/products?class=${c.id}`}
                    className="t-3 text-[#eae7e0] transition-colors duration-[--dur-1] hover:text-white"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className="t-1 text-[#9ca0a7]">
              Company
            </h2>
            <ul className="mt-[20px] space-y-[10px]">
              {COMPANY.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="t-3 text-[#eae7e0] transition-colors duration-[--dur-1] hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="t-1 text-[#9ca0a7]">
              Policies
            </h2>
            <ul className="mt-[20px] space-y-[10px]">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="t-3 text-[#eae7e0] transition-colors duration-[--dur-1] hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-[52px] border-t border-[#2b2e34] pt-[26px]">
          <p className="t-3 max-w-[80ch] text-[#eae7e0]">
            <span className="t-1 mb-[8px] block text-[#f0705f]">For research use only</span>
            All products supplied by Axis Labs are intended strictly for laboratory research and
            in vitro study. They are not drugs, foods, cosmetics, or medical devices, and are not
            approved for human or veterinary consumption, clinical use, or diagnostic
            application. Purchasers are responsible for ensuring compliance with all applicable
            laws and institutional requirements in their jurisdiction.
          </p>

          {/* Colophon. The reference chemistry on this site comes from a public
              registry and says so — NLM's web policy permits reuse of the data
              but not its use to imply endorsement, so we cite the source and
              draw the structures ourselves. */}
          <p className="t-1 mt-[26px] text-[#9ca0a7]">
            Reference chemistry from PubChem, US National Library of Medicine. Structures drawn
            from PubChem coordinate data. Not an endorsement by NCBI or NLM.
          </p>
          <p className="t-1 mt-[13px] text-[#9ca0a7]">
            &copy; {new Date().getFullYear()} Axis Labs
          </p>
        </div>
      </div>
    </footer>
  );
}
