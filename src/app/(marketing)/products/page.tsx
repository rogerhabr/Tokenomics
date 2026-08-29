import type { Metadata } from 'next';
import Link from 'next/link';
import { Container, PageHead, Section, ResearchNotice } from '@/components/marketing/ui';
import Register from '@/components/marketing/Register';
import { getAllVariants } from '@/lib/variants';
import { CATEGORIES, PRODUCTS, type CategoryId, type Product } from '@/lib/products';

export const metadata: Metadata = {
  title: 'Research Compounds — The Register | Axis Labs',
  description:
    'The full Axis Labs catalogue: molecular formula, mass and price per milligram for every research compound, with the release specification each is assayed against.',
};

function isCategoryId(value: string | undefined): value is CategoryId {
  return !!value && CATEGORIES.some((c) => c.id === value);
}

/**
 * Matches a compound against a free-text query.
 *
 * Researchers search by code as often as by name — BPC-157, PT-141, LY3437943,
 * TH9507 — so aliases are matched as well as names, and punctuation is
 * normalised so "bpc157" and "BPC-157" both resolve.
 */
function matches(product: Product, query: string): boolean {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const q = normalise(query);
  if (!q) return true;

  const category = CATEGORIES.find((c) => c.id === product.category);
  const haystack = [
    product.name,
    product.alias ?? '',
    product.summary,
    category?.name ?? '',
    ...product.researchAreas,
  ].map(normalise);

  return haystack.some((h) => h.includes(q));
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { class?: string; q?: string };
}) {
  const selected = isCategoryId(searchParams.class) ? searchParams.class : null;
  const query = (searchParams.q ?? '').trim();

  let products = PRODUCTS;
  if (selected) products = products.filter((p) => p.category === selected);
  if (query) products = products.filter((p) => matches(p, query));

  const activeCategory = selected ? CATEGORIES.find((c) => c.id === selected) : null;
  const prices = await getAllVariants();

  return (
    <>
      <PageHead
        index="01"
        rail="Register"
        title={activeCategory ? activeCategory.name : 'The compound register'}
        standfirst={
          activeCategory
            ? activeCategory.blurb
            : 'Every compound is supplied as a lyophilised powder, assayed on the lot by an external laboratory, and shipped with its certificate of analysis.'
        }
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          {/* Plain links, so every filtered view has a shareable URL and the
              catalogue works with JavaScript disabled. */}
          <nav aria-label="Filter by research class" className="flex flex-wrap gap-[8px]">
            <Link
              href="/products"
              aria-current={!selected ? 'true' : undefined}
              className={`t-2 inline-flex min-h-[36px] items-center rounded-plate border px-[13px] transition-colors duration-[--dur-1] ${
                !selected
                  ? 'border-axis-ink bg-axis-ink text-axis-paper'
                  : 'border-axis-rule-3 text-axis-ink hover:bg-axis-sunk'
              }`}
            >
              All {PRODUCTS.length}
            </Link>
            {CATEGORIES.map((c) => {
              const count = PRODUCTS.filter((p) => p.category === c.id).length;
              const active = selected === c.id;
              return (
                <Link
                  key={c.id}
                  href={`/products?class=${c.id}`}
                  aria-current={active ? 'true' : undefined}
                  className={`t-2 inline-flex min-h-[36px] items-center rounded-plate border px-[13px] transition-colors duration-[--dur-1] ${
                    active
                      ? 'border-axis-ink bg-axis-ink text-axis-paper'
                      : 'border-axis-rule-3 text-axis-ink hover:bg-axis-sunk'
                  }`}
                >
                  {c.name} <span className="data ml-[6px] text-[0.9em] opacity-70">{count}</span>
                </Link>
              );
            })}
          </nav>

          {query && (
            <p className="t-2 mt-[20px] text-axis-ink-500">
              {products.length} {products.length === 1 ? 'result' : 'results'} for{' '}
              <span className="text-axis-ink">&ldquo;{query}&rdquo;</span>.{' '}
              <Link href="/products" className="underline underline-offset-[4px]">
                Clear
              </Link>
            </p>
          )}

          <div className="mt-[39px]">
            <Register products={products} prices={prices} />
          </div>

          <p className="t-2 mt-[26px] text-axis-ink-300">
            Rate is the lowest price per milligram across a compound&rsquo;s vial sizes. Molecular
            formula and mass are reference values from PubChem, not lot measurements.
          </p>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
