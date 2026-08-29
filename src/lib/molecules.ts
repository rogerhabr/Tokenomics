import generated from './molecules.generated.json';

/**
 * Reference chemistry for the catalogue, resolved from PubChem at build time
 * by `scripts/fetch-molecules.mjs`.
 *
 * This is REFERENCE IDENTITY — public registry facts about the molecule. It is
 * deliberately separate from LOT DATA, which is what our own certificate of
 * analysis measured for a specific batch. The product page renders the two in
 * separately-headed blocks and never mixes them in one table, because a
 * registry value and a batch measurement are different claims.
 *
 * A compound with no entry here (retatrutide is not in PubChem under either of
 * its names, and the blend has no single structure) is reported as unconfirmed
 * rather than filled with a plausible-looking value.
 */

export type Molecule = {
  cid: number;
  matchedName: string;
  formula: string | null;
  weight: string | null;
  inchiKey?: string | null;
  cas: string | null;
  viewBox: string | null;
  atomCount: number | null;
  source: string;
};

const MOLECULES = generated as Record<string, Molecule>;

export function getMolecule(slug: string): Molecule | null {
  return MOLECULES[slug] ?? null;
}

/**
 * Whether a structure drawing is worth showing for this compound.
 *
 * Above roughly 250 atoms the 2D depiction of a peptide stops reading as a
 * structure and starts reading as line noise — tirzepatide is 689 atoms and
 * resolves to grey texture at any size a page can give it. Those compounds are
 * carried by the formula specimen instead, which differentiates them far
 * better: C225H348N48O68 and C62H98N16O22 look nothing alike.
 */
export const STRUCTURE_ATOM_LIMIT = 250;

export function hasStructure(slug: string): boolean {
  const m = getMolecule(slug);
  return !!m && !!m.viewBox && !!m.atomCount && m.atomCount <= STRUCTURE_ATOM_LIMIT;
}

/** PubChem's own compound page, for a citation link. */
export function pubchemUrl(cid: number): string {
  return `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;
}
