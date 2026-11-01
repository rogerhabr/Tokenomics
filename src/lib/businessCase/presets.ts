// Dropdown presets for the Business Case Agent.
//
// Every number here is a DEFAULT the user can override in the UI. Values are
// tagged in src/lib/sources.ts (businessCase* entries). Origin Partners figures
// are from their May 2026 Insights posts; tariffs are estimate-tagged with the
// date checked. Nothing in this file is a primary-source actual unless noted.

import type {
  GeographyPreset, ChipPreset, PowerSourcePreset, RevenueModelPreset,
  CapitalStackPreset, CreditSupportPreset, BusinessCaseInputs,
} from './types.ts';

// ─── Geographies ─────────────────────────────────────────────────────────────
// FX used (2026-11): AED 3.6725, SAR 3.75, KWD 0.307, TRY 42, EUR 0.92, SGD 1.33, MYR 4.4, INR 85

export const GEOGRAPHIES: GeographyPreset[] = [
  { id: 'us-ercot', label: 'USA — Texas (ERCOT)', region: 'North America', currencyNote: 'USD',
    tariffPerKWh: 0.065, capacityChargePerMWDay: 0, gasPricePerMMBtu: 3.00, landPerMW: 5_000_000,
    laborCostPerFTE: 140_000, corporateTaxPct: 21, propertyTaxPctOfCapex: 1.8, gridInterconnectMonths: 30,
    constructionCostIndex: 1.00, asOf: '2026-11',
    sourceNote: 'EIA TX industrial 6.12¢ (2024) +5%; gas $2.50–3.50 burner-tip and energy-only market per Origin Partners ERCOT/PJM/MISO post; powered land $4–8M/MW per Origin powered-shell post.' },
  { id: 'us-pjm', label: 'USA — N. Virginia (PJM)', region: 'North America', currencyNote: 'USD',
    tariffPerKWh: 0.085, capacityChargePerMWDay: 269.92, gasPricePerMMBtu: 3.50, landPerMW: 8_000_000,
    laborCostPerFTE: 150_000, corporateTaxPct: 26, propertyTaxPctOfCapex: 1.0, gridInterconnectMonths: 48,
    constructionCostIndex: 1.10, asOf: '2026-11',
    sourceNote: 'PJM 2025/26 BRA cleared $269.92/MW-day (Origin Partners); 36–60 mo interconnect (Origin); tariff is estimate of Dominion large-load rate.' },
  { id: 'us-miso', label: 'USA — Illinois (MISO Z4)', region: 'North America', currencyNote: 'USD',
    tariffPerKWh: 0.075, capacityChargePerMWDay: 719.81, gasPricePerMMBtu: 3.20, landPerMW: 4_000_000,
    laborCostPerFTE: 130_000, corporateTaxPct: 28, propertyTaxPctOfCapex: 2.0, gridInterconnectMonths: 42,
    constructionCostIndex: 1.00, asOf: '2026-11',
    sourceNote: 'MISO Zone 4 2025/26 PRA $719.81/MW-day and 36–48 mo interconnect per Origin Partners; tariff estimate.' },
  { id: 'uae-dubai', label: 'UAE — Dubai (DEWA)', region: 'Gulf', currencyNote: 'AED 3.6725/USD',
    tariffPerKWh: 0.120, capacityChargePerMWDay: 0, gasPricePerMMBtu: 4.50, landPerMW: 1_500_000,
    laborCostPerFTE: 90_000, corporateTaxPct: 9, propertyTaxPctOfCapex: 0, gridInterconnectMonths: 24,
    constructionCostIndex: 0.95, asOf: '2026-11',
    sourceNote: 'DEWA industrial slab 38 fils/kWh >10,000 kWh + ~6 fils fuel surcharge = 44 fils ≈ $0.120 (dewa.gov.ae slab tariff). No negotiated large-load discount assumed.' },
  { id: 'uae-abudhabi', label: 'UAE — Abu Dhabi (ADDC/EWEC)', region: 'Gulf', currencyNote: 'AED 3.6725/USD',
    tariffPerKWh: 0.049, capacityChargePerMWDay: 0, gasPricePerMMBtu: 4.00, landPerMW: 1_200_000,
    laborCostPerFTE: 90_000, corporateTaxPct: 9, propertyTaxPctOfCapex: 0, gridInterconnectMonths: 24,
    constructionCostIndex: 0.95, asOf: '2026-11',
    sourceNote: 'EWEC/ADDC large industrial 15–21 fils/kWh range (rax.ae data-center tariff guide, non-official); 18 fils used. Verify against ADDC >1 MW TOU tariff (27–36.6 fils).' },
  { id: 'ksa', label: 'Saudi Arabia (SEC)', region: 'Gulf', currencyNote: 'SAR 3.75/USD',
    tariffPerKWh: 0.048, capacityChargePerMWDay: 0, gasPricePerMMBtu: 1.75, landPerMW: 1_000_000,
    laborCostPerFTE: 85_000, corporateTaxPct: 20, propertyTaxPctOfCapex: 0, gridInterconnectMonths: 30,
    constructionCostIndex: 1.05, asOf: '2026-11',
    sourceNote: 'SEC industrial 18 halalas/kWh; Aramco regulated gas $1.25–1.75/MMBtu. Estimate.' },
  { id: 'kuwait', label: 'Kuwait (MEW)', region: 'Gulf', currencyNote: 'KWD 0.307/USD',
    tariffPerKWh: 0.082, capacityChargePerMWDay: 0, gasPricePerMMBtu: 8.00, landPerMW: 800_000,
    laborCostPerFTE: 95_000, corporateTaxPct: 15, propertyTaxPctOfCapex: 0, gridInterconnectMonths: 36,
    constructionCostIndex: 1.10, asOf: '2026-11',
    sourceNote: 'MEW commercial/investment tariff 25 fils/kWh post-2017 reform ≈ $0.082; industrial-zone 3 fils not assumed available to a DC. LNG-import gas. 132 kV substation EPC ~30 months.' },
  { id: 'turkey-ankara', label: 'Türkiye — Ankara (OSB)', region: 'Europe', currencyNote: 'TRY ~42/USD',
    tariffPerKWh: 0.085, capacityChargePerMWDay: 0, gasPricePerMMBtu: 11.00, landPerMW: 600_000,
    laborCostPerFTE: 45_000, corporateTaxPct: 25, propertyTaxPctOfCapex: 0.2, gridInterconnectMonths: 24,
    constructionCostIndex: 0.85, asOf: '2026-11',
    sourceNote: 'EPDK industrial tariff after April 2026 hike (+17.5% LV, industrial est. ~3.5 TRY/kWh); BOTAŞ industrial gas +18.61% Apr-2026. Estimates.' },
  { id: 'norway', label: 'Norway (NO1/NO2)', region: 'Europe', currencyNote: 'EUR 0.92/USD',
    tariffPerKWh: 0.078, capacityChargePerMWDay: 0, gasPricePerMMBtu: 10.00, landPerMW: 1_000_000,
    laborCostPerFTE: 110_000, corporateTaxPct: 22, propertyTaxPctOfCapex: 0.7, gridInterconnectMonths: 36,
    constructionCostIndex: 1.15, asOf: '2026-11',
    sourceNote: 'Eurostat H1-2026 ~10 MW DC band €0.071/kWh (scienceshot EU DC price survey). Estimate.' },
  { id: 'sweden', label: 'Sweden (SE1/SE2)', region: 'Europe', currencyNote: 'EUR 0.92/USD',
    tariffPerKWh: 0.099, capacityChargePerMWDay: 0, gasPricePerMMBtu: 12.00, landPerMW: 900_000,
    laborCostPerFTE: 100_000, corporateTaxPct: 20.6, propertyTaxPctOfCapex: 0.5, gridInterconnectMonths: 36,
    constructionCostIndex: 1.15, asOf: '2026-11',
    sourceNote: 'Eurostat H1-2026 DC band €0.090/kWh. Estimate.' },
  { id: 'germany', label: 'Germany (Frankfurt)', region: 'Europe', currencyNote: 'EUR 0.92/USD',
    tariffPerKWh: 0.187, capacityChargePerMWDay: 0, gasPricePerMMBtu: 11.00, landPerMW: 2_000_000,
    laborCostPerFTE: 110_000, corporateTaxPct: 30, propertyTaxPctOfCapex: 0.4, gridInterconnectMonths: 48,
    constructionCostIndex: 1.20, asOf: '2026-11',
    sourceNote: 'Industrial 180 USD/MWh (globalpetrolprices 2025); etalytics 10.7–19.2 ct/kWh range. Estimate.' },
  { id: 'singapore', label: 'Singapore', region: 'Asia-Pacific', currencyNote: 'SGD 1.33/USD',
    tariffPerKWh: 0.190, capacityChargePerMWDay: 0, gasPricePerMMBtu: 12.00, landPerMW: 6_000_000,
    laborCostPerFTE: 95_000, corporateTaxPct: 17, propertyTaxPctOfCapex: 1.0, gridInterconnectMonths: 48,
    constructionCostIndex: 1.25, asOf: '2026-11',
    sourceNote: 'Industrial 189 USD/MWh (globalpetrolprices 2025); DC capacity allocation under IMDA DC-CFA. Estimate.' },
  { id: 'malaysia-johor', label: 'Malaysia — Johor', region: 'Asia-Pacific', currencyNote: 'MYR 4.4/USD',
    tariffPerKWh: 0.105, capacityChargePerMWDay: 0, gasPricePerMMBtu: 7.00, landPerMW: 700_000,
    laborCostPerFTE: 40_000, corporateTaxPct: 24, propertyTaxPctOfCapex: 0.3, gridInterconnectMonths: 24,
    constructionCostIndex: 0.80, asOf: '2026-11',
    sourceNote: 'Industrial 105 USD/MWh (globalpetrolprices 2025); TNB new DC tariff July-2025. Estimate.' },
  { id: 'india', label: 'India — Mumbai / Hyderabad', region: 'Asia-Pacific', currencyNote: 'INR 85/USD',
    tariffPerKWh: 0.082, capacityChargePerMWDay: 0, gasPricePerMMBtu: 11.00, landPerMW: 1_000_000,
    laborCostPerFTE: 30_000, corporateTaxPct: 25, propertyTaxPctOfCapex: 0.3, gridInterconnectMonths: 24,
    constructionCostIndex: 0.75, asOf: '2026-11',
    sourceNote: 'Industrial 82 USD/MWh (globalpetrolprices 2025); RLNG for BTM. Estimate.' },
];

