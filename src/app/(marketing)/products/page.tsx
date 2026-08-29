import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, Container, PageHero, ResearchNotice } from '@/components/marketing/ui';
import { CATEGORIES, PRODUCTS, formatPrice, fromPriceCents, type CategoryId } from '@/lib/products';

export const metadata: Metadata = {
  title: 'Research Peptides — All Categories | Axis Labs',
  description:
    'The full Axis Labs research peptide catalogue: metabolic, neuroscience, tissue repair, growth factor, endocrine, and cosmetic research compounds at 99%+ purity.',
};

function isCategoryId(value: string | undefined): value is CategoryId {
  return !!value && CATEGORIES.some((c) => c.id === value);
}

export default function ProductsPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const selected = isCategoryId(searchParams.category) ? searchParams.category : null;
  const products = selected ? PRODUCTS.filter((p) => p.category === selected) : PRODUCTS;
  const activeCategory = selected ? CATEGORIES.find((c) => c.id === selected) : null;

  return (
    <>
      <PageHero
        eyebrow="Catalogue"
        title={activeCategory ? activeCategory.name : 'Research peptides'}
        lede={
          activeCategory
            ? activeCategory.blurb
            : 'Every compound is supplied as a lyophilised powder at 99%+ HPLC purity, independently assayed by batch, and shipped with a certificate of analysis.'
        }
      />

      <Container className="py-12">
        {/* Filter — plain links, so the catalogue works without JavaScript and
            every filtered view has its own shareable URL. */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/products"
            className={`focus-ring rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              !selected
                ? 'border-axis-blue bg-axis-blue text-white'
                : 'border-axis-border bg-white text-axis-navy hover:border-axis-blue hover:text-axis-blue'
            }`}
          >
            All ({PRODUCTS.length})
          </Link>
          {CATEGORIES.map((c) => {
            const count = PRODUCTS.filter((p) => p.category === c.id).length;
            const active = selected === c.id;
            return (
              <Link
                key={c.id}
                href={`/products?category=${c.id}`}
                className={`focus-ring rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-axis-blue bg-axis-blue text-white'
                    : 'border-axis-border bg-white text-axis-navy hover:border-axis-blue hover:text-axis-blue'
                }`}
              >
                {c.name} ({count})
              </Link>
            );
          })}
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const category = CATEGORIES.find((c) => c.id === p.category);
            const from = fromPriceCents(p.slug);
            return (
              <Link key={p.slug} href={`/products/${p.slug}`} className="focus-ring rounded-xl">
                <Card className="flex h-full flex-col">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-axis-blue">
                    {category?.name}
                  </span>
                  <h2 className="mt-3 text-xl font-bold text-axis-navy">{p.name}</h2>
                  {p.alias && <p className="mt-1 text-sm text-axis-faint">{p.alias}</p>}
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-axis-muted">{p.summary}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-axis-border pt-4">
                    <span className="text-sm font-bold text-axis-navy">
                      {from === null ? p.purity : `From ${formatPrice(from)}`}
                    </span>
                    <span className="inline-flex items-center text-sm font-semibold text-axis-blue">
                      Details
                      <ArrowRight size={15} className="ml-1.5" />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

        <ResearchNotice className="mt-14" />
      </Container>
    </>
  );
}
