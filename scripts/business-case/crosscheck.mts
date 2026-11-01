// Cross-check the TS business-case engine against the independent Python
// reference on several preset combinations.  Run:  node scripts/business-case/crosscheck.mts
import { execFileSync } from 'node:child_process';
import { buildInputs, runBusinessCase, type BusinessCaseInputs } from '../../src/lib/businessCase/index.ts';

const CASES: Array<Partial<Parameters<typeof buildInputs>[0]> & { label: string; patch?: (i: BusinessCaseInputs) => void }> = [
  { label: 'default (ERCOT · GB200 · BTM recip · neocloud · senior+mezz)' },
  { label: 'PJM grid · HGX H100 · all-equity · inference', geographyId: 'us-pjm', chipId: 'hgx-h100', powerSourceId: 'grid', revenueModelId: 'inference', capitalStackId: 'all-equity' },
  { label: 'Dubai bridge · B200 · colocation · senior', geographyId: 'uae-dubai', chipId: 'hgx-b200', powerSourceId: 'bridge-recip', revenueModelId: 'colocation', capitalStackId: 'senior-only' },
  { label: 'Kuwait grid · GB300 · GPU financing · perMW exit', geographyId: 'kuwait', chipId: 'gb300-nvl72', powerSourceId: 'grid', capitalStackId: 'gpu-financing', patch: i => { i.exitMethod = 'perMW'; } },
  { label: 'Germany · VR200 · aero CC · ebitda multiple exit, no refresh', geographyId: 'germany', chipId: 'vr200-nvl72', powerSourceId: 'btm-aero-cc', patch: i => { i.exitMethod = 'ebitdaMultiple'; i.gpuRefresh = false; i.horizonYears = 12; } },
];

let failures = 0;
for (const c of CASES) {
  const { label, patch, ...sel } = c;
  const inp = buildInputs(sel);
  patch?.(inp);
  const ts = runBusinessCase(inp);
  const py = JSON.parse(execFileSync('python3', ['scripts/business-case/reference_model.py'], { input: JSON.stringify(inp) }).toString());
  const blended = inp.contractedSharePct / 100 * inp.contractedPricePerGpuHr + (1 - inp.contractedSharePct / 100) * inp.onDemandPricePerGpuHr;
  const tsBreakevenScale = ts.breakevenPricePerGpuHr === null ? null
    : inp.revenueModelId === 'neocloud' ? ts.breakevenPricePerGpuHr / blended
    : inp.revenueModelId === 'inference' ? (ts.equivalentTokenPricePerM ?? 0) / inp.tokenPricePerM
    : ts.breakevenPricePerGpuHr / inp.colocationPerKWMonth;
  const pairs: [string, number | null, number | null][] = [
    ['gpus', ts.gpus, py.gpus], ['codMonth', ts.codMonth, py.codMonth],
    ['capexTotal', ts.capex.total, py.capexTotal], ['totalDebt', ts.sourcesUses.totalDebt, py.totalDebt],
    ['totalEquity', ts.sourcesUses.totalEquity, py.totalEquity],
    ['projectIRR', ts.projectIRRPct, py.projectIRRPct], ['equityIRR', ts.equityIRRPct, py.equityIRRPct],
    ['npv', ts.npv, py.npv], ['minDSCR', ts.minDSCR, py.minDSCR],
    ['year1Revenue', ts.year1Revenue, py.year1Revenue], ['steadyStateEBITDA', ts.steadyStateEBITDA, py.steadyStateEBITDA],
    ['terminalValue', ts.terminalValue, py.terminalValue], ['breakevenScale', tsBreakevenScale, py.breakevenScale],
  ];
  console.log(`\n== ${label}`);
  for (const [k, a, b] of pairs) {
    const ok = (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b)));
    if (!ok) failures++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${k.padEnd(18)} ts=${a === null ? 'null' : a.toPrecision(10)}  py=${b === null ? 'null' : Number(b).toPrecision(10)}`);
  }
}
console.log(failures ? `\n${failures} mismatches` : '\nAll cases match to 1e-6 relative.');
process.exit(failures ? 1 : 0);