// ─── Chips (rack / node level) ───────────────────────────────────────────────

export const CHIPS: ChipPreset[] = [
  { id: 'hgx-h100', label: 'NVIDIA HGX H100 (8-GPU node)', vendor: 'NVIDIA', gpusPerUnit: 8, unitKW: 10.2, unitCostUSD: 240_000,
    tokensPerGPUPerSec: 350, cooling: 'air', contractedPricePerGpuHr: 2.35, onDemandPricePerGpuHr: 3.25, releaseYear: 2022,
    sourceNote: 'Node 10.2 kW (NVIDIA DGX H100 spec); $30k/GPU (repo hardwareDefaults); SemiAnalysis 1-yr contract index $2.35 (Mar-2026), on-demand median $3.25 (Oct-2026 aggregators).' },
  { id: 'hgx-h200', label: 'NVIDIA HGX H200 (8-GPU node)', vendor: 'NVIDIA', gpusPerUnit: 8, unitKW: 10.5, unitCostUSD: 320_000,
    tokensPerGPUPerSec: 510, cooling: 'air', contractedPricePerGpuHr: 3.20, onDemandPricePerGpuHr: 4.40, releaseYear: 2024,
    sourceNote: '$40k/GPU (repo); on-demand median $4.40, contract est. 73% of on-demand.' },
  { id: 'hgx-b200', label: 'NVIDIA HGX B200 (8-GPU node)', vendor: 'NVIDIA', gpusPerUnit: 8, unitKW: 14.3, unitCostUSD: 440_000,
    tokensPerGPUPerSec: 860, cooling: 'liquid', contractedPricePerGpuHr: 4.25, onDemandPricePerGpuHr: 6.39, releaseYear: 2025,
    sourceNote: 'DGX B200 14.3 kW; $55k/GPU (repo); on-demand median $6.39, 36-mo reserved seen at $2.25 (floor) — $4.25 used as mid.' },
  { id: 'hgx-b300', label: 'NVIDIA HGX B300 (8-GPU node)', vendor: 'NVIDIA', gpusPerUnit: 8, unitKW: 15.5, unitCostUSD: 600_000,
    tokensPerGPUPerSec: 1300, cooling: 'liquid', contractedPricePerGpuHr: 5.25, onDemandPricePerGpuHr: 7.75, releaseYear: 2026,
    sourceNote: '$75k/GPU est. (repo); pricing est. 1.2× B200.' },
  { id: 'gb200-nvl72', label: 'NVIDIA GB200 NVL72 (72-GPU rack)', vendor: 'NVIDIA', gpusPerUnit: 72, unitKW: 120, unitCostUSD: 3_000_000,
    tokensPerGPUPerSec: 800, cooling: 'liquid', contractedPricePerGpuHr: 5.50, onDemandPricePerGpuHr: 8.19, releaseYear: 2025,
    sourceNote: 'NVL72 120 kW, ~$3M/rack (repo); on-demand per-GPU $8.19 (Ornn trade index); contract est.' },
  { id: 'gb300-nvl72', label: 'NVIDIA GB300 NVL72 (72-GPU rack)', vendor: 'NVIDIA', gpusPerUnit: 72, unitKW: 130, unitCostUSD: 6_100_000,
    tokensPerGPUPerSec: 1200, cooling: 'liquid', contractedPricePerGpuHr: 7.00, onDemandPricePerGpuHr: 11.00, releaseYear: 2026,
    sourceNote: 'NVL72 130 kW, ~$6.1M/rack (repo est.); pricing est.' },
  { id: 'vr200-nvl72', label: 'NVIDIA Vera Rubin NVL72 (2027E)', vendor: 'NVIDIA', gpusPerUnit: 72, unitKW: 210, unitCostUSD: 8_800_000,
    tokensPerGPUPerSec: 2800, cooling: 'liquid', contractedPricePerGpuHr: 9.00, onDemandPricePerGpuHr: 14.00, releaseYear: 2027,
    sourceNote: 'GTC-2025 roadmap: 190–230 kW rack, ~$8.8M (repo est.); pricing forecast.' },
  { id: 'mi350x', label: 'AMD MI350X (8-GPU node)', vendor: 'AMD', gpusPerUnit: 8, unitKW: 12.0, unitCostUSD: 304_000,
    tokensPerGPUPerSec: 790, cooling: 'liquid', contractedPricePerGpuHr: 3.40, onDemandPricePerGpuHr: 5.00, releaseYear: 2025,
    sourceNote: '$38k/GPU (repo); pricing est. at ~20% discount to H200-class.' },
];

