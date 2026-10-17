/**
 * Fails the build if fabricated analytical data appears in the marketing
 * source.
 *
 * The entire credibility argument of this site is that its figures are real:
 * lot codes match vials, purity figures come from an external laboratory, and
 * rejections are published alongside releases. A plausible-looking example lot
 * or a hard-coded "99.4% HPLC" in a component — even one added as a design
 * placeholder — turns that argument into exactly the pretextual claim the
 * research-use framing must not be.
 *
 * So analytical values may only ever reach a page from the `lots` table. This
 * check is the mechanical guarantee of that, and it runs in CI.
 *
 * Run: node scripts/check-no-fabricated-data.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src/app/(marketing)', 'src/components/marketing'];

const PATTERNS = [
  {
    // A lot code in the shape this business uses.
    re: /\bAX-\d{4}-\d{2,4}\b/,
    what: 'a lot code',
  },
  {
    // "97.1% HPLC", "99.4 % RP-HPLC" — a specific assayed purity figure.
    re: /\d{1,2}\.\d\s*%\s*(RP-)?HPLC/i,
    what: 'an assayed purity figure',
  },
  {
    // "14 lots published", "9 LOTS ASSAYED" — a counted claim about the
    // register that was not counted from the register.
    re: /\b\d+\s+lots?\s+(published|assayed|released|rejected)\b/i,
    what: 'a lot count',
  },
];

/**
 * The release specification itself is a policy statement, not a measurement,
 * and it is defined in exactly one place. Lines that reference that constant
 * are the legitimate way to render it.
 */
const ALLOWED_LINE = /RELEASE_SPEC_PCT|toFixed\(1\)/;

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const findings = [];

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (ALLOWED_LINE.test(line)) return;
      for (const { re, what } of PATTERNS) {
        if (re.test(line)) {
          findings.push({ file, line: i + 1, what, text: line.trim().slice(0, 120) });
        }
      }
    });
  }
}

if (findings.length > 0) {
  console.error('Fabricated analytical data found in the marketing source.\n');
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line} — ${f.what}`);
    console.error(`    ${f.text}\n`);
  }
  console.error(
    'Analytical values may only reach a page from the lots table. If you need a\n' +
      'figure for layout, render the real empty state instead.'
  );
  process.exit(1);
}

console.log('No fabricated analytical data in the marketing source.');
