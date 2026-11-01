// Business Case Agent — typed inputs / outputs.
//
// The engine is a pure function of BusinessCaseInputs. Every number in an
// input is user-overridable; the dropdown presets in presets.ts only supply
// defaults. Units are stated on every field.

export type CoolingType = 'air' | 'liquid';
export type RevenueModelId = 'neocloud' | 'inference' | 'colocation';
export type PowerSourceKind = 'grid' | 'btm' | 'bridge';
export type ExitMethod = 'nbv' | 'ebitdaMultiple' | 'perMW';
export type TrancheBasis = 'total' | 'servers' | 'infra';

export interface GeographyPreset {
  id: string;
  label: string;
  region: 'North America' | 'Gulf' | 'Europe' | 'Asia-Pacific';
  currencyNote: string;
  tariffPerKWh: number;           // $/kWh delivered industrial / large-load tariff (energy + network)
  capacityChargePerMWDay: number; // $/MW-day capacity charge (0 where energy-only)
  gasPricePerMMBtu: number;       // $/MMBtu delivered burner-tip gas
  landPerMW: number;              // $ per MW of IT, powered land (entitled, with interconnect path)
  laborCostPerFTE: number;        // $/FTE/yr fully loaded
  corporateTaxPct: number;        // % on taxable income
  propertyTaxPctOfCapex: number;  // % of infra capex per year
  gridInterconnectMonths: number; // months from application to energization (large load)
  constructionCostIndex: number;  // multiplier on $/kW build costs (ERCOT = 1.00)
  asOf: string;                   // date the tariff/gas figures were checked
  sourceNote: string;
}

export interface ChipPreset {
  id: string;
  label: string;
  vendor: 'NVIDIA' | 'AMD';
  gpusPerUnit: number;          // GPUs per sellable unit (8-GPU HGX node or 72-GPU NVL rack)
  unitKW: number;               // kW per unit at full load, incl. CPU/NIC/fans
  unitCostUSD: number;          // $ per unit (server/rack, excl. network fabric)
  tokensPerGPUPerSec: number;   // blended inference throughput (static matrix; order-of-magnitude)
  cooling: CoolingType;
  contractedPricePerGpuHr: number; // $/GPU-hr, 1–3 yr reserved
  onDemandPricePerGpuHr: number;   // $/GPU-hr, on-demand market median
  releaseYear: number;
  sourceNote: string;
}

export interface PowerSourcePreset {
  id: string;
  label: string;
  kind: PowerSourceKind;
  genCapexPerKW: number;        // $/kW of generation nameplate (0 for grid)
  heatRateBtuPerKWh: number;    // HHV heat rate (0 for grid)
  genOandMPerMWh: number;       // $/MWh variable O&M for generation
  redundancyFactor: number;     // nameplate / facility peak (N+1 style)
  leadTimeMonths: number;       // months from PO to energization (overrides grid interconnect when BTM)
  availabilityPct: number;      // guaranteed availability (used only for the plan text)
  bridgeMonthsToGrid: number;   // bridge kind only: months after COD until grid takes over
  sourceNote: string;
}

export interface RevenueModelPreset {
  id: RevenueModelId;
  label: string;
  description: string;
  buysServers: boolean;         // colocation tenant brings its own GPUs
  energyPassThrough: boolean;   // colocation: tenant pays energy
}

export interface DebtTranche {
  id: string;
  label: string;
  basis: TrancheBasis;          // what the LTC is applied to
  ltcPct: number;               // % of basis funded by this tranche
  ratePct: number;              // all-in annual interest, %
  tenorYears: number;           // amortization from COD
  idcCapitalized: boolean;      // capitalize interest during construction
}

export interface CapitalStackPreset {
  id: string;
  label: string;
  description: string;
  tranches: DebtTranche[];
  targetEquityIRRPct: number;
  sourceNote: string;
}

