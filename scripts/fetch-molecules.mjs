/**
 * Fetches reference chemistry for the AXIS LABS catalogue from PubChem (NIH/NLM)
 * and renders each compound's 2D structure as an SVG in the site's own line
 * weight, so every product has an accurate, self-owned visual.
 *
 * Run:  node scripts/fetch-molecules.mjs
 * Writes: src/lib/molecules.generated.json  (formula, weight, CAS, CID)
 *         public/molecules/<slug>.svg       (2D structure line drawing)
 *
 * IMPORTANT — this is REFERENCE data about the molecule, from a public registry.
 * It is deliberately NOT written into the `casNumber` / `molecularWeight` fields
 * of `src/lib/products.ts`, which are reserved for values transcribed from a
 * real certificate of analysis. The two are shown separately on the product page
 * and the reference values are always cited to their PubChem CID, so a visitor
 * can tell a registry value from a batch measurement. See CLAUDE.md.
 *
 * PubChem data is produced by the US National Library of Medicine and is free of
 * copyright restriction. We render the structures ourselves from the coordinate
 * data rather than embedding PubChem's own depiction images.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT_JSON = path.join(ROOT, 'src/lib/molecules.generated.json');
const OUT_SVG_DIR = path.join(ROOT, 'public/molecules');

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound';

/**
 * Catalogue slug -> the names to try against PubChem, most specific first.
 * A `null` entry is a deliberate opt-out: blends have no single structure, so
 * there is nothing honest to draw.
 */
const LOOKUP = {
  tirzepatide: ['tirzepatide'],
  retatrutide: ['retatrutide', 'LY3437943'],
  cagrilintide: ['cagrilintide', 'AM833'],
  semax: ['semax'],
  selank: ['selank'],
  'bpc-157': ['BPC-157', 'pentadecapeptide BPC 157'],
  'tb-500': ['thymosin beta-4', 'TB-500'],
  tesamorelin: ['tesamorelin'],
  ipamorelin: ['ipamorelin'],
  'dual-pathway-research-blend': null,
  'pt-141': ['bremelanotide', 'PT-141'],
  oxytocin: ['oxytocin'],
  'kisspeptin-10': ['kisspeptin-10', 'metastin 45-54'],
  'ghk-cu': ['GHK-Cu', 'copper tripeptide-1', 'glycyl-histidyl-lysine'],
  'melanotan-i': ['afamelanotide', 'melanotan I'],
  'ss-31': ['elamipretide', 'SS-31'],
  methylcobalamin: ['methylcobalamin'],
};

const CAS_RE = /^\d{2,7}-\d{2}-\d$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * PubChem rate-limits and occasionally 500s. Without a retry a transient blip
 * silently drops a compound from the catalogue's reference data, which is worse
 * than failing loudly — so every request gets three attempts with backoff, and
 * a 404 (genuinely unknown name) short-circuits instead of burning retries.
 */
async function fetchWithRetry(url, init, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (res.status === 404) return res;
      lastErr = new Error(`${res.status} ${url}`);
    } catch (err) {
      lastErr = err;
    }
    if (i < attempts - 1) await sleep(600 * 2 ** i);
  }
  throw lastErr ?? new Error(`failed ${url}`);
}

async function getJson(url) {
  const res = await fetchWithRetry(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function lookup(names) {
  for (const name of names) {
    try {
      const enc = encodeURIComponent(name);
      const props = await getJson(
        `${PUG}/name/${enc}/property/MolecularFormula,MolecularWeight/JSON`
      );
      const p = props?.PropertyTable?.Properties?.[0];
      if (!p?.CID) continue;

      let cas = null;
      try {
        const syn = await getJson(`${PUG}/cid/${p.CID}/synonyms/JSON`);
        const list = syn?.InformationList?.Information?.[0]?.Synonym ?? [];
        cas = list.find((s) => CAS_RE.test(s)) ?? null;
      } catch {
        // Synonyms are a nice-to-have; a missing CAS is reported as null rather
        // than failing the whole compound.
      }

      const sdfRes = await fetchWithRetry(`${PUG}/cid/${p.CID}/SDF?record_type=2d`);
      const sdf = sdfRes.ok ? await sdfRes.text() : null;

      return {
        matchedName: name,
        cid: p.CID,
        formula: p.MolecularFormula ?? null,
        weight: p.MolecularWeight ?? null,
        cas,
        sdf,
      };
    } catch {
      // Try the next alias.
    }
  }
  return null;
}

// --- SDF (V2000) -> SVG ------------------------------------------------------

function parseSdf(text) {
  const lines = text.split(/\r?\n/);
  const counts = lines[3];
  if (!counts) return null;
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(nAtoms) || !Number.isFinite(nBonds)) return null;

  const atoms = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i];
    if (!l) return null;
    atoms.push({
      x: parseFloat(l.slice(0, 10)),
      y: parseFloat(l.slice(10, 20)),
      el: l.slice(31, 34).trim(),
    });
  }
  const bonds = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i];
    if (!l) return null;
    bonds.push({
      a: parseInt(l.slice(0, 3), 10) - 1,
      b: parseInt(l.slice(3, 6), 10) - 1,
      order: parseInt(l.slice(6, 9), 10),
    });
  }
  return { atoms, bonds };
}

/** Median bond length in the file's own coordinate units. */
function medianBondLength({ atoms, bonds }) {
  const lens = [];
  for (const bd of bonds) {
    const A = atoms[bd.a];
    const B = atoms[bd.b];
    if (A && B) lens.push(Math.hypot(B.x - A.x, B.y - A.y));
  }
  if (!lens.length) return 1;
  lens.sort((a, b) => a - b);
  return lens[Math.floor(lens.length / 2)] || 1;
}

