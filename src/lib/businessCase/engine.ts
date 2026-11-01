// Business Case engine — pure, deterministic, monthly resolution.
//
// Chain:  MW → PUE → IT kW → units → GPUs → GPU-hours / tokens / kW-months → revenue
//         capex (land, shell, MEP, utility, generation, servers, network, contingency, IDC)
//         opex  (energy or gas×heat-rate, labor, maintenance, insurance, property tax, SG&A)
//         debt  (N tranches, LTC on basis, IDC, level annuity from COD)
//         tax   (depreciation + interest shield, loss carry-forward)
//         →  project IRR, equity IRR, NPV, DSCR, payback, breakeven price,
//            stress cases and credit-support coverage (trigger / amount / duration / claim).
//
// Independent reference: scripts/business-case/reference_model.py

import type {
  BusinessCaseInputs, BusinessCaseOutputs, MonthRow, YearRow, CapexBreakdown,
  SourcesUses, StressResult, StressInputs,
} from './types.ts';
import { REVENUE_MODELS, byId } from './presets.ts';

const HOURS_PER_MONTH = 8760 / 12;
const DAYS_PER_MONTH = 365 / 12;

// ─── Numeric helpers ─────────────────────────────────────────────────────────

/** Monthly IRR by bisection, annualised. Returns null if no sign change. */
export function irr(cf: number[]): number | null {
  const hasPos = cf.some(v => v > 0), hasNeg = cf.some(v => v < 0);
  if (!hasPos || !hasNeg) return null;
  const npvAt = (r: number) => cf.reduce((acc, v, i) => acc + v / Math.pow(1 + r, i), 0);
  let lo = -0.5, hi = 1.0; // -0.5/month ≈ -99.98%/yr; -0.99 underflows (1+r)^n to 0 on long schedules
  let fLo = npvAt(lo), fHi = npvAt(hi);
  if (fLo * fHi > 0) {
    // widen search once
    hi = 10; fHi = npvAt(hi);
    if (fLo * fHi > 0) return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(mid);
    if (Math.abs(fMid) < 1e-6) { lo = hi = mid; break; }
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  const monthly = (lo + hi) / 2;
  return (Math.pow(1 + monthly, 12) - 1) * 100;
}

export function npv(cf: number[], annualRatePct: number): number {
  const r = Math.pow(1 + annualRatePct / 100, 1 / 12) - 1;
  return cf.reduce((acc, v, i) => acc + v / Math.pow(1 + r, i), 0);
}

function annuity(balance: number, monthlyRate: number, n: number): number {
  if (n <= 0) return balance;
  if (monthlyRate === 0) return balance / n;
  return balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -n));
}

// ─── Core simulation ─────────────────────────────────────────────────────────

interface SimOptions {
  stress: Partial<StressInputs> & { applyPriceShock?: boolean };
  priceScale?: number; // for breakeven search
}

interface SimResult {
  monthly: MonthRow[];
  capex: CapexBreakdown;
  codMonth: number;
  plannedCod: number;
  totalDebtAtCod: number;
  overrunAmount: number;
  unleveredCF: number[];
  leveredCF: number[];
  terminalValue: number;
  shortfalls: number[]; // per month, debt-service shortfall (incl. cash IDC during delay)
  seniorRatePct: number;
  cfadsSeries: number[];
  gpus: number; units: number; facilityMW: number; generationMW: number;
  trancheDraws: { label: string; drawn: number }[];
}

