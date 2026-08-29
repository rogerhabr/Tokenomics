import { createPublicClient } from '@/lib/supabase/public';

/**
 * The lot register — every batch AXIS LABS has assayed, including the ones that
 * failed specification.
 *
 * Read through the session-free public client so product pages stay statically
 * generated; row-level security still restricts anonymous reads to rows with
 * `published = true`.
 *
 * Every function returns an empty result rather than throwing. The register is
 * a public marketing surface: a missing environment variable on a preview
 * deploy must render "no assays published yet", not a 500. Callers tell the two
 * situations apart with `available` — read successfully and empty is a
 * different sentence from could not read at all.
 */

export const RELEASE_SPEC_PCT = 99.0;

export type LotStatus = 'released' | 'retained' | 'rejected';

export type Lot = {
  lotCode: string;
  productSlug: string;
  vialSize: string | null;
  receiptDate: string | null;
  assayDate: string | null;
  purityPct: number | null;
  method: string | null;
  msResult: string | null;
  labLegalName: string | null;
  labAccreditationBody: string | null;
  labAccreditationNumber: string | null;
  reportNumber: string | null;
  verifyUrl: string | null;
  hasCertificate: boolean;
  status: LotStatus;
};

export type LotQuery = {
  lots: Lot[];
  /** False when the register could not be read at all, as opposed to read
   *  successfully and found empty. */
  available: boolean;
};

type LotRow = {
  lot_code: string;
  product_slug: string;
  vial_size: string | null;
  receipt_date: string | null;
  assay_date: string | null;
  hplc_purity_pct: string | number | null;
  method: string | null;
  ms_result: string | null;
  lab_legal_name: string | null;
  lab_accreditation_body: string | null;
  lab_accreditation_number: string | null;
  report_number: string | null;
  verify_url: string | null;
  coa_path: string | null;
  status: LotStatus;
};

const COLUMNS =
  'lot_code, product_slug, vial_size, receipt_date, assay_date, hplc_purity_pct, method, ms_result, lab_legal_name, lab_accreditation_body, lab_accreditation_number, report_number, verify_url, coa_path, status';

const EMPTY: LotQuery = { lots: [], available: false };

function toLot(row: LotRow): Lot {
  return {
    lotCode: row.lot_code,
    productSlug: row.product_slug,
    vialSize: row.vial_size,
    receiptDate: row.receipt_date,
    assayDate: row.assay_date,
    // numeric() arrives as a string from PostgREST. Keep null distinct from 0
    // so an unassayed lot never plots at the bottom of the purity axis.
    purityPct: row.hplc_purity_pct === null ? null : Number(row.hplc_purity_pct),
    method: row.method,
    msResult: row.ms_result,
    labLegalName: row.lab_legal_name,
    labAccreditationBody: row.lab_accreditation_body,
    labAccreditationNumber: row.lab_accreditation_number,
    reportNumber: row.report_number,
    verifyUrl: row.verify_url,
    hasCertificate: !!row.coa_path,
    status: row.status,
  };
}

/** Every published lot, newest assay first. */
export async function getAllLots(): Promise<LotQuery> {
  const client = createPublicClient();
  if (!client) return EMPTY;
  try {
    const { data, error } = await client
      .from('lots')
      .select(COLUMNS)
      .order('assay_date', { ascending: false, nullsFirst: false });
    if (error || !data) return EMPTY;
    return { lots: (data as LotRow[]).map(toLot), available: true };
  } catch {
    return EMPTY;
  }
}

/** Published lots for one compound, newest assay first. */
export async function getLotsForProduct(slug: string): Promise<LotQuery> {
  const client = createPublicClient();
  if (!client) return EMPTY;
  try {
    const { data, error } = await client
      .from('lots')
      .select(COLUMNS)
      .eq('product_slug', slug)
      .order('assay_date', { ascending: false, nullsFirst: false });
    if (error || !data) return EMPTY;
    return { lots: (data as LotRow[]).map(toLot), available: true };
  } catch {
    return EMPTY;
  }
}

/** One published lot by its code. */
export async function getLot(lotCode: string): Promise<Lot | null> {
  const client = createPublicClient();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('lots')
      .select(COLUMNS)
      .eq('lot_code', lotCode)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return toLot(data[0] as LotRow);
  } catch {
    return null;
  }
}

/** Counts for the register head. Derived from the rows, never asserted. */
export function summarise(lots: Lot[]) {
  return {
    assayed: lots.length,
    released: lots.filter((l) => l.status === 'released').length,
    retained: lots.filter((l) => l.status === 'retained').length,
    rejected: lots.filter((l) => l.status === 'rejected').length,
  };
}
