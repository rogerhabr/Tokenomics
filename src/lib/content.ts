import { createPublicClient } from '@/lib/supabase/public';
import { PRODUCTS } from '@/lib/products';

/**
 * Editable page copy.
 *
 * Every editable string is declared here with the text that is in source as its
 * fallback, so an empty `site_content` table renders exactly what the
 * repository says. A database row exists only where something has been changed,
 * which keeps "what did we edit?" answerable and makes reverting a string a
 * delete rather than a re-transcription.
 *
 * WHAT IS DELIBERATELY NOT EDITABLE: the research-use notice, the policy pages,
 * and anything asserting an analytical figure. Those are disclosures reviewed in
 * a diff, not copy. See `FORBIDDEN` below for the guard on what may be typed
 * into the fields that ARE editable.
 */

export type ContentKind = 'line' | 'block' | 'list';

export type ContentField = {
  key: string;
  label: string;
  group: string;
  kind: ContentKind;
  /** The text compiled into the repository. Shown when no override exists. */
  fallback: string;
  help?: string;
};

export type ContentMap = Record<string, string>;

/* -------------------------------------------------------------------------
   Defaults for the standalone page copy. Product text comes from products.ts
   and is appended below, so there is one source of truth per string.
   ------------------------------------------------------------------------- */

export const HOME_DEFAULTS = {
  title: 'Purity you can check, not purity we assert.',
  standfirst:
    'Axis Labs supplies research compounds for laboratory and in vitro study. Every lot is assayed by an independent laboratory against a release specification you can see, and the result is recorded whether it passes or fails.',
  specNote:
    'Purity by high-performance liquid chromatography, established on the specific lot by an external laboratory. This is the number every assay on this site is drawn against — above the line a lot is released, below it a lot is not sold.',
  sourcingTitle: 'Need a compound that is not in the register?',
  sourcingBody:
    'Tell us the molecule, the purity specification and the quantity. We will tell you whether we can source and assay it, and what the lead time is — including when the answer is no.',
} as const;

export const QUALITY_DEFAULTS = {
  title: 'One number, and what stands behind it.',
  standfirst:
    'The research compound market runs on purity claims that cannot be checked. Our answer is procedural rather than rhetorical: an independent assay on every lot, measured against a specification we publish, and a batch code you can match to the vial in your hand.',
} as const;

export const CONTACT_REASONS = [
  {
    title: 'Certificates of analysis',
    body: 'Ask for the current batch certificate on any compound and we will send it before you order.',
  },
  {
    title: 'Pricing and quantities',
    body: 'Per-vial and bulk pricing, current stock, and lead times for anything in the register.',
  },
  {
    title: 'Custom sourcing',
    body: 'Compounds outside the register. Tell us the molecule, the purity specification and the quantity.',
  },
  {
    title: 'Institutional accounts',
    body: 'Purchase orders, recurring supply, and documentation for university and laboratory procurement.',
  },
] as const;

/* -------------------------------------------------------------------------
   The registry
   ------------------------------------------------------------------------- */

function pageFields(): ContentField[] {
  const fields: ContentField[] = [
    { key: 'home.title', label: 'Headline', group: 'Home', kind: 'line', fallback: HOME_DEFAULTS.title },
    { key: 'home.standfirst', label: 'Standfirst', group: 'Home', kind: 'block', fallback: HOME_DEFAULTS.standfirst },
    { key: 'home.specNote', label: 'Under the specification figure', group: 'Home', kind: 'block', fallback: HOME_DEFAULTS.specNote },
    { key: 'home.sourcingTitle', label: 'Custom sourcing — heading', group: 'Home', kind: 'line', fallback: HOME_DEFAULTS.sourcingTitle },
    { key: 'home.sourcingBody', label: 'Custom sourcing — body', group: 'Home', kind: 'block', fallback: HOME_DEFAULTS.sourcingBody },

    { key: 'quality.title', label: 'Headline', group: 'Release specification', kind: 'line', fallback: QUALITY_DEFAULTS.title },
    { key: 'quality.standfirst', label: 'Standfirst', group: 'Release specification', kind: 'block', fallback: QUALITY_DEFAULTS.standfirst },
  ];

  CONTACT_REASONS.forEach((r, i) => {
    fields.push({
      key: `contact.reason.${i}.title`,
      label: `Reason ${i + 1} — heading`,
      group: 'Contact',
      kind: 'line',
      fallback: r.title,
    });
    fields.push({
      key: `contact.reason.${i}.body`,
      label: `Reason ${i + 1} — body`,
      group: 'Contact',
      kind: 'block',
      fallback: r.body,
    });
  });

  return fields;
}

