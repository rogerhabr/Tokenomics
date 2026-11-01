// Deterministic business-plan generator. Same inputs → byte-identical Markdown.
// No LLM involved: every sentence is a template over engine outputs so that
// each number in the plan is traceable to an input or a formula.

import type { BusinessCaseInputs, BusinessCaseOutputs } from './types.ts';
import { GEOGRAPHIES, CHIPS, POWER_SOURCES, REVENUE_MODELS, CAPITAL_STACKS, CREDIT_SUPPORTS, byId } from './presets.ts';

const usd = (n: number): string => {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : a >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n.toFixed(0)}`;
  return s;
};
const pct = (n: number | null, d = 1): string => n === null ? 'n/a' : `${n.toFixed(d)}%`;
const x = (n: number | null): string => n === null ? 'n/a' : `${n.toFixed(2)}×`;
const num = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

export function generateBusinessPlan(inp: BusinessCaseInputs, out: BusinessCaseOutputs, generatedOn = '2026-11-01'): string {
  const geo = byId(GEOGRAPHIES, inp.geographyId);
  const chip = byId(CHIPS, inp.chipId);
  const pwr = byId(POWER_SOURCES, inp.powerSourceId);
  const rm = byId(REVENUE_MODELS, inp.revenueModelId);
  const stack = byId(CAPITAL_STACKS, inp.capitalStackId);
  const cs = byId(CREDIT_SUPPORTS, inp.creditSupportId);
  const c = inp.creditSupport;
  const blended = inp.contractedSharePct / 100 * inp.contractedPricePerGpuHr + (1 - inp.contractedSharePct / 100) * inp.onDemandPricePerGpuHr;
  const debtPct = out.sourcesUses.totalDebt + out.sourcesUses.totalEquity > 0
    ? out.sourcesUses.totalDebt / (out.sourcesUses.totalDebt + out.sourcesUses.totalEquity) * 100 : 0;
  const base = out.stresses.find(s => s.id === 'base');
  const worst = [...out.stresses].filter(s => s.id !== 'base').sort((a, b) => (a.minDSCR ?? 99) - (b.minDSCR ?? 99))[0];
  const opYears = out.annual.filter(a => a.revenue > 0);

  const revenueLine = inp.revenueModelId === 'neocloud'
    ? `GPU-hour rental at a blended $${blended.toFixed(2)}/GPU-hr (${inp.contractedSharePct}% contracted at $${inp.contractedPricePerGpuHr.toFixed(2)}, balance on-demand at $${inp.onDemandPricePerGpuHr.toFixed(2)}), ${inp.utilizationPct}% sold utilisation, realised price decaying ${inp.priceDeclinePctPerYear}%/yr with fleet age`
    : inp.revenueModelId === 'inference'
    ? `token sales at $${inp.tokenPricePerM.toFixed(2)}/M tokens blended, ${num(inp.tokensPerGPUPerSec)} tok/s per GPU, ${inp.utilizationPct}% utilisation, price decaying ${inp.priceDeclinePctPerYear}%/yr with fleet age`
    : `colocation at $${inp.colocationPerKWMonth}/kW-month on ${num(inp.itCapacityMW * 1000)} kW of IT capacity, ${inp.colocationOccupancyPct}% occupancy, ${-inp.priceDeclinePctPerYear}%/yr escalator; tenant supplies GPUs and pays energy`;

  const powerLine = pwr.kind === 'grid'
    ? `utility interconnect (${geo.gridInterconnectMonths} months per preset; ${inp.powerLeadTimeMonths} used) at $${inp.tariffPerKWh.toFixed(3)}/kWh${inp.capacityChargePerMWDay > 0 ? ` plus $${inp.capacityChargePerMWDay.toFixed(2)}/MW-day capacity` : ''}`
    : `${pwr.label} sized at ${out.generationMW.toFixed(1)} MW nameplate (${inp.redundancyFactor.toFixed(2)}× facility peak), ${num(inp.genCapexPerKW)} $/kW installed, ${num(inp.heatRateBtuPerKWh)} Btu/kWh at $${inp.gasPricePerMMBtu.toFixed(2)}/MMBtu, ${inp.powerLeadTimeMonths}-month lead time${pwr.kind === 'bridge' ? `, switching to grid at $${inp.tariffPerKWh.toFixed(3)}/kWh after ${inp.bridgeMonthsToGrid} operating months` : ''}`;

  const q = (ok: boolean) => ok ? 'Yes' : 'No';

  const stressTable = out.stresses.map(s =>
    `| ${s.label} | ${pct(s.equityIRRPct)} | ${x(s.minDSCR)} | ${usd(s.shortfallTotal)} | ${s.supportCovers ? usd(s.supportCapped) : '— (not covered)'} | ${usd(s.uncovered)} | ${usd(s.lagExposure)} |`
  ).join('\n');

  const annualTable = out.annual.map(a =>
    `| ${a.year} | ${usd(a.revenue)} | ${usd(a.ebitda)} | ${a.revenue > 0 ? pct(a.ebitdaMarginPct, 0) : '—'} | ${usd(a.capex)} | ${usd(a.debtService)} | ${a.dscr === null ? '—' : x(a.dscr)} | ${usd(a.leveredCF)} |`
  ).join('\n');

  const capexRows: [string, number][] = [
    ['Land', out.capex.land], ['Shell', out.capex.shell], ['MEP (electrical + mechanical)', out.capex.mep],
    ['Utility / interconnect works', out.capex.utilityWorks], ['On-site generation', out.capex.generation],
    ['Servers (GPUs)', out.capex.servers], ['Network fabric + storage', out.capex.network],
    ['Contingency', out.capex.contingency], ['Capitalised interest (IDC)', out.capex.idc],
  ];

  return `# ${inp.name} — Business Plan
