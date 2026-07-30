/**
 * AI Factory model engine — TypeScript port of the verified Excel/Python model
 * (scripts/create_ai_factory_model.py + scripts/test_ai_factory_model.py).
 * Pure functions, no I/O. Cross-language parity is enforced by
 * scripts/test-ai-factory-parity.mjs against a Python-generated fixture.
 */

// ---------------------------------------------------------------- libraries

export interface RackType {
  name: string;
  cls: 'Compute' | 'Network' | 'Storage';
  gpus: number;
  kw: number;
  tdpW: number;
  cooling: 'Liquid' | 'Air';
  priceM: number; // rack CapEx, $M (published/reported; est. where noted)
  note: string;
}

export const RACK_LIBRARY: RackType[] = [
  { name: 'Vera Rubin NVL72', cls: 'Compute', gpus: 72, kw: 227, tdpW: 2300, cooling: 'Liquid', priceM: 7.4,
    note: 'Reported envelope 130–250 kW; 227 kW = Max-P; $6.0–8.8M reported' },
  { name: 'GB300 NVL72', cls: 'Compute', gpus: 72, kw: 137, tdpW: 1400, cooling: 'Liquid', priceM: 4.0,
    note: 'Vendor ~132–142 kW nominal, ~155 kW peak; price est.' },
  { name: 'GB200 NVL72', cls: 'Compute', gpus: 72, kw: 121, tdpW: 1200, cooling: 'Liquid', priceM: 3.5,
    note: '~120 kW nominal; $3.1–3.9M all-in reported' },
  { name: 'Rubin Ultra NVL576 (Kyber)', cls: 'Compute', gpus: 576, kw: 600, tdpW: 2300, cooling: 'Liquid', priceM: 30,
    note: 'Announced; power & price are estimates — verify before design' },
  { name: 'HGX H100 air rack (4x 8-GPU)', cls: 'Compute', gpus: 32, kw: 44, tdpW: 700, cooling: 'Air', priceM: 0.35,
    note: 'Legacy air-cooled baseline' },
  { name: 'Quantum-X800 IB fabric rack', cls: 'Network', gpus: 0, kw: 100, tdpW: 0, cooling: 'Air', priceM: 0.5,
    note: 'Scale-out leaf/spine block — estimate' },
  { name: 'Spectrum-X CPO fabric rack', cls: 'Network', gpus: 0, kw: 80, tdpW: 0, cooling: 'Liquid', priceM: 0.8,
    note: 'Co-packaged-optics switch rack — estimate' },
  { name: 'NVMe flash storage rack', cls: 'Storage', gpus: 0, kw: 40, tdpW: 0, cooling: 'Air', priceM: 0.4,
    note: 'High-performance NVMe tier — estimate' },
  { name: 'HDD object storage rack', cls: 'Storage', gpus: 0, kw: 25, tdpW: 0, cooling: 'Air', priceM: 0.25,
    note: 'Bulk object tier — estimate' },
];

export interface ClimateLocation {
  name: string;
  zone: string;
  mlcLimit: number; // ASHRAE 90.4 max design MLC (editable reference values)
  db20: number;     // N=20yr extreme peak dry-bulb °C
  wb20: number;     // N=20yr peak wet-bulb °C
}

