import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import { Button, Container, ResearchNotice } from '@/components/marketing/ui';
import { CATEGORIES, PRODUCTS, getProduct } from '@/lib/products';

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = getProduct(params.slug);
  if (!product) return { title: 'Product not found — Axis Labs' };
  return {
    title: `${product.name} — Research Peptide | Axis Labs`,
    description: `${product.summary} Supplied at ${product.purity} for research use only.`,
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  const category = CATEGORIES.find((c) => c.id === product.category);
  const related = PRODUCTS.filter(
    (p) => p.category === product.category && p.slug !== product.slug
  ).slice(0, 3);

  const specs: [string, string][] = [
    ['Purity', product.purity],
    ['Form', product.form],
    ['Storage', product.storage],
    ['CAS number', product.casNumber ?? 'See certificate of analysis'],
    ['Molecular weight', product.molecularWeight ?? 'See certificate of analysis'],
  ];

  return (
    <>
      <Container className="pt-8">
        <Link
          href={`/products?category=${product.category}`}
          className="focus-ring inline-flex items-center rounded-md text-sm font-medium text-axis-muted transition-colors hover:text-axis-blue"
        >
          <ArrowLeft size={15} className="mr-1.5" />
          {category?.name}
        </Link>
      </Container>

      <Container className="py-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-axis-blue">
              {category?.name}
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-axis-navy sm:text-5xl">
              {product.name}
            </h1>
            {product.alias && <p className="mt-2 text-lg text-axis-faint">{product.alias}</p>}

            <p className="mt-6 text-lg leading-relaxed text-axis-muted">{product.summary}</p>

            <h2 className="mt-12 text-xl font-bold text-axis-navy">Research applications</h2>
            <ul className="mt-4 space-y-3">
              {product.researchAreas.map((area) => (
                <li key={area} className="flex items-start gap-3 text-[15px] text-axis-muted">
                  <Check size={17} className="mt-0.5 shrink-0 text-axis-blue" />
                  {area}
                </li>
              ))}
            </ul>

            <h2 className="mt-12 text-xl font-bold text-axis-navy">Handling</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-axis-muted">
              Supplied as a sealed vial of lyophilised powder. Store as specified and protect from
              light. Reconstitution, handling, and disposal are the responsibility of the
              receiving laboratory and should follow your institution&apos;s established
              protocols for research materials.
            </p>

            <ResearchNotice className="mt-10" />
          </div>

          {/* Spec panel */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="rounded-xl border border-axis-border bg-axis-surface p-7">
              <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-axis-navy">
                Specification
              </h2>
              <dl className="mt-5 space-y-4">
                {specs.map(([label, value]) => (
                  <div key={label} className="border-b border-axis-border pb-4 last:border-0 last:pb-0">
                    <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-axis-faint">
                      {label}
                    </dt>
                    <dd className="mt-1.5 text-[15px] font-medium text-axis-navy">{value}</dd>
                  </div>
                ))}
              </dl>

              <Button href="/contact" className="mt-7 w-full">
                Request pricing
              </Button>
              <p className="mt-4 text-center text-xs leading-relaxed text-axis-faint">
                Quantities, bulk pricing, and the current batch certificate of analysis are
                supplied on request.
              </p>
            </div>
          </aside>
        </div>
      </Container>

      {related.length > 0 && (
        <div className="border-t border-axis-border bg-axis-surface">
          <Container className="py-16">
            <h2 className="text-2xl font-bold tracking-tight text-axis-navy">
              Related compounds
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {related.map((p) => (
                <Link
                  key={p.slug}
                  href={`/products/${p.slug}`}
                  className="focus-ring rounded-xl border border-axis-border bg-white p-6 transition-shadow hover:shadow-[0_6px_20px_rgba(20,32,63,0.08)]"
                >
                  <h3 className="text-lg font-bold text-axis-navy">{p.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-axis-muted">{p.summary}</p>
                </Link>
              ))}
            </div>
          </Container>
        </div>
      )}
    </>
  );
}
