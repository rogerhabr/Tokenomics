/**
 * AXIS LABS research catalogue.
 *
 * Product names and research framing mirror the SaiyanMed catalogue, which was
 * given as the reference. Descriptions are written from each compound's
 * published mechanism.
 *
 * Everything here is research-use-only material. Copy is deliberately written
 * in terms of laboratory research models — no dosing, administration, or
 * human-use guidance anywhere in this file or the pages that render it.
 *
 * PRICING IS PLACEHOLDER. Every figure in `VARIANTS` below is invented — the
 * reference catalogue's real prices are not knowable from here. Replace the
 * whole block with your own pricing before taking payment.
 *
 * NOTE FOR MAINTAINERS: `casNumber` and `molecularWeight` are intentionally
 * `null` rather than filled with plausible-looking values, and `presentation`
 * is null wherever the vial format is not yet confirmed. Populate all three
 * from your own certificates of analysis before launch — do not guess them.
 */

export type CategoryId =
  | 'metabolic'
  | 'neuroscience'
  | 'tissue-repair'
  | 'growth-factor'
  | 'endocrine'
  | 'cosmetic'
  | 'cellular';

export type Category = {
  id: CategoryId;
  name: string;
  blurb: string;
};

export type Product = {
  slug: string;
  name: string;
  alias?: string;
  category: CategoryId;
  summary: string;
  researchAreas: string[];
  purity: string;
  identity: string;
  form: string;
  /** Vial format, where confirmed. */
  presentation: string | null;
  storage: string;
  casNumber: string | null;
  molecularWeight: string | null;
};

const PURITY = '≥99% HPLC';
const IDENTITY = 'Mass spectrometry confirmed';
const FORM = 'Lyophilised powder';
const STORAGE = 'Store sealed at -20 °C, protected from light and moisture';

export const CATEGORIES: Category[] = [
  {
    id: 'metabolic',
    name: 'Metabolic & GLP Research',
    blurb: 'Incretin and amylin receptor agonists for metabolic signalling studies.',
  },
  {
    id: 'neuroscience',
    name: 'Neuroscience',
    blurb: 'Regulatory peptides used in neurotrophic, cognitive, and anxiolytic research models.',
  },
  {
    id: 'tissue-repair',
    name: 'Tissue Repair',
    blurb: 'Compounds studied in angiogenesis, cell migration, and regeneration models.',
  },
  {
    id: 'growth-factor',
    name: 'Growth Factor',
    blurb: 'GHRH analogues and secretagogues for somatotropic axis research.',
  },
  {
    id: 'endocrine',
    name: 'Endocrine Research',
    blurb: 'Melanocortin, oxytocinergic, and reproductive-axis research compounds.',
  },
  {
    id: 'cosmetic',
    name: 'Cosmetic Research',
    blurb: 'Peptides investigated in dermal matrix, pigmentation, and melanocyte biology.',
  },
  {
    id: 'cellular',
    name: 'Cellular & Mitochondrial',
    blurb: 'Compounds used in mitochondrial function and methylation pathway research.',
  },
];