export const LOCATION_LIBRARY: ClimateLocation[] = [
  { name: 'Abu Dhabi, UAE', zone: '1A', mlcLimit: 0.26, db20: 50.0, wb20: 30.0 },
  { name: 'Dubai, UAE', zone: '0B', mlcLimit: 0.28, db20: 49.5, wb20: 31.0 },
  { name: 'Riyadh, Saudi Arabia', zone: '0B', mlcLimit: 0.28, db20: 49.0, wb20: 24.0 },
  { name: 'Singapore', zone: '0A', mlcLimit: 0.28, db20: 36.5, wb20: 29.5 },
  { name: 'Mumbai, India', zone: '0A', mlcLimit: 0.28, db20: 39.5, wb20: 30.0 },
  { name: 'Phoenix, AZ, USA', zone: '2B', mlcLimit: 0.25, db20: 48.5, wb20: 26.5 },
  { name: 'Dallas, TX, USA', zone: '3A', mlcLimit: 0.21, db20: 43.5, wb20: 27.5 },
  { name: 'Ashburn, VA, USA', zone: '4A', mlcLimit: 0.19, db20: 39.0, wb20: 27.0 },
  { name: 'Chicago, IL, USA', zone: '5A', mlcLimit: 0.16, db20: 38.5, wb20: 27.0 },
  { name: 'Frankfurt, Germany', zone: '5A', mlcLimit: 0.16, db20: 37.5, wb20: 23.0 },
  { name: 'Amsterdam, Netherlands', zone: '5A', mlcLimit: 0.16, db20: 35.0, wb20: 22.0 },
  { name: 'Dublin, Ireland', zone: '5A', mlcLimit: 0.16, db20: 28.5, wb20: 19.5 },
  { name: 'Oslo, Norway', zone: '6A', mlcLimit: 0.15, db20: 32.0, wb20: 21.0 },
  { name: 'Tokyo, Japan', zone: '3A', mlcLimit: 0.21, db20: 37.5, wb20: 27.5 },
  { name: 'Sydney, Australia', zone: '3A', mlcLimit: 0.21, db20: 43.0, wb20: 24.5 },
];

export const TARIFFS = [0.04, 0.06, 0.08, 0.1];
export const DEBT_RATIOS = [0.5, 0.6, 0.7, 0.8];

// ---------------------------------------------------------------- inputs

export interface AIFactoryInputs {
  location: string;
  vrType: string; vrCount: number;
  netType: string; netCount: number;
  stoType: string; stoCount: number;
  liqOverhead: number; airOverhead: number;
  fws: number; fwr: number; coolantCp: number; coolantRho: number;
  pue: number; utilization: number; uptime: number;
  tokensPerGpuSec: number; tokenFleetShare: number;
  wue: number; gridCarbon: number;
  tariff: number; tariffEsc: number;
  facilityCapexPerMW: number;
  fixedOpexPerMW: number;
  residualPct: number; debtRatio: number; interestRate: number;
  tenor: number; taxRate: number; gidlrCap: number; hurdleRate: number;
  opexEsc: number;
  leasePerGpuHr: number; tokenPricePerM: number;
  year1Ramp: number; leaseEsc: number; tokenDecline: number; tokenGrowth: number;
  horizon: number; depLife: number;
  blocksPerYear: number[];
}

export const DEFAULT_INPUTS: AIFactoryInputs = {
  location: 'Abu Dhabi, UAE',
  vrType: 'Vera Rubin NVL72', vrCount: 32,
  netType: 'Quantum-X800 IB fabric rack', netCount: 6,
  stoType: 'NVMe flash storage rack', stoCount: 10,
  liqOverhead: 0.05, airOverhead: 0.28,
  fws: 45, fwr: 55, coolantCp: 3.85, coolantRho: 1.03,
  pue: 1.08, utilization: 0.85, uptime: 0.995,
  tokensPerGpuSec: 1800, tokenFleetShare: 0.3,
  wue: 0.15, gridCarbon: 0.39,
  tariff: 0.06, tariffEsc: 0.02,
  facilityCapexPerMW: 11_050_000,
  fixedOpexPerMW: 1_316_000,
  residualPct: 0.1, debtRatio: 0.8, interestRate: 0.065,
  tenor: 5, taxRate: 0.09, gidlrCap: 0.3, hurdleRate: 0.15,
  opexEsc: 0.03,
  leasePerGpuHr: 4.92, tokenPricePerM: 0.76,
  year1Ramp: 0.9, leaseEsc: 0.0, tokenDecline: 0.15, tokenGrowth: 0.25,
  horizon: 5, depLife: 5,
  blocksPerYear: [2, 2, 4, 4, 4],
};

// ---------------------------------------------------------------- outputs

export interface SensitivityCell {
  tariff: number; debtRatio: number; irr: number; avgDscr: number;
}