export interface CreditSupportPreset {
  id: string;
  label: string;
  description: string;
  coversPowerDelay: boolean;      // trigger: COD slips because power is late
  coversCostOverrun: boolean;     // trigger: construction over budget
  coversOfftakerDefault: boolean; // trigger: customer stops paying
  amountPctOfDebt: number;        // cap on support, % of total debt at COD
  durationMonthsPostCOD: number;  // support expires this many months after (planned) COD
  directDraw: boolean;            // lender draws directly vs. must pursue the project company first
  recoveryLagMonths: number;      // months between shortfall and cash if not direct draw
  sourceNote: string;
}

export interface StressInputs {
  codDelayMonths: number;         // power / construction delay
  capexOverrunPct: number;        // construction over budget, % of infra+gen capex
  offtakerNonPayStartMonth: number; // months after COD when non-payment starts
  offtakerNonPayMonths: number;   // length of non-payment
  priceShockPct: number;          // % change in realised price from year 2 (negative = decline)
}

export interface BusinessCaseInputs {
  name: string;
  // ── Dropdown selections ───────────────────────────────────────────────────
  geographyId: string;
  chipId: string;
  powerSourceId: string;
  revenueModelId: RevenueModelId;
  capitalStackId: string;
  creditSupportId: string;
  exitMethod: ExitMethod;

  // ── Sizing ────────────────────────────────────────────────────────────────
  itCapacityMW: number;           // critical IT load, MW
  pue: number;
  horizonYears: number;           // operating horizon after COD
  constructionMonths: number;     // shell + MEP build (power lead time is max'd against this)
  rampMonths: number;             // months from COD to full utilization

  // ── Geography overrides (defaults from preset) ────────────────────────────
  tariffPerKWh: number;
  capacityChargePerMWDay: number;
  gasPricePerMMBtu: number;
  landPerMW: number;
  laborCostPerFTE: number;
  corporateTaxPct: number;
  propertyTaxPctOfCapex: number;
  constructionCostIndex: number;

  // ── Chip overrides ────────────────────────────────────────────────────────
  gpusPerUnit: number;
  unitKW: number;
  unitCostUSD: number;
  tokensPerGPUPerSec: number;
  cooling: CoolingType;
  networkPctOfServer: number;     // fabric + storage as % of server capex
  gpuDepreciationYears: number;   // tax life AND refresh cycle
  gpuRefresh: boolean;            // re-buy servers at end of each GPU life while horizon remains
  refreshCostPct: number;         // refresh capex as % of original server+network capex

  // ── Facility capex ($/kW IT, before cost index) ───────────────────────────
  shellPerKW: number;
  mepPerKW: number;               // electrical + mechanical; liquid premium applied via cooling
  liquidCoolingPremiumPct: number;
  utilityWorksPerKW: number;      // substation / interconnect works
  infraDepreciationYears: number;
  contingencyPct: number;

  // ── Power ─────────────────────────────────────────────────────────────────
  genCapexPerKW: number;
  heatRateBtuPerKWh: number;
  genOandMPerMWh: number;
  redundancyFactor: number;
  powerLeadTimeMonths: number;
  bridgeMonthsToGrid: number;
  idleLoadPct: number;            // IT draw at 0% utilization as % of peak

  // ── Revenue ───────────────────────────────────────────────────────────────
  utilizationPct: number;         // sold / billable GPU-hours as % of available
  contractedSharePct: number;     // share of capacity under reserved contracts
  contractedPricePerGpuHr: number;
  onDemandPricePerGpuHr: number;
  priceDeclinePctPerYear: number; // realised $/GPU-hr erosion
  tokenPricePerM: number;         // inference model: $/M tokens blended
  colocationPerKWMonth: number;   // colocation model: $/kW-month on IT capacity
  colocationOccupancyPct: number;

  // ── Opex ──────────────────────────────────────────────────────────────────
  fteDensityPerMW: number;
  maintenancePctOfCapex: number;  // facility + servers, % of capex per year
  insurancePctOfCapex: number;
  sgaPctOfRevenue: number;

