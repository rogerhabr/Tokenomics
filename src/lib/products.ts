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
    name: 'Dual-Pathway Research Blend',
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