// ─── Power sources (Origin Partners May-2026 BTM planning ranges) ─────────────

export const POWER_SOURCES: PowerSourcePreset[] = [
  { id: 'grid', label: 'Utility grid (interconnect)', kind: 'grid', genCapexPerKW: 0, heatRateBtuPerKWh: 0, genOandMPerMWh: 0,
    redundancyFactor: 1, leadTimeMonths: 0, availabilityPct: 99.99, bridgeMonthsToGrid: 0,
    sourceNote: 'Lead time = geography interconnect months. Backup gensets included in MEP $/kW.' },
  { id: 'btm-recip', label: 'BTM — reciprocating engines (gas)', kind: 'btm', genCapexPerKW: 1_600, heatRateBtuPerKWh: 8_050, genOandMPerMWh: 8,
    redundancyFactor: 1.15, leadTimeMonths: 24, availabilityPct: 98, bridgeMonthsToGrid: 0,
    sourceNote: 'Origin Partners: $1,400–1,800/kW installed, 7,800–8,300 Btu/kWh HHV, 18–30 mo new-build (9–15 refurb), 6–10 units/100 MW.' },
  { id: 'btm-aero-sc', label: 'BTM — aeroderivative turbine, simple cycle', kind: 'btm', genCapexPerKW: 1_400, heatRateBtuPerKWh: 9_200, genOandMPerMWh: 6,
    redundancyFactor: 1.20, leadTimeMonths: 30, availabilityPct: 98, bridgeMonthsToGrid: 0,
    sourceNote: 'Origin Partners: $1,200–1,600/kW, 8,800–9,600 Btu/kWh, 24–36 mo (LM6000/SGT-A65), 12–18 mo refurbished.' },
  { id: 'btm-aero-cc', label: 'BTM — aeroderivative, combined cycle', kind: 'btm', genCapexPerKW: 2_100, heatRateBtuPerKWh: 7_100, genOandMPerMWh: 7,
    redundancyFactor: 1.20, leadTimeMonths: 36, availabilityPct: 97, bridgeMonthsToGrid: 0,
    sourceNote: 'Origin Partners: $1,800–2,400/kW, 6,800–7,400 Btu/kWh.' },
  { id: 'bridge-recip', label: 'Bridge-to-grid — recips now, grid later', kind: 'bridge', genCapexPerKW: 1_600, heatRateBtuPerKWh: 8_050, genOandMPerMWh: 8,
    redundancyFactor: 1.15, leadTimeMonths: 24, availabilityPct: 98, bridgeMonthsToGrid: 36,
    sourceNote: 'Origin Partners PPA post: 5–7 yr firm bridge PPA while interconnect completes. Generation retained as backup after grid energization.' },
];

