import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Container,
  Rail,
  Rule,
  Section,
  SectionHead,
  Specimen,
  DataList,
  ArrowLink,
  ResearchNotice,
  type DataRow,
} from '@/components/marketing/ui';
import Structure from '@/components/marketing/Structure';
import JsonLd from '@/components/marketing/JsonLd';
import PurityPlot from '@/components/marketing/PurityPlot';
import AddToCart from '@/components/marketing/AddToCart';
import { CATEGORIES, PRODUCTS, getProduct } from '@/lib/products';
import { getVariantsFor } from '@/lib/variants';
import { getMolecule, hasStructure, pubchemUrl } from '@/lib/molecules';
import { getLotsForProduct, RELEASE_SPEC_PCT } from '@/lib/lots';
import { absolute, SITE_NAME } from '@/lib/site';

export const revalidate = 3600;

export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = getProduct(params.slug);
  if (!product) return { title: 'Compound not found — Axis Labs' };
  const molecule = getMolecule(product.slug);
  return {
    title: `${product.name} — Research Compound | Axis Labs`,
    description: `${product.summary}${
      molecule?.formula ? ` Molecular formula ${molecule.formula}.` : ''
    } Supplied at ${product.purity} for laboratory research use only.`,
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  const category = CATEGORIES.find((c) => c.id === product.category);
  const variants = await getVariantsFor(product.slug);
  const molecule = getMolecule(product.slug);
  const { lots } = await getLotsForProduct(product.slug);
  const related = PRODUCTS.filter(
    (p) => p.category === product.category && p.slug !== product.slug
  ).slice(0, 4);

  /**
   * Block 01 — REFERENCE IDENTITY. Public registry facts about the molecule.
   * Every value carries its PubChem CID, so a reader can tell a registry
   * lookup from a measurement we made.
   */
  const referenceRef = molecule ? `PubChem CID ${molecule.cid}` : undefined;
  const reference: DataRow[] = [
    {
      label: 'Molecular formula',
      value: molecule?.formula ?? undefined,
      source: molecule?.formula ? 'reference' : 'unconfirmed',
      sourceRef: molecule?.formula ? referenceRef : undefined,
      reason: 'Not held in a public registry under this name.',
    },
    {
      label: 'Molecular weight',
      value: molecule?.weight ? `${molecule.weight} g/mol` : undefined,
      source: molecule?.weight ? 'reference' : 'unconfirmed',
      sourceRef: molecule?.weight ? referenceRef : undefined,
      reason: 'Not held in a public registry under this name.',
    },
    {
      label: 'CAS number',
      value: molecule?.cas ?? undefined,
      source: molecule?.cas ? 'reference' : 'unconfirmed',
      sourceRef: molecule?.cas ? referenceRef : undefined,
      reason: 'No CAS registry number is published for this compound.',
    },
    {
      label: 'InChIKey',
      value: molecule?.inchiKey ? (
        <span className="ident">{molecule.inchiKey}</span>
      ) : undefined,
      source: molecule?.inchiKey ? 'reference' : 'unconfirmed',
      sourceRef: molecule?.inchiKey ? referenceRef : undefined,
      reason: 'Not held in a public registry under this name.',
    },
  ];

  /**
   * Block 02 — LOT DATA. What our own certificate measured. Deliberately never
   * mixed with the block above: a registry value and a batch measurement are
   * different claims, and blurring them is the thing this page exists to
   * avoid.
   */
  const current = lots.find((l) => l.status === 'released') ?? null;
  const lotData: DataRow[] = [
    {
      label: 'Release specification',
      value: `≥${RELEASE_SPEC_PCT.toFixed(1)}% by HPLC`,
      source: 'lot',
      sourceRef: 'Axis Labs release standard',
    },
    {
      label: 'Assayed purity',
      value: current?.purityPct != null ? `${current.purityPct.toFixed(1)}%` : undefined,
      source: current?.purityPct != null ? 'lot' : 'unconfirmed',
      sourceRef: current ? `Certificate for lot ${current.lotCode}` : undefined,
      reason: 'No lot record published yet. The certificate is supplied with your order.',
    },
    {
      label: 'Identity',
      value: current?.msResult ?? undefined,
      source: current?.msResult ? 'lot' : 'unconfirmed',
      sourceRef: current ? `Certificate for lot ${current.lotCode}` : undefined,
      reason: 'Confirmed by mass spectrometry on each lot; the result is on the certificate.',
    },
    {
      label: 'Current lot',
      value: current ? <span className="ident">{current.lotCode}</span> : undefined,
      source: current ? 'lot' : 'unconfirmed',
      reason: 'Allocated at dispatch and printed on the vial.',
    },
  ];

  const handling: DataRow[] = [
    { label: 'Form', value: product.form, source: 'lot' },
    {
      label: 'Presentation',
      value: product.presentation ?? undefined,
      source: product.presentation ? 'lot' : 'unconfirmed',
      reason: 'Vial format confirmed at order. Ask us for the current fill.',
    },
    { label: 'Storage', value: product.storage, source: 'lot' },
  ];

  // Chemical identity, not merchandising. Fields are omitted entirely rather
  // than emitted empty when the registry has no entry for this compound.
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'MolecularEntity',
        '@id': absolute(`/products/${product.slug}#molecule`),
        name: product.name,
        ...(product.alias ? { alternateName: product.alias } : {}),
        description: product.summary,
        url: absolute(`/products/${product.slug}`),
        ...(molecule?.formula ? { molecularFormula: molecule.formula } : {}),
        ...(molecule?.weight ? { molecularWeight: molecule.weight } : {}),
        ...(molecule?.inchiKey ? { inChIKey: molecule.inchiKey } : {}),
        ...(molecule
          ? {
              sameAs: pubchemUrl(molecule.cid),
              subjectOf: {
                '@type': 'Dataset',
                name: `PubChem CID ${molecule.cid}`,
                url: pubchemUrl(molecule.cid),
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: absolute('/') },
          { '@type': 'ListItem', position: 2, name: 'Compounds', item: absolute('/products') },
          {
            '@type': 'ListItem',
            position: 3,
            name: category?.name ?? 'Research class',
            item: absolute(`/products?class=${product.category}`),
          },
          { '@type': 'ListItem', position: 4, name: product.name },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />

      <Container className="pt-[26px]">
        <Link
          href={`/products?class=${product.category}`}
          className="t-2 inline-flex items-center gap-[8px] text-axis-ink-500 hover:text-axis-ink"
        >
          <span aria-hidden="true" className="data">
            ←
          </span>
          {category?.name}
        </Link>
      </Container>

      {/* Identity + the order panel. The buy path is on the first screen. */}
      <Container className="pt-[26px]">
        <div className="grid gap-[52px] lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-[78px]">
          <div>
            <Rail label={category?.name} index="01">
              <h1 className="t-7 text-axis-ink">{product.name}</h1>
              {product.alias && (
                <p className="t-3 mt-[8px] text-axis-ink-500">{product.alias}</p>
              )}

              {/* The specimen. A text node, so it is also the LCP element —
                  which is the whole point of a site with no images. */}
              {molecule?.formula ? (
                <div className="mt-[39px]">
                  <Specimen formula={molecule.formula} />
                  <div className="spec-rule draw mt-[13px]" />
                  <p className="t-1 mt-[13px] text-axis-ink-300">
                    Reference identity · PubChem CID {molecule.cid} · Not lot data
                  </p>
                </div>
              ) : (
                <div className="mt-[39px] border-y border-axis-rule-2 py-[26px]">
                  <p className="t-3 text-axis-ink-500">
                    No public registry entry exists for this compound under its published names,
                    so no reference formula is shown. Identity is confirmed per lot by mass
                    spectrometry and stated on the certificate.
                  </p>
                </div>
              )}

              <p className="t-5 mt-[39px] max-w-[54ch] text-axis-ink-500">{product.summary}</p>
            </Rail>
          </div>

          {/* Order panel — a sunk register with a rule-3 edge. Encapsulation is
              what reads as secure; this is the only place on the site with a
              solid fill. */}
          <aside className="lg:sticky lg:top-[calc(var(--header-h)+26px)] lg:self-start">
            <div className="border border-axis-rule-3 bg-axis-sunk p-[26px]">
              <h2 className="t-1 text-axis-ink-300">Order</h2>
              <div className="mt-[20px]">
                <AddToCart variants={variants} />
              </div>
              <Rule className="mt-[26px]" />
              <p className="t-2 mt-[20px] text-axis-ink-500">
                Nothing is charged on this site. We confirm stock, allocate a lot, and reply by
                email with an itemised invoice and the lot certificate.
              </p>
              <p className="t-2 mt-[13px] text-axis-ink-500">
                Bulk quantities and purchase orders:{' '}
                <Link href="/contact" className="text-axis-ink underline underline-offset-[4px]">
                  contact the team
                </Link>
                .
              </p>
            </div>
          </aside>
        </div>
      </Container>

      {/* The structure, where one is worth drawing. */}
      {hasStructure(product.slug) && (
        <Section className="py-[78px]">
          <Container>
            <Rail label="Structure" index="02">
              <Structure
                slug={product.slug}
                label={`Two-dimensional structure of ${product.name}`}
                className="mx-auto max-h-[420px] w-full max-w-[720px] text-axis-ink [&_svg]:h-auto [&_svg]:max-h-[420px] [&_svg]:w-full"
              />
              <p className="t-1 mt-[20px] text-axis-ink-300">
                Drawn from PubChem coordinate data, CID {molecule?.cid}. Reference identity, not
                lot data.
              </p>
            </Rail>
          </Container>
        </Section>
      )}

      {/* The two-source rule, made structural. */}
      <Section className="pt-0">
        <Container>
          <div className="grid gap-[52px] lg:grid-cols-2 lg:gap-[78px]">
            <div>
              <h2 className="t-1 text-axis-ink-300">01 — Reference identity</h2>
              <p className="t-2 mt-[8px] text-axis-ink-500">
                Public registry facts about the molecule.
              </p>
              <DataList rows={reference} className="mt-[20px]" />
              {molecule && (
                <p className="t-1 mt-[13px] text-axis-ink-300">
                  <a
                    href={pubchemUrl(molecule.cid)}
                    className="underline underline-offset-[4px]"
                    rel="noreferrer"
                  >
                    PubChem CID {molecule.cid}
                  </a>
                </p>
              )}
            </div>

            <div>
              <h2 className="t-1 text-axis-ink-300">02 — Lot data</h2>
              <p className="t-2 mt-[8px] text-axis-ink-500">
                What our own certificate measured for the batch you receive.
              </p>
              <DataList rows={lotData} className="mt-[20px]" />
            </div>
          </div>
        </Container>
      </Section>

      {/* Purity against the spec line, for this compound. */}
      <Section className="pt-0">
        <Container>
          <SectionHead index="03" rail="Assays" title="Every lot, against the line." />
          <div className="mt-[39px]">
            <PurityPlot lots={lots} scope={product.name} />
          </div>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <div className="grid gap-[52px] lg:grid-cols-2 lg:gap-[78px]">
            <div>
              <h2 className="t-1 text-axis-ink-300">04 — Research applications</h2>
              <ul className="mt-[20px] border-t border-axis-rule-2">
                {product.researchAreas.map((area) => (
                  <li
                    key={area}
                    className="t-3 border-b border-axis-rule-1 py-[13px] text-axis-ink-500"
                  >
                    {area}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="t-1 text-axis-ink-300">05 — Handling</h2>
              <DataList rows={handling} className="mt-[20px]" />
              <p className="t-3 mt-[20px] text-axis-ink-500">
                Reconstitution, handling and disposal are the responsibility of the receiving
                laboratory and should follow your institution&rsquo;s established protocols for
                research materials. Axis Labs does not publish handling protocols.
              </p>
            </div>
          </div>
        </Container>
      </Section>

      {related.length > 0 && (
        <Section className="pt-0">
          <Container>
            <SectionHead index="06" rail="Related" title={`Also in ${category?.name}`} />
            <ul className="mt-[26px] border-t border-axis-rule-2">
              {related.map((p) => {
                const m = getMolecule(p.slug);
                return (
                  <li key={p.slug} className="border-b border-axis-rule-1">
                    <Link
                      href={`/products/${p.slug}`}
                      className="grid items-baseline gap-x-[26px] gap-y-[4px] py-[16px] transition-colors duration-[--dur-1] hover:bg-axis-plate sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                    >
                      <span className="t-4 text-axis-ink">{p.name}</span>
                      <span className="data t-2 text-axis-ink-500">{m?.formula ?? ''}</span>
                      <span aria-hidden="true" className="data t-2 text-axis-ink-300">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-[26px]">
              <ArrowLink href="/products">The whole register</ArrowLink>
            </div>
          </Container>
        </Section>
      )}

      <ResearchNotice />
    </>
  );
}