function simulate(inp: BusinessCaseInputs, opt: SimOptions): SimResult {
  const rm = byId(REVENUE_MODELS, inp.revenueModelId);
  const st = {
    codDelayMonths: 0, capexOverrunPct: 0, offtakerNonPayStartMonth: 0, offtakerNonPayMonths: 0, priceShockPct: 0,
    ...opt.stress,
  };
  const priceScale = opt.priceScale ?? 1;

  // ── Sizing
  const itMW = inp.itCapacityMW;
  const itKW = itMW * 1000;
  const units = Math.floor(itKW / inp.unitKW);
  const gpus = units * inp.gpusPerUnit;
  const facilityMW = itMW * inp.pue;
  const isBtm = inp.genCapexPerKW > 0;
  const generationMW = isBtm ? facilityMW * inp.redundancyFactor : 0;

  // ── Capex (budget)
  const idx = inp.constructionCostIndex;
  const land = inp.landPerMW * itMW;
  const shell = inp.shellPerKW * itKW * idx;
  const mep = inp.mepPerKW * itKW * idx * (inp.cooling === 'liquid' ? 1 + inp.liquidCoolingPremiumPct / 100 : 1);
  const utilityWorks = inp.utilityWorksPerKW * itKW * idx;
  const generation = inp.genCapexPerKW * generationMW * 1000 * idx;
  const contingency = (inp.contingencyPct / 100) * (shell + mep + utilityWorks + generation);
  const servers = rm.buysServers ? units * inp.unitCostUSD : 0;
  const network = servers * inp.networkPctOfServer / 100;
  const infraBudget = land + shell + mep + utilityWorks + generation + contingency;
  const serverBudget = servers + network;
  const overrunAmount = (st.capexOverrunPct / 100) * (shell + mep + utilityWorks + generation + contingency);

  // ── Timeline
  const plannedBuild = Math.max(inp.constructionMonths, inp.powerLeadTimeMonths);
  const plannedCod = plannedBuild;
  const cod = plannedBuild + st.codDelayMonths;
  const totalMonths = cod + inp.horizonYears * 12;

  // Capex schedule: infra linear over planned build; servers in last 3 months before actual COD.
  const infraPerMonth = (infraBudget + overrunAmount) / plannedBuild;
  const serverMonths = Math.min(3, cod);
  const serverPerMonth = serverBudget / serverMonths;
  const capexInfra = new Array<number>(totalMonths).fill(0);
  const capexServer = new Array<number>(totalMonths).fill(0);
  for (let m = 0; m < plannedBuild; m++) capexInfra[m] = infraPerMonth;
  for (let m = cod - serverMonths; m < cod; m++) capexServer[m] = serverPerMonth;
  // GPU refresh: re-buy the fleet at the end of each GPU life if ≥12 operating months remain
  const capexRefresh = new Array<number>(totalMonths).fill(0);
  const lifeM = Math.max(12, Math.round(inp.gpuDepreciationYears * 12));
  if (inp.gpuRefresh && rm.buysServers) {
    for (let t = lifeM; t + 12 <= inp.horizonYears * 12; t += lifeM) capexRefresh[cod + t] = serverBudget * inp.refreshCostPct / 100;
  }
  let refreshTotal = 0;

  // ── Debt tranches (sized on budget, not on overrun)
  const basisAmount = (b: string) => b === 'servers' ? serverBudget : b === 'infra' ? infraBudget : infraBudget + serverBudget;
  const tr = inp.tranches.map(t => {
    const commitment = basisAmount(t.basis) * t.ltcPct / 100;
    return { ...t, commitment, drawn: 0, balance: 0, r: t.ratePct / 100 / 12, pmt: 0, n: t.tenorYears * 12 };
  });
  const seniorRatePct = tr.length ? tr[0].ratePct : 7.5;
  const grace = Math.max(0, Math.min(inp.gracePeriodMonths, 60));

  // ── Depreciation bases (set at COD)
  let infraBook = 0, serverBook = 0;
  let nolL = 0, nolU = 0; // loss carry-forwards (levered / unlevered tax)

  const monthly: MonthRow[] = [];
  const unleveredCF: number[] = [];
  const leveredCF: number[] = [];
  const shortfalls: number[] = [];
  const cfadsSeries: number[] = [];
  let idcTotal = 0;
  let totalDebtAtCod = 0;

  const contractedShare = inp.contractedSharePct / 100;
  const blendedPrice0 = contractedShare * inp.contractedPricePerGpuHr + (1 - contractedShare) * inp.onDemandPricePerGpuHr;

  for (let m = 0; m < totalMonths; m++) {
    const inBuild = m < cod;
    const t = m - cod; // operating month index
    const phase: MonthRow['phase'] = inBuild ? 'construction' : (t < inp.rampMonths ? 'ramp' : 'operating');

    // ── Capex this month
    const capexM = capexInfra[m] + capexServer[m] + capexRefresh[m];
    refreshTotal += capexRefresh[m];

    // ── Debt draws (pro rata to the tranche's basis spend; overrun not funded by lenders)
    let debtDraw = 0;
    if (inBuild) {
      for (const k of tr) {
        const spend = k.basis === 'servers' ? capexServer[m]
          : k.basis === 'infra' ? capexInfra[m] * (infraBudget / (infraBudget + overrunAmount))
          : capexServer[m] + capexInfra[m] * (infraBudget / (infraBudget + overrunAmount));
        const share = basisAmount(k.basis) > 0 ? k.commitment / basisAmount(k.basis) : 0;
        const d = Math.min(k.commitment - k.drawn, spend * share);
        k.drawn += d; k.balance += d; debtDraw += d;
      }
    }

    // ── Interest
    let interest = 0, principal = 0, idcCapM = 0, idcCashM = 0;
    for (const k of tr) {
      if (inBuild) {
        const i = k.balance * k.r;
        // IDC capitalised only during the PLANNED build; delay months pay cash interest
        if (k.idcCapitalized && m < plannedCod) { k.balance += i; idcCapM += i; }
        else { idcCashM += i; }
        interest += i;
      } else {
        if (t === 0) totalDebtAtCod += k.balance;
        if (t === grace) k.pmt = annuity(k.balance, k.r, k.n - grace);
        if (t < k.n && k.balance > 1e-9) {
          const i = k.balance * k.r;
          const p = t < grace ? 0 : Math.min(k.balance, k.pmt - i);
          k.balance -= p; interest += i; principal += p;
        }
      }
    }
    idcTotal += idcCapM;

    // ── Operations
    let revenue = 0, energyCost = 0, opex = 0, ebitda = 0, taxL = 0, taxU = 0;
    if (!inBuild) {
      if (t === 0) { infraBook = infraBudget + overrunAmount + idcTotal; serverBook = serverBudget; }
      if (capexRefresh[m] > 0) serverBook += capexRefresh[m];
      const ramp = inp.rampMonths > 0 ? Math.min(1, (t + 1) / inp.rampMonths) : 1;
      const util = (inp.utilizationPct / 100) * ramp;
      const year = Math.floor(t / 12);
      // Realised price decays with FLEET AGE (resets on refresh); market shock applies by calendar year
      const fleetAgeYears = Math.floor((inp.gpuRefresh && rm.buysServers ? t % lifeM : t) / 12);
      const decline = Math.pow(1 - inp.priceDeclinePctPerYear / 100, fleetAgeYears);
      const shock = (opt.stress.applyPriceShock && year >= 1) ? 1 + st.priceShockPct / 100 : 1;
      const priceF = decline * shock * priceScale;

      if (inp.revenueModelId === 'neocloud') {
        revenue = gpus * HOURS_PER_MONTH * util * blendedPrice0 * priceF;
      } else if (inp.revenueModelId === 'inference') {
        const tokens = gpus * inp.tokensPerGPUPerSec * 3600 * HOURS_PER_MONTH * util;
        revenue = tokens / 1e6 * inp.tokenPricePerM * priceF;
      } else {
        revenue = itKW * inp.colocationPerKWMonth * (inp.colocationOccupancyPct / 100) * ramp * priceF;
      }
      // Off-taker non-payment window
      if (st.offtakerNonPayMonths > 0 && t >= st.offtakerNonPayStartMonth && t < st.offtakerNonPayStartMonth + st.offtakerNonPayMonths) {
        revenue = 0;
      }

      // Energy
      const loadFactor = inp.idleLoadPct / 100 + (1 - inp.idleLoadPct / 100) * util;
      const mwh = facilityMW * loadFactor * HOURS_PER_MONTH;
      const onGrid = !isBtm || (inp.bridgeMonthsToGrid > 0 && t >= inp.bridgeMonthsToGrid);
      let energy: number;
      if (onGrid) {
        energy = mwh * inp.tariffPerKWh * 1000 + facilityMW * inp.capacityChargePerMWDay * DAYS_PER_MONTH;
      } else {
        const fuelPerMWh = inp.heatRateBtuPerKWh / 1e6 * inp.gasPricePerMMBtu * 1000;
        energy = mwh * (fuelPerMWh + inp.genOandMPerMWh);
      }
      energyCost = rm.energyPassThrough ? 0 : energy;

      const labor = inp.fteDensityPerMW * itMW * inp.laborCostPerFTE / 12;
      const maintenance = (inp.maintenancePctOfCapex / 100) * (infraBudget + serverBudget) / 12;
      const insurance = (inp.insurancePctOfCapex / 100) * (infraBudget + serverBudget) / 12;
      const propertyTax = (inp.propertyTaxPctOfCapex / 100) * infraBudget / 12;
      const sga = (inp.sgaPctOfRevenue / 100) * revenue;
      opex = energyCost + labor + maintenance + insurance + propertyTax + sga;
      ebitda = revenue - opex;

      // Depreciation & tax (levered and unlevered books)
      const depInfra = Math.min(infraBook, (infraBudget + overrunAmount + idcTotal) / (inp.infraDepreciationYears * 12));
      const depServer = Math.min(serverBook, (serverBudget * (capexRefresh.slice(0, m + 1).some(v => v > 0) ? inp.refreshCostPct / 100 : 1)) / (inp.gpuDepreciationYears * 12));
      infraBook -= depInfra; serverBook -= depServer;
      const dep = depInfra + depServer;
      const tiL = ebitda - dep - interest;
      const tiU = ebitda - dep;
      const rate = inp.corporateTaxPct / 100;
      if (tiL < 0) nolL += -tiL; else { const use = Math.min(nolL, tiL); nolL -= use; taxL = (tiL - use) * rate; }
      if (tiU < 0) nolU += -tiU; else { const use = Math.min(nolU, tiU); nolU -= use; taxU = (tiU - use) * rate; }
    }

    const cfads = inBuild ? 0 : ebitda - taxL;
    const debtService = inBuild ? idcCashM : interest + principal;
    const debtBalance = tr.reduce((a, k) => a + k.balance, 0);
    const equityDraw = inBuild ? Math.max(0, capexM + idcCashM - debtDraw) : 0;

    const uCF = -capexM + ebitda - taxU;
    const lCF = inBuild ? -equityDraw : cfads - debtService;
    const shortfall = inBuild ? idcCashM : Math.max(0, debtService - cfads);

    monthly.push({
      m, phase, capex: capexM, revenue, energyCost, opex, ebitda, tax: taxL, cfads,
      interest: inBuild ? idcCashM : interest, principal, debtDraw, equityDraw, debtBalance,
      dscr: !inBuild && debtService > 0 ? cfads / debtService : null,
      unleveredCF: uCF, leveredCF: lCF,
    });
    unleveredCF.push(uCF); leveredCF.push(lCF); shortfalls.push(shortfall); cfadsSeries.push(cfads);
  }

  // ── Terminal value
  const last12 = monthly.slice(-12).reduce((a, r) => a + r.ebitda, 0);
  let terminalValue: number;
  if (inp.exitMethod === 'nbv') terminalValue = infraBook + serverBook;
  else if (inp.exitMethod === 'perMW') terminalValue = inp.exitPerMW * itMW;
  else terminalValue = Math.max(0, last12) * inp.exitEbitdaMultiple;
  const debtLeft = tr.reduce((a, k) => a + k.balance, 0);
  unleveredCF[unleveredCF.length - 1] += terminalValue;
  leveredCF[leveredCF.length - 1] += terminalValue - debtLeft;

  const capex: CapexBreakdown = {
    land, shell, mep, utilityWorks, generation, servers, network, contingency, idc: idcTotal, refresh: refreshTotal,
    total: infraBudget + serverBudget + idcTotal + overrunAmount,
  };

  return {
    monthly, capex, codMonth: cod, plannedCod, totalDebtAtCod, overrunAmount, unleveredCF, leveredCF,
    terminalValue, shortfalls, seniorRatePct, cfadsSeries, gpus, units, facilityMW, generationMW,
    trancheDraws: tr.map(k => ({ label: k.label, drawn: k.drawn })),
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

export function runBusinessCase(inp: BusinessCaseInputs): BusinessCaseOutputs {
  const base = simulate(inp, { stress: {} });
  const { monthly, capex } = base;

  // Sources & uses
  const totalDebt = base.totalDebtAtCod;
  const totalEquity = monthly.reduce((a, r) => a + r.equityDraw, 0);
  const sourcesUses: SourcesUses = {
    uses: capex,
    sources: [
      ...base.trancheDraws.map(t => ({ label: t.label, amount: t.drawn, pct: 0 })),
      { label: 'Sponsor equity', amount: totalEquity, pct: 0 },
    ],
    totalDebt, totalEquity,
  };
  const srcTotal = sourcesUses.sources.reduce((a, s) => a + s.amount, 0);
  sourcesUses.sources.forEach(s => { s.pct = srcTotal > 0 ? s.amount / srcTotal * 100 : 0; });

  // Annual roll-up (years from financial close)
  const annual: YearRow[] = [];
  const nYears = Math.ceil(monthly.length / 12);
  for (let y = 0; y < nYears; y++) {
    const rows = monthly.slice(y * 12, y * 12 + 12);
    const sum = (f: (r: MonthRow) => number) => rows.reduce((a, r) => a + f(r), 0);
    const ds = sum(r => r.interest + r.principal);
    const cfads = sum(r => r.cfads);
    const revenue = sum(r => r.revenue);
    const opYear = rows.some(r => r.phase !== 'construction');
    annual.push({
      year: y + 1, revenue, energyCost: sum(r => r.energyCost), opex: sum(r => r.opex), ebitda: sum(r => r.ebitda),
      ebitdaMarginPct: revenue > 0 ? sum(r => r.ebitda) / revenue * 100 : 0,
      capex: sum(r => r.capex), tax: sum(r => r.tax), debtService: ds,
      dscr: opYear && ds > 0 ? cfads / ds : null,
      unleveredCF: sum(r => r.unleveredCF), leveredCF: sum(r => r.leveredCF),
      debtBalance: rows[rows.length - 1].debtBalance,
    });
  }

  const dscrs = monthly.map(r => r.dscr).filter((d): d is number => d !== null);
  const minDSCR = dscrs.length ? Math.min(...dscrs) : null;
  const avgDSCR = dscrs.length ? dscrs.reduce((a, b) => a + b, 0) / dscrs.length : null;

  let cum = 0, paybackMonth: number | null = null;
  for (let i = 0; i < base.leveredCF.length; i++) {
    cum += base.leveredCF[i];
    if (cum > 0 && i >= base.codMonth) { paybackMonth = i; break; }
  }

  const opRows = monthly.filter(r => r.phase !== 'construction');
  const y1 = opRows.slice(0, 12);
  const year1Revenue = y1.reduce((a, r) => a + r.revenue, 0);
  const year1EBITDA = y1.reduce((a, r) => a + r.ebitda, 0);
  const ss = opRows.slice(inp.rampMonths, inp.rampMonths + 12);
  const steadyStateEBITDA = ss.reduce((a, r) => a + r.ebitda, 0);

  const soldGpuHrsPerYear = base.gpus * 8760 * inp.utilizationPct / 100;
  const ssEnergy = ss.reduce((a, r) => a + r.energyCost, 0);
  const ssOpex = ss.reduce((a, r) => a + r.opex, 0);
  const ssInterest = ss.reduce((a, r) => a + r.interest, 0);
  const annualDep = (capex.servers + capex.network) / inp.gpuDepreciationYears + (capex.total - capex.servers - capex.network) / inp.infraDepreciationYears;
  const energyCostPerGpuHr = soldGpuHrsPerYear > 0 ? ssEnergy / soldGpuHrsPerYear : 0;
  const allInCostPerGpuHr = soldGpuHrsPerYear > 0 ? (ssOpex + ssInterest + annualDep) / soldGpuHrsPerYear : 0;

  // Breakeven price: scale factor k s.t. unlevered NPV = 0
  let breakevenPricePerGpuHr: number | null = null;
  let equivalentTokenPricePerM: number | null = null;
  {
    const f = (k: number) => npv(simulate(inp, { stress: {}, priceScale: k }).unleveredCF, inp.discountRatePct);
    let lo = 0.01, hi = 10;
    if (f(lo) < 0 && f(hi) > 0) {
      for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; }
      const k = (lo + hi) / 2;
      const blended = inp.contractedSharePct / 100 * inp.contractedPricePerGpuHr + (1 - inp.contractedSharePct / 100) * inp.onDemandPricePerGpuHr;
      if (inp.revenueModelId === 'neocloud') {
        breakevenPricePerGpuHr = k * blended;
        equivalentTokenPricePerM = inp.tokensPerGPUPerSec > 0 ? breakevenPricePerGpuHr / (inp.tokensPerGPUPerSec * 3600 / 1e6) : null;
      } else if (inp.revenueModelId === 'inference') {
        equivalentTokenPricePerM = k * inp.tokenPricePerM;
        breakevenPricePerGpuHr = equivalentTokenPricePerM * inp.tokensPerGPUPerSec * 3600 / 1e6;
      } else {
        breakevenPricePerGpuHr = k * inp.colocationPerKWMonth; // $/kW-month in colocation mode
      }
    }
  }

  // Debt capacity at 1.30× DSCR over the senior tenor, discounted at senior rate
  const seniorTenorMonths = (inp.tranches[0]?.tenorYears ?? 7) * 12;
  const rS = base.seniorRatePct / 100 / 12;
  let debtCapacityAt130 = 0;
  for (let t = 0; t < seniorTenorMonths && base.codMonth + t < base.cfadsSeries.length; t++) {
    debtCapacityAt130 += Math.max(0, base.cfadsSeries[base.codMonth + t]) / 1.3 / Math.pow(1 + rS, t + 1);
  }

  // Stress cases and credit support coverage
  const stresses = runStresses(inp, base);

  return {
    gpus: base.gpus, units: base.units, facilityMW: base.facilityMW, generationMW: base.generationMW, codMonth: base.codMonth,
    capex, sourcesUses, monthly, annual,
    projectIRRPct: irr(base.unleveredCF), equityIRRPct: irr(base.leveredCF),
    npv: npv(base.unleveredCF, inp.discountRatePct),
    minDSCR, avgDSCR, paybackMonth, year1Revenue, year1EBITDA, steadyStateEBITDA,
    capexPerMW: capex.total / inp.itCapacityMW, capexPerGPU: base.gpus > 0 ? capex.total / base.gpus : 0,
    energyCostPerGpuHr, allInCostPerGpuHr, breakevenPricePerGpuHr, equivalentTokenPricePerM,
    terminalValue: base.terminalValue, debtCapacityAt130, stresses,
  };
}

// ─── Stress + credit support ─────────────────────────────────────────────────

function runStresses(inp: BusinessCaseInputs, base: SimResult): StressResult[] {
  const s = inp.stress;
  const cs = inp.creditSupport;
  const cases: { id: string; label: string; trigger: StressResult['trigger']; stress: SimOptions['stress'] }[] = [
    { id: 'base', label: 'Base case', trigger: 'none', stress: {} },
    { id: 'power-delay', label: `Power / COD delay +${s.codDelayMonths} mo`, trigger: 'powerDelay', stress: { codDelayMonths: s.codDelayMonths } },
    { id: 'overrun', label: `Capex overrun +${s.capexOverrunPct}%`, trigger: 'costOverrun', stress: { capexOverrunPct: s.capexOverrunPct } },
    { id: 'offtaker', label: `Off-taker non-payment ${s.offtakerNonPayMonths} mo`, trigger: 'offtakerDefault', stress: { offtakerNonPayStartMonth: s.offtakerNonPayStartMonth, offtakerNonPayMonths: s.offtakerNonPayMonths } },
    { id: 'price', label: `Price shock ${s.priceShockPct}% from yr 2`, trigger: 'priceShock', stress: { priceShockPct: s.priceShockPct, applyPriceShock: true } },
    { id: 'combined', label: 'Combined (all four)', trigger: 'combined', stress: { ...s, applyPriceShock: true } },
  ];

  const totalDebt = base.totalDebtAtCod;
  const cap = totalDebt * cs.amountPctOfDebt / 100;

  return cases.map(c => {
    const r = c.id === 'base' ? base : simulate(inp, { stress: c.stress });
    const dscrs = r.monthly.map(x => x.dscr).filter((d): d is number => d !== null);
    const minDSCR = dscrs.length ? Math.min(...dscrs) : null;

    // Shortfall episodes: cash interest during delay months + any post-COD debt-service gap.
    // Cost overrun is itself a funding shortfall (lenders size on budget).
    const supportEnd = r.plannedCod + cs.durationMonthsPostCOD;
    const covers = c.trigger === 'none' ? false
      : c.trigger === 'powerDelay' ? cs.coversPowerDelay
      : c.trigger === 'costOverrun' ? cs.coversCostOverrun
      : c.trigger === 'offtakerDefault' ? cs.coversOfftakerDefault
      : c.trigger === 'priceShock' ? false
      : (cs.coversPowerDelay || cs.coversCostOverrun || cs.coversOfftakerDefault);

    let total = 0, months = 0, beyond = 0, inWindow = 0, lagExposure = 0;
    let episodeStart = -1;
    r.shortfalls.forEach((v, m) => {
      if (v > 1e-6) {
        total += v; months++;
        if (episodeStart < 0) episodeStart = m;
        if (m <= supportEnd) inWindow += v; else beyond++;
        if (!cs.directDraw && m - episodeStart < cs.recoveryLagMonths) lagExposure += v;
      } else episodeStart = -1;
    });
    if (c.trigger === 'costOverrun' || c.trigger === 'combined') { total += r.overrunAmount; inWindow += r.overrunAmount; }

    // For a combined case, only the covered triggers' share is paid — approximate by
    // paying the overrun if covered and the service gap if either delay or default is covered.
    let eligible = inWindow;
    if (c.trigger === 'combined') {
      eligible = (cs.coversCostOverrun ? r.overrunAmount : 0) + ((cs.coversPowerDelay || cs.coversOfftakerDefault) ? inWindow - r.overrunAmount : 0);
    }
    const supportCapped = covers ? Math.min(cap, eligible) : 0;

    return {
      id: c.id, label: c.label, trigger: c.trigger,
      equityIRRPct: irr(r.leveredCF), projectIRRPct: irr(r.unleveredCF), minDSCR,
      shortfallTotal: total, shortfallMonths: months, shortfallBeyondSupportMonths: covers ? beyond : months,
      supportCovers: covers, supportCapped, uncovered: total - supportCapped,
      lagExposure: covers ? lagExposure : 0,
    };
  });
}