*Generated ${generatedOn} by the AI Tokenomics Business Case Agent. Deterministic: identical inputs reproduce this document.*

## 1. Executive summary

**${inp.name}** is a ${inp.itCapacityMW} MW (IT) AI data center in **${geo.label}** deploying **${num(out.units)} × ${chip.label}** (${num(out.gpus)} GPUs, ${inp.cooling}-cooled, PUE ${inp.pue.toFixed(2)}, ${out.facilityMW.toFixed(1)} MW at the meter). Power is ${pwr.kind === 'grid' ? 'grid-supplied' : 'generated behind the meter'}; revenue is **${rm.label}**.

| Headline | Value |
|---|---|
| Total initial capex (incl. IDC) | ${usd(out.capex.total)} (${usd(out.capexPerMW)}/MW IT, ${usd(out.capexPerGPU)}/GPU) |
| Capital structure | ${stack.label} — ${pct(debtPct, 0)} debt / ${pct(100 - debtPct, 0)} equity |
| Sponsor equity required | ${usd(out.sourcesUses.totalEquity)} |
| Financial close → COD | ${out.codMonth} months |
| Year-1 revenue / EBITDA | ${usd(out.year1Revenue)} / ${usd(out.year1EBITDA)} |
| Steady-state EBITDA | ${usd(out.steadyStateEBITDA)} |
| Project IRR (unlevered, ${inp.horizonYears}-yr, ${inp.exitMethod} exit) | ${pct(out.projectIRRPct)} |
| Equity IRR (levered) | ${pct(out.equityIRRPct)} vs ${inp.targetEquityIRRPct}% target |
| NPV @ ${inp.discountRatePct}% | ${usd(out.npv)} |
| Min / avg DSCR | ${x(out.minDSCR)} / ${x(out.avgDSCR)} |
| Equity payback | ${out.paybackMonth === null ? 'not within horizon' : `month ${out.paybackMonth} (${out.paybackMonth - out.codMonth} months after COD)`} |
| Breakeven price (NPV = 0) | ${out.breakevenPricePerGpuHr === null ? 'n/a' : inp.revenueModelId === 'colocation' ? `$${out.breakevenPricePerGpuHr.toFixed(0)}/kW-month` : `$${out.breakevenPricePerGpuHr.toFixed(2)}/GPU-hr${out.equivalentTokenPricePerM !== null ? ` ≈ $${out.equivalentTokenPricePerM.toFixed(2)}/M tokens` : ''}`} |

**The ask.** ${usd(out.sourcesUses.totalDebt)} of debt across ${inp.tranches.length} tranche${inp.tranches.length === 1 ? '' : 's'} and ${usd(out.sourcesUses.totalEquity)} of sponsor equity, with ${cs.label.toLowerCase()} as credit support. Debt capacity at a 1.30× DSCR over the senior tenor is ${usd(out.debtCapacityAt130)}, ${out.debtCapacityAt130 >= out.sourcesUses.totalDebt ? 'above' : '**below**'} the proposed ${usd(out.sourcesUses.totalDebt)}.

## 2. Market and revenue model

${rm.description}

Revenue assumption: ${revenueLine}. Ramp to full utilisation over ${inp.rampMonths} months after COD.${inp.gpuRefresh && rm.buysServers ? ` The fleet is refreshed every ${inp.gpuDepreciationYears} years at ${inp.refreshCostPct}% of original server capex, resetting realised pricing to new-generation levels.` : ''}

Market context from Origin Partners (May 2026): hyperscalers need capacity energised in ~18 months while major-market grid interconnects run 4–7 years; firm behind-the-meter PPAs are being signed at 15–25-year tenors with 97–99% availability; equipment that can actually be delivered trades 25–60% over OEM list. GPU effective useful life is 18–36 months in production, which is why realised $/GPU-hr decays with fleet age in this model.

