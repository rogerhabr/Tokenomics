import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Container,
  PageHead,
  Section,
  DataList,
  StatusChip,
  ArrowLink,
  ResearchNotice,
  type DataRow,
} from '@/components/marketing/ui';
import { getLot, RELEASE_SPEC_PCT } from '@/lib/lots';
import { getProduct } from '@/lib/products';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: { lot: string };
}): Promise<Metadata> {
  const lot = await getLot(decodeURIComponent(params.lot));
  if (!lot) return { title: 'Lot not found — Axis Labs' };
  const product = getProduct(lot.productSlug);
  return {
    title: `Lot ${lot.lotCode} — ${product?.name ?? 'Research compound'} | Axis Labs`,
    description: `Assay record for lot ${lot.lotCode}: purity, method, testing laboratory and status against the ≥${RELEASE_SPEC_PCT.toFixed(1)}% release specification.`,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 10);
}

export default async function LotPage({ params }: { params: { lot: string } }) {
  const lot = await getLot(decodeURIComponent(params.lot));
  if (!lot) notFound();

  const product = getProduct(lot.productSlug);

  const analysis: DataRow[] = [
    {
      label: 'Release specification',
      value: `≥${RELEASE_SPEC_PCT.toFixed(1)}% by HPLC`,
      source: 'lot',
    },
    {
      label: 'Assayed purity',
      value: lot.purityPct != null ? `${lot.purityPct.toFixed(1)}%` : undefined,
      source: lot.purityPct != null ? 'lot' : 'unconfirmed',
      reason: 'Not recorded on this certificate.',
    },
    {
      label: 'Method',
      value: lot.method ?? undefined,
      source: lot.method ? 'lot' : 'unconfirmed',
      reason: 'Not recorded on this certificate.',
    },
    {
      label: 'Identity',
      value: lot.msResult ?? undefined,
      source: lot.msResult ? 'lot' : 'unconfirmed',
      reason: 'Not recorded on this certificate.',
    },
    {
      label: 'Sample received',
      value: lot.receiptDate ? formatDate(lot.receiptDate) : undefined,
      source: lot.receiptDate ? 'lot' : 'unconfirmed',
      reason: 'Not recorded.',
    },
    {
      label: 'Assayed',
      value: lot.assayDate ? formatDate(lot.assayDate) : undefined,
      source: lot.assayDate ? 'lot' : 'unconfirmed',
      reason: 'Not recorded.',
    },
  ];

  // Most contract analytical laboratories prohibit use of their name in
  // advertising, and this site is advertising. Without written name-use
  // consent the row publishes as withheld rather than inventing an
  // attribution or quietly dropping the field.
  const laboratory: DataRow[] = [
    {
      label: 'Testing laboratory',
      value: lot.labLegalName ?? undefined,
      source: lot.labLegalName ? 'lot' : 'unconfirmed',
      reason: 'Laboratory name withheld pending written name-use consent.',
    },
    {
      label: 'Accreditation',
      value:
        lot.labAccreditationBody && lot.labAccreditationNumber
          ? `${lot.labAccreditationBody} ${lot.labAccreditationNumber}`
          : undefined,
      source: lot.labAccreditationBody ? 'lot' : 'unconfirmed',
      reason: 'Not published for this lot.',
    },
    {
      label: 'Report number',
      value: lot.reportNumber ? <span className="ident">{lot.reportNumber}</span> : undefined,
      source: lot.reportNumber ? 'lot' : 'unconfirmed',
      reason: 'Not published for this lot.',
    },
  ];

  return (
    <>
      <Container className="pt-[26px]">
        <Link
          href="/lots"
          className="t-2 inline-flex items-center gap-[8px] text-axis-ink-500 hover:text-axis-ink"
        >
          <span aria-hidden="true" className="data">
            ←
          </span>
          Lot register
        </Link>
      </Container>

      <PageHead
        index="01"
        rail="Lot record"
        title={lot.lotCode}
        standfirst={
          product
            ? `${product.name}${lot.vialSize ? `, ${lot.vialSize}` : ''}.`
            : 'Assay record.'
        }
      >
        <div className="mt-[20px]">
          <StatusChip status={lot.status} />
        </div>
      </PageHead>

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          <div className="grid gap-[52px] lg:grid-cols-2 lg:gap-[78px]">
            <div>
              <h2 className="t-1 text-axis-ink-300">01 — Analysis</h2>
              <DataList rows={analysis} className="mt-[20px]" />
            </div>
            <div>
              <h2 className="t-1 text-axis-ink-300">02 — Laboratory</h2>
              <DataList rows={laboratory} className="mt-[20px]" />

              {lot.verifyUrl && (
                <p className="t-2 mt-[20px]">
                  <a
                    href={lot.verifyUrl}
                    rel="noreferrer nofollow"
                    className="text-axis-ink underline underline-offset-[4px]"
                  >
                    Verify this report with the laboratory
                  </a>
                </p>
              )}

              {lot.hasCertificate && (
                <div className="mt-[26px]">
                  <ArrowLink href={`/lots/${encodeURIComponent(lot.lotCode)}/certificate`}>
                    Certificate of analysis
                  </ArrowLink>
                </div>
              )}
            </div>
          </div>

          {product && (
            <p className="t-3 mt-[52px] text-axis-ink-500">
              This record describes a research chemical and is not a pharmaceutical certificate.{' '}
              <Link
                href={`/products/${product.slug}`}
                className="text-axis-ink underline underline-offset-[4px]"
              >
                {product.name}
              </Link>
            </p>
          )}
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