/**
 * Renders the molecule as a single stroked path plus a heteroatom dot layer.
 *
 * Two things make one asset work everywhere:
 *  - Colour is left to CSS. The path strokes in `currentColor` and the
 *    heteroatom dots read a custom property, so the same file sits on a light
 *    or dark surface without being re-rendered.
 *  - Line weight is normalised to the molecule's own median BOND LENGTH rather
 *    than to the viewBox. A 46-atom tripeptide and a 689-atom peptide otherwise
 *    render at wildly different apparent weights, because fitting both to the
 *    same box scales their bonds differently. Tying the stroke to bond length
 *    makes every structure in the catalogue look drawn by the same hand.
 */
function toSvg(mol, { width = 1600, pad = 16, strokeRatio = 0.085 } = {}) {
  const { atoms, bonds } = mol;
  const xs = atoms.map((a) => a.x);
  const ys = atoms.map((a) => a.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const scale = (width - pad * 2) / w;
  const height = Math.round(h * scale + pad * 2);
  const px = (a) => +((a.x - minX) * scale + pad).toFixed(1);
  const py = (a) => +((maxY - a.y) * scale + pad).toFixed(1); // SVG y grows downward

  // Stroke and heteroatom radius are both derived from the median bond length,
  // measured in the same post-scale units as the drawing itself.
  const bondPx = medianBondLength(mol) * scale;
  const sw = +(bondPx * strokeRatio).toFixed(2);
  const dotR = +(bondPx * 0.1).toFixed(2);

  const d = [];
  for (const bd of bonds) {
    const A = atoms[bd.a];
    const B = atoms[bd.b];
    if (!A || !B) continue;
    const x1 = px(A), y1 = py(A), x2 = px(B), y2 = py(B);
    if (bd.order === 2 || bd.order === 3) {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ox = +((-dy / len) * sw * 1.9).toFixed(1);
      const oy = +((dx / len) * sw * 1.9).toFixed(1);
      if (bd.order === 3) d.push(`M${x1} ${y1}L${x2} ${y2}`);
      d.push(`M${x1 + ox} ${y1 + oy}L${x2 + ox} ${y2 + oy}`);
      d.push(`M${x1 - ox} ${y1 - oy}L${x2 - ox} ${y2 - oy}`);
    } else {
      d.push(`M${x1} ${y1}L${x2} ${y2}`);
    }
  }

  const dots = atoms
    .filter((a) => a.el && a.el !== 'C')
    .map((a) => `<circle cx="${px(a)}" cy="${py(a)}" r="${dotR}"/>`)
    .join('');

  // The heteroatom layer carries a class so a consumer can drop it — at small
  // sizes the dots read as noise, at plate size they carry the chemistry.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `fill="none" role="img" aria-hidden="true">` +
    `<path d="${d.join('')}" stroke="currentColor" stroke-width="${sw}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>` +
    `<g class="molecule-hetero" fill="var(--molecule-hetero, currentColor)">${dots}</g>` +
    `</svg>`
  );
}

// --- main --------------------------------------------------------------------

async function main() {
  fs.mkdirSync(OUT_SVG_DIR, { recursive: true });

  // Start from what is already committed and merge into it. A compound that
  // fails to resolve on this run then keeps its previous, known-good record
  // rather than silently vanishing from the catalogue's reference data.
  let out = {};
  if (fs.existsSync(OUT_JSON)) {
    try {
      out = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    } catch {
      out = {};
    }
  }

  const misses = [];
  const slugs = Object.keys(LOOKUP);

  for (const slug of slugs) {
    const names = LOOKUP[slug];
    if (names === null) {
      console.log(`- ${slug}: skipped (blend — no single structure)`);
      continue;
    }
    const hit = await lookup(names);
    if (!hit) {
      misses.push(slug);
      console.log(`! ${slug}: no PubChem match${out[slug] ? ' (keeping existing record)' : ''}`);
      continue;
    }

    let viewBox = null;
    let atomCount = null;
    if (hit.sdf) {
      const mol = parseSdf(hit.sdf);
      if (mol) {
        const svg = toSvg(mol);
        fs.writeFileSync(path.join(OUT_SVG_DIR, `${slug}.svg`), svg);
        viewBox = svg.match(/viewBox="([^"]+)"/)?.[1] ?? null;
        atomCount = mol.atoms.length;
      }
    }

    out[slug] = {
      cid: hit.cid,
      matchedName: hit.matchedName,
      formula: hit.formula,
      weight: hit.weight,
      cas: hit.cas,
      viewBox,
      atomCount,
      source: `https://pubchem.ncbi.nlm.nih.gov/compound/${hit.cid}`,
    };
    console.log(
      `✓ ${slug}: CID ${hit.cid} ${hit.formula ?? '?'} MW ${hit.weight ?? '?'} CAS ${hit.cas ?? '—'}${
        atomCount ? ` (${atomCount} atoms)` : ''
      }`
    );
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${Object.keys(out).length} compounds to ${path.relative(ROOT, OUT_JSON)}`);

  const expected = slugs.filter((s) => LOOKUP[s] !== null);
  const unresolved = expected.filter((s) => !out[s]);
  if (misses.length) console.log(`Unmatched this run: ${misses.join(', ')}`);
  if (unresolved.length) {
    console.error(`\nNo record at all for: ${unresolved.join(', ')}`);
    console.error('These compounds will render without reference chemistry.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