// ─── Revenue models ──────────────────────────────────────────────────────────

export const REVENUE_MODELS: RevenueModelPreset[] = [
  { id: 'neocloud', label: 'Neocloud — GPU rental ($/GPU-hr)', buysServers: true, energyPassThrough: false,
    description: 'Operator owns GPUs and sells GPU-hours under reserved contracts plus on-demand. Origin Partners GPU financing requires contracted compute revenue.' },
  { id: 'inference', label: 'Inference API — token sales ($/M tokens)', buysServers: true, energyPassThrough: false,
    description: 'Operator owns GPUs and sells tokens. Revenue = GPUs × tok/s × utilization × $/M tokens.' },
  { id: 'colocation', label: 'Colocation / powered shell ($/kW-month)', buysServers: false, energyPassThrough: true,
    description: 'Tenant brings GPUs and pays energy. Operator earns a kW-month lease on IT capacity. Matches Origin turnkey hand-over model.' },
];

// ─── Capital stacks ──────────────────────────────────────────────────────────

export const CAPITAL_STACKS: CapitalStackPreset[] = [
  { id: 'all-equity', label: 'All equity', description: 'No debt. Unlevered reference case.', tranches: [], targetEquityIRRPct: 15,
    sourceNote: '—' },
  { id: 'senior-only', label: 'Senior project debt (60% LTC)', description: 'First-lien project finance sized on total cost.',
    tranches: [{ id: 'senior', label: 'Senior secured', basis: 'total', ltcPct: 60, ratePct: 7.5, tenorYears: 7, idcCapitalized: true }],
    targetEquityIRRPct: 18, sourceNote: 'Origin Partners PPA post: 60–70% opco leverage. Rate = SOFR + ~300 bp estimate.' },
  { id: 'senior-mezz', label: 'Senior 60% + mezzanine to 75% (Origin stack)', description: 'Mezz takes the stack from ~60% to ~75% LTV at 12–14% all-in.',
    tranches: [
      { id: 'senior', label: 'Senior secured', basis: 'total', ltcPct: 60, ratePct: 7.5, tenorYears: 7, idcCapitalized: true },
      { id: 'mezz', label: 'Mezzanine', basis: 'total', ltcPct: 15, ratePct: 13.0, tenorYears: 5, idcCapitalized: true },
    ],
    targetEquityIRRPct: 22, sourceNote: 'Origin Partners mezzanine post: 11–16% all-in, 3–7 yr tenor, 60%→75% LTV for BTM power with hyperscaler offtake.' },
  { id: 'gpu-financing', label: 'GPU equipment financing + infra senior', description: 'GPUs financed separately (vendor/asset-backed) over their useful life; infrastructure on longer senior debt.',
    tranches: [
      { id: 'gpu', label: 'GPU facility (asset-backed)', basis: 'servers', ltcPct: 70, ratePct: 11.0, tenorYears: 3, idcCapitalized: false },
      { id: 'infra-senior', label: 'Infrastructure senior', basis: 'infra', ltcPct: 60, ratePct: 7.5, tenorYears: 10, idcCapitalized: true },
    ],
    targetEquityIRRPct: 20, sourceNote: 'Origin Partners capital page: GPU acquisition facilities / sale-leasebacks require contracted compute revenue. 18–36 mo effective GPU life (Origin capital-stack post) → 3-yr tenor.' },
];