## 3. Site and power

Location: **${geo.label}** (${geo.region}; ${geo.currencyNote}). Powered land at ${usd(inp.landPerMW)}/MW IT. Construction cost index ${inp.constructionCostIndex.toFixed(2)} vs ERCOT. Corporate tax ${inp.corporateTaxPct}%, property tax ${inp.propertyTaxPctOfCapex}% of infrastructure capex per year. Labour ${usd(inp.laborCostPerFTE)}/FTE at ${inp.fteDensityPerMW} FTE/MW.

Power: ${powerLine}. Energy cost works out to **$${out.energyCostPerGpuHr.toFixed(3)} per sold GPU-hour** against an all-in cost (opex + depreciation + interest) of **$${out.allInCostPerGpuHr.toFixed(2)}**.

Preset provenance: ${geo.sourceNote} (checked ${geo.asOf}). Power: ${pwr.sourceNote}

## 4. Technology

${chip.label}: ${inp.gpusPerUnit} GPUs per unit at ${inp.unitKW} kW and ${usd(inp.unitCostUSD)} per unit; ${num(inp.tokensPerGPUPerSec)} tok/s per GPU (static matrix, order-of-magnitude). ${num(out.units)} units fill ${inp.itCapacityMW} MW of IT load. Network fabric and storage add ${inp.networkPctOfServer}% to server capex. GPUs are depreciated over ${inp.gpuDepreciationYears} years; facility over ${inp.infraDepreciationYears}.

Provenance: ${chip.sourceNote}

## 5. Capital expenditure and schedule

| Item | Amount | Share |
|---|---|---|
${capexRows.map(([k, v]) => `| ${k} | ${usd(v)} | ${pct(out.capex.total > 0 ? v / out.capex.total * 100 : 0, 1)} |`).join('\n')}
| **Total** | **${usd(out.capex.total)}** | 100% |
${out.capex.refresh > 0 ? `| GPU refresh over horizon (funded from cash flow) | ${usd(out.capex.refresh)} | — |` : ''}

Shell ${usd(inp.shellPerKW)}/kW and MEP ${usd(inp.mepPerKW)}/kW${inp.cooling === 'liquid' ? ` (+${inp.liquidCoolingPremiumPct}% liquid-cooling premium)` : ''} of IT, ${inp.contingencyPct}% contingency on construction. Infrastructure is drawn linearly over ${Math.max(inp.constructionMonths, inp.powerLeadTimeMonths)} months (construction ${inp.constructionMonths}, power ${inp.powerLeadTimeMonths}); servers are purchased in the last quarter before COD at month ${out.codMonth}.

## 6. Operating model

| Year | Revenue | EBITDA | Margin | Capex | Debt service | DSCR | Levered CF |
|---|---|---|---|---|---|---|---|
${annualTable}

Opex lines: energy${rm.energyPassThrough ? ' (passed through to tenant)' : ''}, labour, maintenance ${inp.maintenancePctOfCapex}% of capex, insurance ${inp.insurancePctOfCapex}% of capex, property tax, SG&A ${inp.sgaPctOfRevenue}% of revenue. Steady-state EBITDA margin ${opYears.length > 1 ? pct(opYears[1].ebitdaMarginPct, 0) : pct(opYears[0]?.ebitdaMarginPct ?? 0, 0)}.

## 7. Capital structure

${stack.description} (${stack.sourceNote})

| Tranche | Basis | LTC | Rate | Tenor | IDC |
|---|---|---|---|---|---|
${inp.tranches.length ? inp.tranches.map(t => `| ${t.label} | ${t.basis} | ${t.ltcPct}% | ${t.ratePct}% | ${t.tenorYears} yr | ${t.idcCapitalized ? 'capitalised' : 'cash'} |`).join('\n') : '| — all equity — | | | | | |'}

Sources and uses at COD:

| Source | Amount | Share |
|---|---|---|
${out.sourcesUses.sources.map(s => `| ${s.label} | ${usd(s.amount)} | ${pct(s.pct, 1)} |`).join('\n')}

Debt amortises as a level annuity from COD after a ${inp.gracePeriodMonths}-month interest-only grace period. Capitalised interest during the planned build is ${usd(out.capex.idc)}; interest during any delay is paid in cash. Minimum DSCR ${x(out.minDSCR)}${base && base.shortfallTotal > 0 ? ` — the base case needs a ${usd(base.shortfallTotal)} debt-service reserve to cover ${base.shortfallMonths} ramp month${base.shortfallMonths === 1 ? '' : 's'}` : ''}. Exit at ${inp.exitMethod === 'nbv' ? 'net book value' : inp.exitMethod === 'perMW' ? `${usd(inp.exitPerMW)}/MW (Origin Partners powered-shell range $8–15M/MW)` : `${inp.exitEbitdaMultiple}× trailing EBITDA`}: ${usd(out.terminalValue)}.

