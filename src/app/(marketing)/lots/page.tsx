import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Container,
  PageHead,
  Section,
  SectionHead,
  StatusChip,
  ResearchNotice,
  ArrowLink,
} from '@/components/marketing/ui';
import PurityPlot from '@/components/marketing/PurityPlot';
import { getAllLots, summarise, RELEASE_SPEC_PCT } from '@/lib/lots';
import { getProduct } from '@/lib/products';

export const metadata: Metadata = {
  title: 'Lot Records — Every Assay, Including Failures | Axis Labs',
  description:
    'The Axis Labs lot register: every batch assayed against the ≥99.0% release specification, with releases, retentions and rejections recorded in the same table.',
};

export const revalidate = 3600;

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toISOString().slice(0, 10);
}

export default async function LotsPage() {
  const { lots, available } = await getAllLots();
  const counts = summarise(lots);

  return (
    <>
      <PageHead
        index="01"
        rail="Lot records"
        title="Every assay, including the ones that failed."
        standfirst={`A supplier who publishes only the lots that passed has published nothing. This register carries every batch we have assayed against the ≥${RELEASE_SPEC_PCT.toFixed(
          1
        )}% release specification — released, retained and rejected in the same table.`}
      />

      <Section className="py-[52px] lg:py-[78px]">
        <Container>
          {/* Figures are counted from the rows, never asserted. */}
          {available && counts.assayed > 0 && (
            <dl className="grid gap-[26px] border-y border-axis-rule-2 py-[26px] sm:grid-cols-4">
              {[
                ['Lots assayed', counts.assayed],
                ['Released', counts.released],
                ['Retained', counts.retained],
                ['Rejected', counts.rejected],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="t-1 text-axis-ink-300">{label}</dt>
                  <dd className="data t-6 mt-[4px] text-axis-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-[39px]">
            <PurityPlot lots={lots} scope="the catalogue" />
          </div>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <SectionHead index="02" rail="Register" title="The record." />

          {lots.length === 0 ? (
            <div className="mt-[39px] border-y border-axis-rule-2 py-[52px]">
              <p className="t-4 max-w-measure text-axis-ink">
                No lot records are published yet.
              </p>
              <p className="t-3 mt-[13px] max-w-measure text-axis-ink-500">
                Certificates of analysis are supplied with every order and available on request
                before you order. This register is where those records will be published so they
                can be checked without asking us — including the lots that did not meet
                specification.
              </p>
              <div className="mt-[26px]">
                <ArrowLink href="/contact">Request a certificate of analysis</ArrowLink>
              </div>
            </div>
          ) : (
            <div className="mt-[39px]">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Every published lot: compound, assay date, purity, status and certificate.
                </caption>
                <thead>
                  <tr className="hidden border-b border-axis-rule-3 lg:table-row">
                    <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
                      Lot
                    </th>
                    <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
                      Compound
                    </th>
                    <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
                      Assayed
                    </th>
                    <th
                      scope="col"
                      className="t-1 py-[10px] pr-[20px] text-right text-axis-ink-300"
                    >
                      Purity
                    </th>
                    <th scope="col" className="t-1 py-[10px] pr-[20px] text-axis-ink-300">
                      Status
                    </th>
                    <th scope="col" className="t-1 py-[10px] text-axis-ink-300">
                      Record
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lots.map((lot) => {
                    const product = getProduct(lot.productSlug);
                    return (
                      <tr
                        key={lot.lotCode}
                        className="register-row block border-b border-axis-rule-1 lg:table-row"
                      >
                        <td className="block py-[13px] pr-[20px] align-top lg:table-cell">
                          <span
                            className={`data ident t-2 ${
                              lot.status === 'rejected'
                                ? 'text-axis-ink-500 line-through'
                                : 'text-axis-ink'
                            }`}
                          >
                            {lot.lotCode}
                          </span>
                        </td>
                        <td className="block pb-[8px] pr-[20px] align-top lg:table-cell lg:py-[13px]">
                          <Link
                            href={`/products/${lot.productSlug}`}
                            className="t-2 text-axis-ink underline decoration-axis-rule-2 underline-offset-[4px]"
                          >
                            {product?.name ?? lot.productSlug}
                          </Link>
                        </td>
                        <td className="block pb-[8px] pr-[20px] align-top lg:table-cell lg:py-[13px]">
                          <span className="data t-2 text-axis-ink-500">
                            {formatDate(lot.assayDate)}
                          </span>
                        </td>
                        <td className="block pb-[8px] align-top lg:table-cell lg:py-[13px] lg:pr-[20px] lg:text-right">
                          <span className="data t-2 text-axis-ink">
                            {lot.purityPct != null ? `${lot.purityPct.toFixed(1)}%` : '—'}
                          </span>
                        </td>
                        <td className="block pb-[8px] pr-[20px] align-top lg:table-cell lg:py-[13px]">
                          <StatusChip status={lot.status} />
                        </td>
                        <td className="block pb-[13px] align-top lg:table-cell lg:py-[13px]">
                          <Link
                            href={`/lots/${encodeURIComponent(lot.lotCode)}`}
                            className="t-2 text-axis-ink underline decoration-axis-rule-2 underline-offset-[4px]"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="t-2 mt-[26px] max-w-measure text-axis-ink-300">
            Released means the lot met the release specification and shipped. Retained means it is
            held pending investigation or re-assay. Rejected means it failed specification and was
            not sold.
          </p>
        </Container>
      </Section>

      <ResearchNotice />
    </>
  );
}