// ─── Credit support ──────────────────────────────────────────────────────────
// Shaped by the Origin Partners LinkedIn post on NVIDIA credit support for the
// Nscale / Anthropic facility: trigger, amount, duration, claim.

export const CREDIT_SUPPORTS: CreditSupportPreset[] = [
  { id: 'none', label: 'None', description: 'Lender relies on project cash flow and sponsor equity only.',
    coversPowerDelay: false, coversCostOverrun: false, coversOfftakerDefault: false, amountPctOfDebt: 0, durationMonthsPostCOD: 0,
    directDraw: false, recoveryLagMonths: 0, sourceNote: '—' },
  { id: 'vendor-backstop', label: 'Chip-vendor backstop (offtake only)', description: 'Vendor guarantees a slice of the customer\'s payment obligations. Does not cover power delay or cost overrun.',
    coversPowerDelay: false, coversCostOverrun: false, coversOfftakerDefault: true, amountPctOfDebt: 25, durationMonthsPostCOD: 24,
    directDraw: false, recoveryLagMonths: 6, sourceNote: 'Reports (Jul–Sep 2026) of NVIDIA backstopping up to ~$860M of Nscale lease obligations; terms not public. 25% / 24 mo / 6-mo claim lag are assumptions to be negotiated.' },
  { id: 'completion-guarantee', label: 'Sponsor / EPC completion guarantee', description: 'Covers construction overrun and power delay until COD. No coverage after the facility is operating.',
    coversPowerDelay: true, coversCostOverrun: true, coversOfftakerDefault: false, amountPctOfDebt: 20, durationMonthsPostCOD: 0,
    directDraw: true, recoveryLagMonths: 0, sourceNote: 'Standard project-finance completion support; sized at 20% of debt as an assumption.' },
  { id: 'full-wrap', label: 'Full wrap (all triggers, direct draw)', description: 'Covers all three triggers through the debt tenor, lender draws directly. The structure the lender wants; the structure nobody signs.',
    coversPowerDelay: true, coversCostOverrun: true, coversOfftakerDefault: true, amountPctOfDebt: 100, durationMonthsPostCOD: 84,
    directDraw: true, recoveryLagMonths: 0, sourceNote: 'Upper bound for comparison.' },
];