  // ── Capital ───────────────────────────────────────────────────────────────
  tranches: DebtTranche[];
  gracePeriodMonths: number;      // interest-only months after COD before amortisation
  targetEquityIRRPct: number;
  discountRatePct: number;        // for NPV (project WACC)
  exitEbitdaMultiple: number;
  exitPerMW: number;              // $/MW IT, powered-shell style exit

  // ── Credit support ────────────────────────────────────────────────────────
  creditSupport: Omit<CreditSupportPreset, 'id' | 'label' | 'description' | 'sourceNote'>;

  // ── Stress ────────────────────────────────────────────────────────────────
  stress: StressInputs;
}

export interface MonthRow {
  m: number;                 // month index from financial close (0-based)
  phase: 'construction' | 'ramp' | 'operating';
  capex: number;
  revenue: number;
  energyCost: number;
  opex: number;              // all cash opex incl. energy
  ebitda: number;
  tax: number;
  cfads: number;             // cash flow available for debt service (after tax)
  interest: number;
  principal: number;
  debtDraw: number;
  equityDraw: number;
  debtBalance: number;
  dscr: number | null;
  unleveredCF: number;
  leveredCF: number;
}

export interface YearRow {
  year: number;
  revenue: number;
  energyCost: number;
  opex: number;
  ebitda: number;
  ebitdaMarginPct: number;
  capex: number;
  tax: number;
  debtService: number;
  dscr: number | null;
  unleveredCF: number;
  leveredCF: number;
  debtBalance: number;
}

export interface CapexBreakdown {
  land: number;
  shell: number;
  mep: number;
  utilityWorks: number;
  generation: number;
  servers: number;
  network: number;
  contingency: number;
  idc: number;
  refresh: number;           // GPU refresh capex over the horizon (not in initial sources & uses)
  total: number;             // initial capex incl. IDC and any overrun (excl. refresh)
}

export interface SourcesUses {
  uses: CapexBreakdown;
  sources: { label: string; amount: number; pct: number }[];
  totalDebt: number;
  totalEquity: number;
}

export interface StressResult {
  id: string;
  label: string;
  trigger: 'none' | 'powerDelay' | 'costOverrun' | 'offtakerDefault' | 'priceShock' | 'combined';
  equityIRRPct: number | null;
  projectIRRPct: number | null;
  minDSCR: number | null;
  shortfallTotal: number;       // cumulative debt-service shortfall (CFADS < debt service)
  shortfallMonths: number;
  shortfallBeyondSupportMonths: number;
  supportCovers: boolean;
  supportCapped: number;        // amount of shortfall support would pay
  uncovered: number;            // sponsor equity cure required
  lagExposure: number;          // shortfall occurring before support cash arrives (claim lag)
}

export interface BusinessCaseOutputs {
  gpus: number;
  units: number;
  facilityMW: number;
  generationMW: number;
  codMonth: number;
  capex: CapexBreakdown;
  sourcesUses: SourcesUses;
  monthly: MonthRow[];
  annual: YearRow[];
  projectIRRPct: number | null;
  equityIRRPct: number | null;
  npv: number;
  minDSCR: number | null;
  avgDSCR: number | null;
  paybackMonth: number | null;  // months after close when cumulative levered CF turns positive
  year1Revenue: number;
  year1EBITDA: number;
  steadyStateEBITDA: number;
  capexPerMW: number;
  capexPerGPU: number;
  energyCostPerGpuHr: number;
  allInCostPerGpuHr: number;    // steady-state (opex + depreciation + interest) per sold GPU-hr
  breakevenPricePerGpuHr: number | null; // price at which NPV @ discount rate = 0
  equivalentTokenPricePerM: number | null;
  terminalValue: number;
  debtCapacityAt130: number;    // PV of CFADS / 1.30 at senior rate
  stresses: StressResult[];
}