function productFields(): ContentField[] {
  return PRODUCTS.flatMap((p) => [
    {
      key: `product.${p.slug}.summary`,
      label: `${p.name} — summary`,
      group: 'Compounds',
      kind: 'block' as const,
      fallback: p.summary,
      help: 'Shown on the product page and in search. Must stay in laboratory-research terms.',
    },
    {
      key: `product.${p.slug}.researchAreas`,
      label: `${p.name} — research applications`,
      group: 'Compounds',
      kind: 'list' as const,
      fallback: p.researchAreas.join('\n'),
      help: 'One per line.',
    },
  ]);
}

export const CONTENT_FIELDS: ContentField[] = [...pageFields(), ...productFields()];

const FIELD_BY_KEY = new Map(CONTENT_FIELDS.map((f) => [f.key, f]));

export function isContentKey(key: string): boolean {
  return FIELD_BY_KEY.has(key);
}

/* -------------------------------------------------------------------------
   The research-use guard
   ------------------------------------------------------------------------- */

/**
 * Terms that must never appear in catalogue copy.
 *
 * The site's research-use framing is only as good as its worst sentence, and
 * making copy editable without a guard would hand anyone with the admin
 * password the ability to turn a compliant page into a pretextual one. This is
 * a blunt instrument on purpose: it refuses the save and says which phrase
 * tripped it, rather than silently rewriting anything.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /\bdos(e|es|ing|age)\b/i, why: 'dosing language' },
  { pattern: /\breconstitut/i, why: 'reconstitution guidance' },
  { pattern: /\binject(|ion|ing)\b/i, why: 'administration guidance' },
  { pattern: /\b(subcutaneous|intramuscular|oral(ly)?|sublingual)\b/i, why: 'a route of administration' },
  { pattern: /\bmg\s*\/\s*kg\b/i, why: 'a dose per body weight' },
  { pattern: /\b(patients?|human use|for humans?|bodybuild|physique|weight loss|fat loss|anti-?aging)\b/i, why: 'human-use framing' },
  // Deliberately NOT matching bare "treat"/"treatment" or bare "cycle": a
  // treatment group and the cell cycle are ordinary in vitro language, and a
  // guard that blocks correct scientific writing only teaches people to work
  // around it. What is caught is claim language and protocol framing.
  { pattern: /\b(cure[sd]?|therap(y|ies|eutic)|heals?|remedy)\b/i, why: 'a therapeutic claim' },
  { pattern: /\b(dosing|injection|peptide|research)\s+cycle\b/i, why: 'usage-protocol framing' },
  { pattern: /\bstack(ing|ed|s)?\s+(with|protocol)\b/i, why: 'usage-protocol framing' },
  { pattern: /\b\d{1,3}\.\d\s*%\s*(rp-)?hplc\b/i, why: 'an assayed purity figure — those come from the lot register' },
];

/** Returns the reasons a string may not be published, or an empty array. */
export function checkResearchUse(value: string): string[] {
  return FORBIDDEN.filter((f) => f.pattern.test(value)).map((f) => f.why);
}

/* -------------------------------------------------------------------------
   Reading
   ------------------------------------------------------------------------- */

function fallbackMap(): ContentMap {
  return Object.fromEntries(CONTENT_FIELDS.map((f) => [f.key, f.fallback]));
}

/**
 * Every string, with database overrides applied over the compiled defaults.
 * Read through the session-free public client so pages stay static.
 */
export async function getContent(): Promise<ContentMap> {
  const base = fallbackMap();
  const client = createPublicClient();
  if (!client) return base;

  try {
    const { data, error } = await client.from('site_content').select('key, value');
    if (error || !data) return base;
    for (const row of data as { key: string; value: string }[]) {
      // Ignore keys that no longer exist in the registry — a removed field
      // should not resurrect itself from an old row.
      if (FIELD_BY_KEY.has(row.key)) base[row.key] = row.value;
    }
    return base;
  } catch {
    return base;
  }
}

/** One string, with its compiled default as the floor. */
export function text(content: ContentMap, key: string): string {
  return content[key] ?? FIELD_BY_KEY.get(key)?.fallback ?? '';
}

/** A list field, split back into lines. */
export function lines(content: ContentMap, key: string): string[] {
  return text(content, key)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
