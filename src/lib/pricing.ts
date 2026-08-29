import { variantsFor, type Variant } from '@/lib/products';

/**
 * Comparison arithmetic for the catalogue.
 *
 * A vial price is not comparable across compounds — a 5 mg vial and a 50 mg
 * vial at similar money are very different offers, and this buyer works in
 * mass. Deriving $/mg from the variant label makes the register sortable on the
 * axis the buyer actually cares about.
 *
 * Money stays in integer cents everywhere; only the per-mg figure is
 * fractional, and it is computed for display, never stored or charged.
 */

/**
 * Total milligrams in a variant, parsed from its label.
 *
 * Handles the two shapes the catalogue uses: "10 mg vial" and multi-packs like
 * "10 x 15 mg kit", where the total is the product of the two figures. Returns
 * null for anything it cannot read with confidence, so an unparseable label
 * shows no $/mg rather than a wrong one.
 */
export function mgFromLabel(label: string): number | null {
  const normalised = label.toLowerCase().replace(/×/g, 'x');

  // "10 x 15 mg" — a pack of n vials of m mg.
  const pack = normalised.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*mg/);
  if (pack) {
    const count = parseFloat(pack[1]);
    const each = parseFloat(pack[2]);
    if (Number.isFinite(count) && Number.isFinite(each)) return count * each;
  }

  // "15 mg vial"
  const single = normalised.match(/(\d+(?:\.\d+)?)\s*mg/);
  if (single) {
    const mg = parseFloat(single[1]);
    if (Number.isFinite(mg)) return mg;
  }

  return null;
}

/** Price per milligram in cents, or null when the mass cannot be read. */
export function centsPerMg(variant: Variant): number | null {
  const mg = mgFromLabel(variant.label);
  if (mg === null || mg <= 0) return null;
  return variant.priceCents / mg;
}

/** The lowest $/mg across a compound's variants — the honest "from" figure. */
export function bestCentsPerMg(slug: string): number | null {
  const rates = variantsFor(slug)
    .map(centsPerMg)
    .filter((r): r is number => r !== null);
  return rates.length ? Math.min(...rates) : null;
}

/** Formats a per-mg rate. Always two decimals — every rate in the catalogue
 *  falls between $0.09 and $9.00/mg, where two decimals is exact enough to
 *  compare and short enough to scan in a column. */
export function formatPerMg(cents: number): string {
  return `$${(cents / 100).toFixed(2)}/mg`;
}
