/**
 * AXIS LABS research catalogue.
 *
 * Everything here is research-use-only material. Copy is deliberately written
 * in terms of laboratory research models — no dosing, administration, or
 * human-use guidance anywhere in this file or the pages that render it.
 *
 * NOTE FOR MAINTAINERS: `casNumber` and `molecularWeight` are intentionally
 * `null` rather than filled with plausible-looking values. Populate them from
 * your own certificates of analysis before launch — do not guess them.
 */

export type CategoryId =
  | 'metabolic'
  | 'neuroscience'
  | 'tissue-repair'
  | 'growth-factor'
  | 'endocrine'
  | 'cosmetic';

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
  form: string;
  storage: string;
  casNumber: string | null;
  molecularWeight: string | null;
};

export const CATEGORIES: Category[] = [
  {
    id: 'metabolic',
    name: 'Metabolic & GLP Research',
    blurb: 'Incretin receptor agonists and related compounds for metabolic signalling studies.',
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
    blurb: 'Secretagogues and releasing peptides for endocrine axis research.',
  },
  {
    id: 'endocrine',
    name: 'Endocrine Research',
    blurb: 'Melanocortin, oxytocinergic, and reproductive-axis research compounds.',
  },
  {
    id: 'cosmetic',
    name: 'Cosmetic Research',
    blurb: 'Peptides investigated in dermal matrix, pigmentation, and topical formulation studies.',
  },
];

export const PRODUCTS: Product[] = [
  {
    slug: 'tirzepatide',
    name: 'Tirzepatide',
    alias: 'LY3298176',
    category: 'metabolic',
    summary:
      'A dual GIP and GLP-1 receptor agonist widely used in laboratory models of incretin signalling and metabolic regulation.',
    researchAreas: ['Incretin receptor signalling', 'Glucose homeostasis models', 'Energy balance research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'retatrutide',
    name: 'Retatrutide',
    alias: 'LY3437943',
    category: 'metabolic',
    summary:
      'A triple incretin receptor agonist (GIP, GLP-1, glucagon) studied in multi-receptor metabolic signalling models.',
    researchAreas: ['Triple agonist pharmacology', 'Metabolic pathway research', 'Receptor selectivity studies'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'semaglutide',
    name: 'Semaglutide',
    category: 'metabolic',
    summary:
      'A long-acting GLP-1 receptor agonist used as a reference compound in incretin and metabolic signalling research.',
    researchAreas: ['GLP-1 receptor studies', 'Comparative agonist research', 'Metabolic modelling'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'semax',
    name: 'Semax',
    category: 'neuroscience',
    summary:
      'A synthetic ACTH(4-10) analogue investigated in BDNF expression, neuroprotection, and cognitive research models.',
    researchAreas: ['BDNF expression', 'Neuroprotection models', 'Cognitive research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'n-acetyl-semax-amidate',
    name: 'N-Acetyl Semax Amidate',
    category: 'neuroscience',
    summary:
      'An acetylated, amidated Semax derivative with extended stability, used in comparative neuropeptide research.',
    researchAreas: ['Peptide stability studies', 'BDNF expression', 'Comparative analogue research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
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
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'bpc-157',
    name: 'BPC-157',
    alias: 'Body Protection Compound 157',
    category: 'tissue-repair',
    summary:
      'A synthetic pentadecapeptide extensively studied in angiogenesis, gastrointestinal, and connective tissue repair models.',
    researchAreas: ['Angiogenesis', 'Connective tissue models', 'Gastrointestinal research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'tb-500',
    name: 'TB-500',
    alias: 'Thymosin Beta-4, full length',
    category: 'tissue-repair',
    summary:
      'Full-length Thymosin Beta-4, used in actin dynamics, cell migration, angiogenesis, and tissue repair research.',
    researchAreas: ['Actin sequestration', 'Cell migration', 'Angiogenesis'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'ghk-cu',
    name: 'GHK-Cu',
    alias: 'Copper Peptide',
    category: 'tissue-repair',
    summary:
      'A copper-binding tripeptide complex investigated in extracellular matrix remodelling and dermal research models.',
    researchAreas: ['Matrix remodelling', 'Collagen synthesis models', 'Dermal research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'ipamorelin',
    name: 'Ipamorelin',
    category: 'growth-factor',
    summary:
      'A selective growth hormone secretagogue receptor agonist used in pituitary signalling research.',
    researchAreas: ['GHS-R selectivity', 'Pituitary axis models', 'Secretagogue research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'cjc-1295',
    name: 'CJC-1295',
    alias: 'Modified GRF (1-29)',
    category: 'growth-factor',
    summary:
      'A growth hormone releasing hormone analogue studied for extended half-life in endocrine axis models.',
    researchAreas: ['GHRH analogue research', 'Half-life extension studies', 'Endocrine axis models'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'sermorelin',
    name: 'Sermorelin',
    alias: 'GRF (1-29)',
    category: 'growth-factor',
    summary:
      'The 29-amino-acid active fragment of GHRH, used as a reference compound in somatotropic axis research.',
    researchAreas: ['GHRH receptor studies', 'Somatotropic axis', 'Comparative analogue research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'pt-141',
    name: 'PT-141',
    alias: 'Bremelanotide',
    category: 'endocrine',
    summary:
      'A melanocortin receptor agonist investigated in central nervous system arousal and MC receptor research.',
    researchAreas: ['Melanocortin receptor studies', 'CNS signalling models', 'Receptor binding research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
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
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'kisspeptin-10',
    name: 'Kisspeptin-10',
    category: 'endocrine',
    summary:
      'A KISS1 gene product fragment studied in reproductive axis and GnRH regulation research.',
    researchAreas: ['Reproductive axis research', 'GnRH regulation', 'KISS1R signalling'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'snap-8',
    name: 'SNAP-8',
    alias: 'Acetyl Octapeptide-3',
    category: 'cosmetic',
    summary:
      'An octapeptide investigated in SNARE complex modulation and topical cosmetic formulation research.',
    researchAreas: ['SNARE complex studies', 'Topical formulation research', 'Dermal models'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
    casNumber: null,
    molecularWeight: null,
  },
  {
    slug: 'melanotan-ii',
    name: 'Melanotan II',
    category: 'cosmetic',
    summary:
      'A synthetic melanocortin analogue used in pigmentation pathway and MC1R receptor research.',
    researchAreas: ['Melanogenesis pathways', 'MC1R receptor studies', 'Pigmentation research'],
    purity: '≥99% HPLC',
    form: 'Lyophilised powder',
    storage: 'Store at -20 °C, protected from light',
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