export interface ExpansionResult {
  added: number[]; cumBlocks: number[]; ebitda: number[]; cumFunding: number[];
  finalMW: number; finalGpus: number; peakFunding: number;
  runRateEbitda: number; capexTotal: number; cashPositiveYear: string;
}

export interface AIFactoryResult {
  // architecture & thermal
  itKw: number; liquidKw: number; airKw: number; liquidRacks: number;
  gpus: number; flowPerRack: number; flowTotal: number;
  mlc: number; mlcLimit: number; mlcMargin: number;
  zone: string; db20: number; wb20: number; approach: number;
  energyMwh: number; waterM3: number; co2T: number;
  // finance
  capex: number; debt: number; equity: number; ds: number;
  rev: number[]; ebitda: number[]; opex: number[]; elec: number[];
  fcfe: number[]; fcff: number[]; cum: number[];
  equityIrr: number | null; projectIrr: number | null;
  npv: number; moic: number; payback: number | null;
  dscr: number[]; minDscr: number; avgDscr: number;
  // unit economics
  capexPerGpu: number; revPerGpuHr: number; opexPerGpuHr: number;
  costPerMTok: number; pricePerMTok: number; tokCapT: number;
  energyPctRev: number; breakevenTariff: number;
  sensitivity: SensitivityCell[];
  expansion: ExpansionResult;
}

// ---------------------------------------------------------------- helpers

const pmt = (rate: number, n: number, pv: number) =>
  (pv * rate) / (1 - Math.pow(1 + rate, -n));