## 8. Credit support — the lender's four questions

> "A lender still has to ask: who takes the loss if the project is late or the cash flow does not arrive as planned?" — Origin Partners, on NVIDIA's proposed credit support for the Nscale / Anthropic facility.

Structure: **${cs.label}**. ${cs.description}

| Question | Answer in this structure |
|---|---|
| **Trigger** — does support apply if power is delayed / construction overruns / the customer fails to pay? | Power delay: ${q(c.coversPowerDelay)} · Cost overrun: ${q(c.coversCostOverrun)} · Off-taker default: ${q(c.coversOfftakerDefault)} |
| **Amount** — enough through the period of greatest risk? | Cap ${c.amountPctOfDebt}% of debt = ${usd(out.sourcesUses.totalDebt * c.amountPctOfDebt / 100)}; largest modelled shortfall ${worst ? usd(Math.max(...out.stresses.map(s => s.shortfallTotal))) : 'n/a'} |
| **Duration** — in place until the facility is operating and collecting? | Expires ${c.durationMonthsPostCOD} months after planned COD (ramp is ${inp.rampMonths} months; senior tenor ${inp.tranches[0]?.tenorYears ?? 0} years) |
| **Claim** — can the lender draw directly? | ${c.directDraw ? 'Direct draw' : `Must pursue the project company first — ${c.recoveryLagMonths}-month recovery lag`} |

Stress results (shortfall = debt service not covered by cash flow, plus any construction overrun):

| Case | Equity IRR | Min DSCR | Shortfall | Support pays | Sponsor cure | Exposed to claim lag |
|---|---|---|---|---|---|---|
${stressTable}

${worst ? `Weakest case: **${worst.label}** at ${x(worst.minDSCR)} minimum DSCR, ${usd(worst.uncovered)} uncovered.` : ''} ${cs.sourceNote}

## 9. Key risks and mitigants

- **Power timing** — ${pwr.kind === 'grid' ? `grid interconnect of ${inp.powerLeadTimeMonths} months is the critical path; a ${inp.stress.codDelayMonths}-month slip costs ${usd(out.stresses.find(s => s.id === 'power-delay')?.shortfallTotal ?? 0)} of cash interest and delays revenue.` : `behind-the-meter generation (${inp.powerLeadTimeMonths}-month lead) de-risks the interconnect queue; gas price is the residual exposure (a $1/MMBtu move is ≈ ${usd(out.facilityMW * 0.87 * 8760 * inp.heatRateBtuPerKWh / 1e3)} per year at this load).`}
- **Price erosion** — realised $/GPU-hr decays ${inp.priceDeclinePctPerYear}%/yr with fleet age; a further ${inp.stress.priceShockPct}% market shock from year 2 takes equity IRR to ${pct(out.stresses.find(s => s.id === 'price')?.equityIRRPct ?? null)}.
- **Off-taker credit** — ${inp.contractedSharePct}% of capacity is contracted; a ${inp.stress.offtakerNonPayMonths}-month payment failure creates a ${usd(out.stresses.find(s => s.id === 'offtaker')?.shortfallTotal ?? 0)} gap, ${c.coversOfftakerDefault ? 'covered up to the support cap' : 'not covered by the current support'}.
- **Capex overrun** — ${inp.stress.capexOverrunPct}% overrun (${usd(out.stresses.find(s => s.id === 'overrun')?.shortfallTotal ?? 0)}) is equity-funded unless completion support applies (${q(c.coversCostOverrun)}).
- **Technology obsolescence** — ${inp.gpuDepreciationYears}-year GPU life with ${inp.gpuRefresh ? 'refresh capex funded from cash flow' : 'no refresh: revenue decays to the end of the horizon'}.

## 10. Assumptions register

| Assumption | Value | Source class |
|---|---|---|
| Geography preset | ${geo.label} | estimate — ${geo.sourceNote} |
| Chip preset | ${chip.label} | estimate — ${chip.sourceNote} |
| Power preset | ${pwr.label} | estimate — ${pwr.sourceNote} |
| Capital stack | ${stack.label} | estimate — ${stack.sourceNote} |
| Credit support | ${cs.label} | estimate — ${cs.sourceNote} |
| Engine | monthly project-finance model | derived — cross-checked against independent Python reference |

*Origin Partners is a deal-origination and advisory firm; it is not a registered broker-dealer, investment adviser or fiduciary, and its published figures are planning ranges. This document is a model output, not investment advice.*
`;
}