// ─── Default inputs ──────────────────────────────────────────────────────────

export const byId = <T extends { id: string }>(arr: T[], id: string): T => {
  const hit = arr.find(x => x.id === id);
  if (!hit) throw new Error(`Unknown preset id: ${id}`);
  return hit;
};

export const DEFAULT_SELECTION = {
  geographyId: 'us-ercot',
  chipId: 'gb200-nvl72',
  powerSourceId: 'btm-recip',
  revenueModelId: 'neocloud' as const,
  capitalStackId: 'senior-mezz',
  creditSupportId: 'vendor-backstop',
};

/** Build a full input set from dropdown selections, applying preset defaults. */
export function buildInputs(sel: Partial<typeof DEFAULT_SELECTION> & { name?: string; itCapacityMW?: number } = {}): BusinessCaseInputs {
  const s = { ...DEFAULT_SELECTION, ...sel };
  const geo = byId(GEOGRAPHIES, s.geographyId);
  const chip = byId(CHIPS, s.chipId);
  const pwr = byId(POWER_SOURCES, s.powerSourceId);
  const stack = byId(CAPITAL_STACKS, s.capitalStackId);
  const cs = byId(CREDIT_SUPPORTS, s.creditSupportId);
  const { id: _i, label: _l, description: _d, sourceNote: _s, ...csFields } = cs;
  void _i; void _l; void _d; void _s;

  return {
    name: sel.name ?? 'Untitled case',
    geographyId: geo.id, chipId: chip.id, powerSourceId: pwr.id, revenueModelId: s.revenueModelId,
    capitalStackId: stack.id, creditSupportId: cs.id, exitMethod: 'nbv',

    itCapacityMW: sel.itCapacityMW ?? 50,
    pue: chip.cooling === 'liquid' ? 1.15 : 1.25,
    horizonYears: 8,
    constructionMonths: 18,
    rampMonths: 6,

    tariffPerKWh: geo.tariffPerKWh, capacityChargePerMWDay: geo.capacityChargePerMWDay,
    gasPricePerMMBtu: geo.gasPricePerMMBtu, landPerMW: geo.landPerMW, laborCostPerFTE: geo.laborCostPerFTE,
    corporateTaxPct: geo.corporateTaxPct, propertyTaxPctOfCapex: geo.propertyTaxPctOfCapex,
    constructionCostIndex: geo.constructionCostIndex,

    gpusPerUnit: chip.gpusPerUnit, unitKW: chip.unitKW, unitCostUSD: chip.unitCostUSD,
    tokensPerGPUPerSec: chip.tokensPerGPUPerSec, cooling: chip.cooling,
    networkPctOfServer: 15, gpuDepreciationYears: 4, gpuRefresh: true, refreshCostPct: 85,

    shellPerKW: 3_000, mepPerKW: 8_300, liquidCoolingPremiumPct: 10, utilityWorksPerKW: 300,
    infraDepreciationYears: 15, contingencyPct: 7.5,

    genCapexPerKW: pwr.genCapexPerKW, heatRateBtuPerKWh: pwr.heatRateBtuPerKWh, genOandMPerMWh: pwr.genOandMPerMWh,
    redundancyFactor: pwr.redundancyFactor,
    powerLeadTimeMonths: pwr.kind === 'grid' ? geo.gridInterconnectMonths : pwr.leadTimeMonths,
    bridgeMonthsToGrid: pwr.bridgeMonthsToGrid, idleLoadPct: 35,

    utilizationPct: 75, contractedSharePct: 70,
    contractedPricePerGpuHr: chip.contractedPricePerGpuHr, onDemandPricePerGpuHr: chip.onDemandPricePerGpuHr,
    // H100: ~$8/hr (2023) → $2.35 1-yr contract (Mar-2026) ≈ -33%/yr; 20% is the mid case. Colocation leases escalate +3%.
    priceDeclinePctPerYear: s.revenueModelId === 'colocation' ? -3 : 20,
    tokenPricePerM: 1.50, colocationPerKWMonth: 180, colocationOccupancyPct: 95,

    fteDensityPerMW: s.revenueModelId === 'colocation' ? 0.5 : 1.5,
    maintenancePctOfCapex: s.revenueModelId === 'colocation' ? 1.6 : 2.0,
    insurancePctOfCapex: 0.4,
    sgaPctOfRevenue: s.revenueModelId === 'colocation' ? 4 : 8,

    tranches: stack.tranches.map(t => ({ ...t })), gracePeriodMonths: 6, targetEquityIRRPct: stack.targetEquityIRRPct,
    discountRatePct: 10, exitEbitdaMultiple: 6, exitPerMW: 11_000_000,

    creditSupport: csFields,
    stress: { codDelayMonths: 12, capexOverrunPct: 20, offtakerNonPayStartMonth: 12, offtakerNonPayMonths: 6, priceShockPct: -30 },
  };
}