export function irr(cashflows: number[], lo = -0.99, hi = 10, tol = 1e-10): number | null {
  const npvAt = (r: number) =>
    cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  let fLo = npvAt(lo);
  if (fLo * npvAt(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < tol) return mid;
    if (fLo * fMid < 0) hi = mid;
    else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
}

function debtSchedule(debt: number, rate: number, tenor: number, n: number) {
  const dsFull = pmt(rate, tenor, debt);
  let bal = debt;
  const ds: number[] = [], interest: number[] = [], ending: number[] = [];
  for (let y = 1; y <= n; y++) {
    const d = y <= tenor ? dsFull : 0;
    const i = bal * rate;
    bal -= d - i;
    ds.push(d); interest.push(i); ending.push(bal);
  }
  return { dsFull, ds, interest, ending };
}

export const rackByName = (name: string): RackType =>
  RACK_LIBRARY.find((r) => r.name === name) ?? RACK_LIBRARY[0];
export const locationByName = (name: string): ClimateLocation =>
  LOCATION_LIBRARY.find((l) => l.name === name) ?? LOCATION_LIBRARY[0];

// ---------------------------------------------------------------- engine

export function computeModel(inp: AIFactoryInputs): AIFactoryResult {
  const p = inp;
  const n = Math.max(2, Math.min(Math.round(p.horizon), 15));
  const vr = rackByName(p.vrType);
  const net = rackByName(p.netType);
  const sto = rackByName(p.stoType);
  const loc = locationByName(p.location);

  const loads = { vr: p.vrCount * vr.kw, net: p.netCount * net.kw, sto: p.stoCount * sto.kw };
  const itKw = loads.vr + loads.net + loads.sto;
  const liquidKw =
    (vr.cooling === 'Liquid' ? loads.vr : 0) +
    (net.cooling === 'Liquid' ? loads.net : 0) +
    (sto.cooling === 'Liquid' ? loads.sto : 0);
  const airKw = itKw - liquidKw;
  const liquidRacks =
    (vr.cooling === 'Liquid' ? p.vrCount : 0) +
    (net.cooling === 'Liquid' ? p.netCount : 0) +
    (sto.cooling === 'Liquid' ? p.stoCount : 0);
  const dt = p.fwr - p.fws;
  const flowPerRack = (vr.kw / (p.coolantRho * p.coolantCp * dt)) * 60;
  const flowTotal = (liquidKw / (p.coolantRho * p.coolantCp * dt)) * 60;
  const mlc = (liquidKw * p.liqOverhead + airKw * p.airOverhead) / itKw;
  const mlcMargin = (loc.mlcLimit - mlc) / loc.mlcLimit;
  const avgItKw = itKw * p.utilization * p.uptime;
  const energyMwh = (avgItKw * 8760 * p.pue) / 1000;
  const kwh = energyMwh * 1000;

  // Per-unit financial drivers → lump sums (mirrors the workbook DERIVED rows)
  const itMW = itKw / 1000;
  const capex =
    p.facilityCapexPerMW * itMW +
    (p.vrCount * vr.priceM + p.netCount * net.priceM + p.stoCount * sto.priceM) * 1e6;
  const fixedOpex0 = p.fixedOpexPerMW * itMW;
  const gpus = p.vrCount * vr.gpus;
  const soldHrs = gpus * 8760 * p.uptime * p.utilization;
  const leaseRev0 = p.leasePerGpuHr * soldHrs * (1 - p.tokenFleetShare);
  const tokenRev0 =
    (p.tokenPricePerM * gpus * p.tokenFleetShare * p.tokensPerGpuSec *
      3600 * 8760 * p.utilization * p.uptime) / 1e6;

  const ramp = [p.year1Ramp, ...Array(n - 1).fill(1)] as number[];
  const tokF = (1 + p.tokenGrowth) * (1 - p.tokenDecline);
  const lease = ramp.map((rp, t) => leaseRev0 * Math.pow(1 + p.leaseEsc, t) * rp);
  const token = ramp.map((rp, t) => tokenRev0 * Math.pow(tokF, t) * rp);
  const rev = lease.map((l, t) => l + token[t]);
  const elec = ramp.map((_, t) => kwh * p.tariff * Math.pow(1 + p.tariffEsc, t));
  const fixed = ramp.map((_, t) => fixedOpex0 * Math.pow(1 + p.opexEsc, t));
  const opex = elec.map((e, t) => e + fixed[t]);
  const ebitda = rev.map((r, t) => r - opex[t]);

  const debt = capex * p.debtRatio;
  const equity = capex - debt;
  const sched = debtSchedule(debt, p.interestRate, p.tenor, n);
  const depr = Array.from({ length: n }, (_, i) =>
    i + 1 <= p.depLife ? capex / p.depLife : 0);
  const resid = capex * p.residualPct;
  const dedInt = sched.interest.map((i, t) => Math.min(i, p.gidlrCap * ebitda[t]));
  const tax = ebitda.map((e, t) =>
    Math.max(0, e - depr[t] - dedInt[t]) * p.taxRate);
  const fcfeYears = ebitda.map((e, t) => e - sched.ds[t] - tax[t]);
  fcfeYears[n - 1] += resid;
  const fcfe = [-equity, ...fcfeYears];

  const cum: number[] = [];
  let running = 0;
  for (const cf of fcfe) { running += cf; cum.push(running); }
  const equityIrr = irr(fcfe);
  const npv = fcfe.reduce((s, cf, t) => s + cf / Math.pow(1 + p.hurdleRate, t), 0);
  const moic = fcfeYears.reduce((s, c) => s + c, 0) / equity;
  const nNeg = cum.filter((c) => c < 0).length;
  const payback = nNeg >= cum.length
    ? null
    : nNeg - 1 + Math.abs(cum[nNeg - 1]) / fcfe[nNeg];
  const dscr = ebitda
    .map((e, t) => (sched.ds[t] > 0 ? e / sched.ds[t] : NaN))
    .filter((x) => !Number.isNaN(x));
  const minDscr = Math.min(...dscr);
  const avgDscr = dscr.reduce((s, x) => s + x, 0) / dscr.length;

  const utax = ebitda.map((e, t) => Math.max(0, e - depr[t]) * p.taxRate);
  const fcffYears = ebitda.map((e, t) => e - utax[t]);
  fcffYears[n - 1] += resid;
  const fcff = [-capex, ...fcffYears];
  const projectIrr = irr(fcff);

  // Unit economics (Year 2, post-ramp)
  const tokCapT =
    (gpus * p.tokenFleetShare * p.tokensPerGpuSec * 3600 * 8760 *
      p.utilization * p.uptime) / 1e12;
  const y2 = Math.min(1, n - 1);

  // Sensitivity engine (tariff x leverage; same revenue & fixed OpEx)
  const sensitivity: SensitivityCell[] = [];
  for (const tf of TARIFFS) {
    for (const dr of DEBT_RATIOS) {
      const sd = capex * dr;
      const se = capex - sd;
      const s = debtSchedule(sd, p.interestRate, p.tenor, n);
      const sElec = ramp.map((_, t) => kwh * tf * Math.pow(1 + p.tariffEsc, t));
      const sEb = rev.map((r, t) => r - fixed[t] - sElec[t]);
      const sDed = s.interest.map((i, t) => Math.min(i, p.gidlrCap * sEb[t]));
      const sTax = sEb.map((e, t) =>
        Math.max(0, e - depr[t] - sDed[t]) * p.taxRate);
      const sF = sEb.map((e, t) => e - s.ds[t] - sTax[t]);
      sF[n - 1] += resid;
      sensitivity.push({
        tariff: tf, debtRatio: dr,
        irr: irr([-se, ...sF]) ?? NaN,
        avgDscr: sEb.reduce((a, b) => a + b, 0) / n / s.dsFull,
      });
    }
  }

  // Phased expansion (identical blocks; Year-2 steady-state block economics)
  const schedBlocks = [...p.blocksPerYear, ...Array(n).fill(0)].slice(0, n);
  const exp: ExpansionResult = {
    added: schedBlocks, cumBlocks: [], ebitda: [], cumFunding: [],
    finalMW: 0, finalGpus: 0, peakFunding: 0, runRateEbitda: 0,
    capexTotal: 0, cashPositiveYear: '',
  };
  let cumB = 0, cash = 0;
  for (let t = 0; t < n; t++) {
    const eff = cumB + schedBlocks[t] * p.year1Ramp;
    cumB += schedBlocks[t];
    const eb = eff * ebitda[y2];
    cash += eb - schedBlocks[t] * capex;
    exp.cumBlocks.push(cumB);
    exp.ebitda.push(eb);
    exp.cumFunding.push(cash);
  }
  exp.finalMW = (cumB * itKw) / 1000;
  exp.finalGpus = cumB * gpus;
  exp.peakFunding = Math.min(...exp.cumFunding);
  exp.runRateEbitda = cumB * ebitda[y2];
  exp.capexTotal = schedBlocks.reduce((s, b) => s + b, 0) * capex;
  const nNegX = exp.cumFunding.filter((c) => c < 0).length;
  exp.cashPositiveYear = nNegX === n ? `>${n}` : String(nNegX + 1);

  return {
    itKw, liquidKw, airKw, liquidRacks, gpus, flowPerRack, flowTotal,
    mlc, mlcLimit: loc.mlcLimit, mlcMargin,
    zone: loc.zone, db20: loc.db20, wb20: loc.wb20, approach: p.fwr - loc.db20,
    energyMwh, waterM3: energyMwh * p.wue, co2T: energyMwh * p.gridCarbon,
    capex, debt, equity, ds: sched.dsFull,
    rev, ebitda, opex, elec, fcfe, fcff, cum,
    equityIrr, projectIrr, npv, moic, payback,
    dscr, minDscr, avgDscr,
    capexPerGpu: capex / gpus,
    revPerGpuHr: rev[y2] / soldHrs,
    opexPerGpuHr: opex[y2] / soldHrs,
    costPerMTok: (opex[y2] * p.tokenFleetShare) / (tokCapT * 1e6),
    pricePerMTok: token[y2] / (tokCapT * 1e6),
    tokCapT,
    energyPctRev: elec[y2] / rev[y2],
    breakevenTariff: (rev[y2] - fixed[y2]) / kwh,
    sensitivity,
    expansion: exp,
  };
}