export const PRODUCTS: Product[] = [
  // ---- Metabolic & GLP Research -------------------------------------------
  {
    slug: 'tirzepatide',
    name: 'Tirzepatide',
    category: 'metabolic',
    summary:
      'A dual GIP and GLP-1 receptor agonist used in laboratory models of incretin signalling and metabolic regulation.',
    researchAreas: ['Incretin receptor signalling', 'Glucose homeostasis models', 'Energy balance research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'retatrutide',
    name: 'Retatrutide',
    alias: 'LY3437943',
    category: 'metabolic',
    summary:
      'A 39-amino-acid triple incretin receptor agonist (GIP, GLP-1, glucagon) supporting mechanistic studies of energy expenditure, hepatic lipid metabolism, and receptor crosstalk.',
    researchAreas: ['Triple agonist pharmacology', 'Hepatic lipid metabolism', 'Receptor crosstalk studies'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'cagrilintide',
    name: 'Cagrilintide',
    alias: 'AM833',
    category: 'metabolic',
    summary:
      'A long-acting acylated amylin analogue and non-selective amylin agonist, activating AMY1R, AMY2R, AMY3R and the calcitonin receptor, for amylin signalling and satiety research.',
    researchAreas: ['Amylin receptor signalling', 'Satiety research models', 'Calcitonin receptor studies'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },

  // ---- Neuroscience --------------------------------------------------------
  {
    slug: 'semax',
    name: 'Semax',
    category: 'neuroscience',
    summary:
      'A synthetic heptapeptide comprising the ACTH(4-7) fragment with a C-terminal Pro-Gly-Pro extension, studied for BDNF and NGF expression in hippocampal and cortical tissue, monoaminergic modulation, and neuroprotection in cerebral ischemia models.',
    researchAreas: ['BDNF and NGF expression', 'Monoaminergic modulation', 'Cerebral ischemia models'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'selank',
    name: 'Selank',
    alias: 'TP-7',
    category: 'neuroscience',
    summary:
      'A synthetic heptapeptide studied in GABAergic, anxiolytic, and immunomodulatory laboratory models.',
    researchAreas: ['GABAergic signalling', 'Anxiolytic research models', 'Immunomodulation'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },

  // ---- Tissue Repair -------------------------------------------------------
  {
    slug: 'bpc-157',
    name: 'BPC-157',
    alias: 'Body Protection Compound 157',
    category: 'tissue-repair',
    summary:
      'A synthetic pentadecapeptide extensively studied in angiogenesis, gastrointestinal, and connective tissue repair models.',
    researchAreas: ['Angiogenesis', 'Connective tissue models', 'Gastrointestinal research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'tb-500',
    name: 'TB-500',
    alias: 'Thymosin Beta-4, full length (43 aa)',
    category: 'tissue-repair',
    summary:
      'Full-length Thymosin Beta-4, used in actin dynamics, cell migration, angiogenesis, and tissue repair research models.',
    researchAreas: ['Actin sequestration', 'Cell migration', 'Angiogenesis'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },

  {
    slug: 'kpv',
    name: 'KPV',
    alias: 'Lys-Pro-Val, alpha-MSH (11-13)',
    category: 'tissue-repair',
    summary:
      'The C-terminal tripeptide of alpha-melanocyte stimulating hormone, which retains the parent hormone\u2019s anti-inflammatory activity in research models without engaging melanocortin receptors or the pigmentation pathway. Studied for NF-kappaB nuclear translocation and inflammasome activity.',
    researchAreas: ['NF-kappaB signalling', 'Inflammatory bowel research models', 'Wound and dermal models'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'bpc-157-tb-500',
    name: 'Dual-Pathway Blend — BPC-157 + TB-500',
    alias: 'Pentadecapeptide + Thymosin Beta-4',
    category: 'tissue-repair',
    summary:
      'A co-lyophilised formulation pairing a synthetic pentadecapeptide with full-length Thymosin Beta-4, for research models examining angiogenesis and actin-mediated cell migration together rather than in isolation.',
    researchAreas: ['Angiogenesis', 'Actin dynamics and cell migration', 'Connective tissue models'],
    purity: PURITY,
    identity: IDENTITY,
    form: 'Co-lyophilised powder',
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'klow-blend',
    name: 'Multi-Pathway Blend — KLOW',
    alias: 'KPV + GHK-Cu + BPC-157 + TB-500',
    category: 'tissue-repair',
    summary:
      'A four-component co-lyophilised formulation combining KPV, the copper tripeptide GHK-Cu, BPC-157 and full-length Thymosin Beta-4. Used in research models examining how inflammation signalling, matrix remodelling, angiogenesis and cell migration interact within a single preparation.',
    researchAreas: ['Multi-pathway repair models', 'Matrix remodelling', 'Inflammation signalling'],
    purity: PURITY,
    identity: IDENTITY,
    form: 'Co-lyophilised powder',
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  // ---- Growth Factor -------------------------------------------------------
  {
    slug: 'tesamorelin',
    name: 'Tesamorelin',
    alias: 'TH9507',
    category: 'growth-factor',
    summary:
      'A full-length GHRH(1-44) analogue used as a reference compound in growth hormone releasing hormone receptor and somatotropic axis research.',
    researchAreas: ['GHRH receptor studies', 'Somatotropic axis models', 'Comparative analogue research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: '5 mg per vial',
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'ipamorelin',
    name: 'Ipamorelin',
    category: 'growth-factor',
    summary:
      'A selective GHS-R1a agonist used in pituitary signalling and secretagogue research models.',
    researchAreas: ['GHS-R1a selectivity', 'Pituitary axis models', 'Secretagogue research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'dual-pathway-research-blend',
    name: 'Dual-Pathway Blend — Tesamorelin + Ipamorelin',
    alias: 'Tesamorelin 10 mg + Ipamorelin 5 mg',
    category: 'growth-factor',
    summary:
      'A co-lyophilised formulation pairing a GHRH analogue with a selective GHS-R1a agonist, for research models examining both secretagogue pathways together.',
    researchAreas: ['Dual-pathway secretagogue models', 'GHRH and GHS-R1a interaction', 'Somatotropic axis research'],
    purity: PURITY,
    identity: IDENTITY,
    form: 'Co-lyophilised powder',
    presentation: '15 mg per vial (10 mg tesamorelin + 5 mg ipamorelin)',
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },

  {
    slug: 'cjc-1295',
    name: 'CJC-1295',
    alias: 'GHRH (1-29) analogue',
    category: 'growth-factor',
    summary:
      'A synthetic analogue of growth hormone releasing hormone, modified at four positions to resist enzymatic degradation, used in somatotropic axis and GHRH receptor research. Supplied with or without the drug affinity complex (DAC), which binds albumin and extends circulating half-life; the form is stated on the lot certificate.',
    researchAreas: ['GHRH receptor signalling', 'Half-life extension studies', 'Somatotropic axis models'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'cjc-1295-ipamorelin',
    name: 'Dual-Pathway Blend — CJC-1295 + Ipamorelin',
    alias: 'GHRH analogue + GHS-R1a agonist',
    category: 'growth-factor',
    summary:
      'A co-lyophilised formulation pairing a GHRH analogue with a selective growth hormone secretagogue receptor agonist, for research models examining both secretagogue pathways in the same preparation rather than separately.',
    researchAreas: ['Dual-pathway secretagogue models', 'GHRH and GHS-R1a interaction', 'Pituitary signalling research'],
    purity: PURITY,
    identity: IDENTITY,
    form: 'Co-lyophilised powder',
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  // ---- Endocrine Research --------------------------------------------------
  {
    slug: 'pt-141',
    name: 'PT-141',
    alias: 'Bremelanotide',
    category: 'endocrine',
    summary:
      'A melanocortin receptor agonist investigated in central nervous system arousal and melanocortin receptor research.',
    researchAreas: ['Melanocortin receptor studies', 'CNS signalling models', 'Receptor binding research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'oxytocin',
    name: 'Oxytocin',
    category: 'endocrine',
    summary:
      'A nonapeptide hormone widely used in social behaviour, bonding, and neuroendocrine research models.',
    researchAreas: ['Neuroendocrine signalling', 'Social behaviour models', 'Receptor pharmacology'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'kisspeptin-10',
    name: 'Kisspeptin-10',
    alias: 'KP-10',
    category: 'endocrine',
    summary:
      'A C-terminally amidated decapeptide and potent KISS1R / GPR54 receptor agonist used in GnRH, HPG-axis, and reproductive endocrinology research models.',
    researchAreas: ['KISS1R / GPR54 signalling', 'HPG axis research', 'Reproductive endocrinology'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },

  // ---- Cosmetic Research ---------------------------------------------------
  {
    slug: 'ghk-cu',
    name: 'GHK-Cu',
    alias: 'Copper Tripeptide-1',
    category: 'cosmetic',
    summary:
      'A naturally occurring copper-binding tripeptide (glycine-histidine-lysine with Cu2+), used as a reference tool in extracellular matrix remodelling, fibroblast activity, collagen and elastin gene expression, angiogenesis, and hair follicle biology research.',
    researchAreas: ['Extracellular matrix remodelling', 'Collagen and elastin expression', 'Hair follicle biology'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'melanotan-i',
    name: 'Melanotan I',
    alias: 'Afamelanotide',
    category: 'cosmetic',
    summary:
      'A linear 13-amino-acid alpha-MSH analogue and MC1R agonist supplied for melanogenesis and melanocyte biology research.',
    researchAreas: ['Melanogenesis pathways', 'MC1R receptor studies', 'Melanocyte biology'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },

  // ---- Cellular & Mitochondrial -------------------------------------------
  {
    slug: 'ss-31',
    name: 'SS-31',
    alias: 'Bendavia, MTP-131',
    category: 'cellular',
    summary:
      'A four-amino-acid tetrapeptide that targets the inner mitochondrial membrane via cardiolipin binding, used in mitochondrial function research models.',
    researchAreas: ['Cardiolipin binding', 'Mitochondrial bioenergetics', 'Oxidative stress models'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: '10-vial kit',
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'mots-c',
    name: 'MOTS-c',
    alias: 'Mitochondrial ORF of the 12S rRNA type-c',
    category: 'cellular',
    summary:
      'A sixteen-amino-acid peptide encoded in the mitochondrial genome, studied as an AMPK activator acting through the folate-methionine cycle. Used in metabolic homeostasis, insulin sensitivity and mitochondrial bioenergetics research models.',
    researchAreas: ['AMPK activation', 'Folate-methionine cycle', 'Metabolic homeostasis models'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'nad',
    name: 'NAD+',
    alias: 'Nicotinamide adenine dinucleotide',
    category: 'cellular',
    summary:
      'A pyridine nucleotide coenzyme central to cellular redox reactions and the substrate for sirtuins and PARP enzymes. Supplied for laboratory study of redox balance, NAD salvage and biosynthesis pathways, and mitochondrial metabolism.',
    researchAreas: ['Redox metabolism', 'Sirtuin and PARP activity', 'NAD salvage pathway research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'methylcobalamin',
    name: 'Methylcobalamin',
    category: 'cellular',
    summary:
      'The active, methylated coenzyme form of vitamin B12, supplied for laboratory study of one-carbon metabolism, methylation pathways, homocysteine research, and neuronal research models.',
    researchAreas: ['One-carbon metabolism', 'Methylation pathways', 'Homocysteine research'],
    purity: PURITY,
    identity: IDENTITY,
    form: FORM,
    presentation: null,
    storage: STORAGE,
    casNumber: null,
    molecularWeight: null,
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getCategory(id: CategoryId): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function productsByCategory(id: CategoryId): Product[] {
  return PRODUCTS.filter((p) => p.category === id);
}

/**
 * Purchasable variants per compound: vial size and price.
 *
 * PLACEHOLDER PRICING — every `priceCents` here is invented. Replace with real
 * pricing before launch. Prices are integer cents to avoid float rounding in
 * cart totals.
 */
export type Variant = {
  id: string;
  label: string;
  priceCents: number;
};

const VARIANTS: Record<string, Variant[]> = {
  tirzepatide: [
    { id: 'tirzepatide-10mg', label: '10 mg vial', priceCents: 8900 },
    { id: 'tirzepatide-30mg', label: '30 mg vial', priceCents: 21900 },
    { id: 'tirzepatide-60mg', label: '60 mg vial', priceCents: 38900 },
  ],
  retatrutide: [
    { id: 'retatrutide-5mg', label: '5 mg vial', priceCents: 9900 },
    { id: 'retatrutide-10mg', label: '10 mg vial', priceCents: 17900 },
    { id: 'retatrutide-20mg', label: '20 mg vial', priceCents: 32900 },
  ],
  cagrilintide: [
    { id: 'cagrilintide-5mg', label: '5 mg vial', priceCents: 10900 },
    { id: 'cagrilintide-10mg', label: '10 mg vial', priceCents: 19900 },
  ],
  semax: [
    { id: 'semax-10mg', label: '10 mg vial', priceCents: 4900 },
    { id: 'semax-30mg', label: '30 mg vial', priceCents: 11900 },
  ],
  selank: [
    { id: 'selank-10mg', label: '10 mg vial', priceCents: 4900 },
    { id: 'selank-30mg', label: '30 mg vial', priceCents: 11900 },
  ],
  'bpc-157': [
    { id: 'bpc-157-5mg', label: '5 mg vial', priceCents: 3900 },
    { id: 'bpc-157-10mg', label: '10 mg vial', priceCents: 6900 },
    { id: 'bpc-157-10x5mg', label: '10 x 5 mg kit', priceCents: 32900 },
  ],
  'tb-500': [
    { id: 'tb-500-5mg', label: '5 mg vial', priceCents: 5900 },
    { id: 'tb-500-10mg', label: '10 mg vial', priceCents: 9900 },
  ],
  tesamorelin: [
    { id: 'tesamorelin-5mg', label: '5 mg vial', priceCents: 7900 },
    { id: 'tesamorelin-10mg', label: '10 mg vial', priceCents: 13900 },
  ],
  ipamorelin: [
    { id: 'ipamorelin-5mg', label: '5 mg vial', priceCents: 3900 },
    { id: 'ipamorelin-10mg', label: '10 mg vial', priceCents: 6900 },
  ],
  'dual-pathway-research-blend': [
    { id: 'dual-pathway-15mg', label: '15 mg vial', priceCents: 15900 },
    { id: 'dual-pathway-10x15mg', label: '10 x 15 mg kit', priceCents: 139900 },
  ],
  'pt-141': [
    { id: 'pt-141-10mg', label: '10 mg vial', priceCents: 5900 },
    { id: 'pt-141-30mg', label: '30 mg vial', priceCents: 14900 },
  ],
  oxytocin: [
    { id: 'oxytocin-2mg', label: '2 mg vial', priceCents: 3900 },
    { id: 'oxytocin-10mg', label: '10 mg vial', priceCents: 9900 },
  ],
  'kisspeptin-10': [
    { id: 'kisspeptin-10-5mg', label: '5 mg vial', priceCents: 5900 },
    { id: 'kisspeptin-10-10mg', label: '10 mg vial', priceCents: 9900 },
  ],
  'ghk-cu': [
    { id: 'ghk-cu-50mg', label: '50 mg vial', priceCents: 4900 },
    { id: 'ghk-cu-100mg', label: '100 mg vial', priceCents: 8900 },
  ],
  'melanotan-i': [
    { id: 'melanotan-i-10mg', label: '10 mg vial', priceCents: 5900 },
    { id: 'melanotan-i-30mg', label: '30 mg vial', priceCents: 14900 },
  ],
  'ss-31': [
    { id: 'ss-31-10mg', label: '10 mg vial', priceCents: 8900 },
    { id: 'ss-31-10x10mg', label: '10-vial kit', priceCents: 79900 },
  ],
  'cjc-1295': [
    { id: 'cjc-1295-2mg', label: '2 mg vial', priceCents: 4900 },
    { id: 'cjc-1295-5mg', label: '5 mg vial', priceCents: 8900 },
    { id: 'cjc-1295-10mg', label: '10 mg vial', priceCents: 15900 },
  ],
  'cjc-1295-ipamorelin': [
    { id: 'cjc-1295-ipamorelin-10mg', label: '10 mg vial', priceCents: 11900 },
    { id: 'cjc-1295-ipamorelin-10x10mg', label: '10 x 10 mg kit', priceCents: 104900 },
  ],
  kpv: [
    { id: 'kpv-10mg', label: '10 mg vial', priceCents: 4900 },
    { id: 'kpv-50mg', label: '50 mg vial', priceCents: 17900 },
  ],
  'bpc-157-tb-500': [
    { id: 'bpc-157-tb-500-10mg', label: '10 mg vial', priceCents: 9900 },
    { id: 'bpc-157-tb-500-20mg', label: '20 mg vial', priceCents: 17900 },
  ],
  'klow-blend': [
    { id: 'klow-blend-80mg', label: '80 mg vial', priceCents: 24900 },
  ],
  'mots-c': [
    { id: 'mots-c-5mg', label: '5 mg vial', priceCents: 6900 },
    { id: 'mots-c-10mg', label: '10 mg vial', priceCents: 11900 },
  ],
  nad: [
    { id: 'nad-100mg', label: '100 mg vial', priceCents: 8900 },
    { id: 'nad-500mg', label: '500 mg vial', priceCents: 29900 },
  ],
  methylcobalamin: [
    { id: 'methylcobalamin-5mg', label: '5 mg vial', priceCents: 2900 },
    { id: 'methylcobalamin-30mg', label: '30 mg vial', priceCents: 7900 },
  ],
};

export function variantsFor(slug: string): Variant[] {
  return VARIANTS[slug] ?? [];
}

export function getVariant(variantId: string): { product: Product; variant: Variant } | undefined {
  for (const product of PRODUCTS) {
    const variant = variantsFor(product.slug).find((v) => v.id === variantId);
    if (variant) return { product, variant };
  }
  return undefined;
}

/** Lowest price across a product's variants, for "from $X" on catalogue cards. */
export function fromPriceCents(slug: string): number | null {
  const variants = variantsFor(slug);
  if (variants.length === 0) return null;
  return Math.min(...variants.map((v) => v.priceCents));
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
