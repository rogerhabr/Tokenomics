/**
 * Cross-language parity test: TypeScript engine (src/lib/aiFactory.ts) vs the
 * verified Python model, via tests/fixtures/ai-factory-parity.json.
 *
 * Usage:  npm run test:model
 * (compiles the engine with tsc into .parity-tmp/, replays every fixture
 *  scenario, and requires agreement to 1e-9 relative tolerance)
 */
import { execSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

execSync(
  'npx tsc src/lib/aiFactory.ts --outDir .parity-tmp --module es2020 ' +
  '--target es2020 --moduleResolution node --skipLibCheck',
  { stdio: 'inherit' },
);
const { computeModel, DEFAULT_INPUTS } = await import(
  new URL('../.parity-tmp/aiFactory.js', import.meta.url).href
);

const fixtures = JSON.parse(
  readFileSync('tests/fixtures/ai-factory-parity.json', 'utf8'),
);

// fixture key (python) -> TS result field
const MAP = {
  it_kw: 'itKw', liquid_kw: 'liquidKw', flow_per_rack: 'flowPerRack',
  flow_lpm: 'flowTotal', mlc: 'mlc', mlc_margin: 'mlcMargin',
  energy_mwh: 'energyMwh', water_m3: 'waterM3', co2_t: 'co2T',
  capex: 'capex', equity: 'equity', ds: 'ds',
  equity_irr: 'equityIrr', project_irr: 'projectIrr', npv: 'npv',
  moic: 'moic', min_dscr: 'minDscr', avg_dscr: 'avgDscr',
  capex_gpu: 'capexPerGpu', rev_gpu_hr: 'revPerGpuHr',
  cost_mtok: 'costPerMTok', energy_pct: 'energyPctRev',
  breakeven_tariff: 'breakevenTariff',
};

let checks = 0, failures = 0;
const close = (a, b, tol = 1e-9) =>
  Math.abs(a - b) / Math.max(Math.abs(b), 1e-9) <= tol;
const chk = (label, ok, detail = '') => {
  checks++;
  if (!ok) { failures++; console.log(`FAIL ${label} ${detail}`); }
};

for (const [name, { ts_overrides, expected }] of Object.entries(fixtures)) {
  const r = computeModel({ ...DEFAULT_INPUTS, ...ts_overrides });
  for (const [pk, tk] of Object.entries(MAP)) {
    chk(`${name}.${pk}`, close(r[tk], expected[pk]),
        `ts=${r[tk]} py=${expected[pk]}`);
  }
  chk(`${name}.payback`,
      expected.payback === null ? r.payback === null
                                : close(r.payback, expected.payback, 1e-6),
      `ts=${r.payback} py=${expected.payback}`);
  ['rev', 'ebitda', 'fcfe'].forEach((k) =>
    expected[k].forEach((v, i) =>
      chk(`${name}.${k}[${i}]`, close(r[k][i], v), `ts=${r[k][i]} py=${v}`)));
  expected.engine_irr.forEach((v, i) =>
    chk(`${name}.engine_irr[${i}]`, close(r.sensitivity[i].irr, v, 1e-6),
        `ts=${r.sensitivity[i].irr} py=${v}`));
  chk(`${name}.exp_peak_funding`,
      close(r.expansion.peakFunding, expected.exp_peak_funding));
  chk(`${name}.exp_final_mw`,
      close(r.expansion.finalMW, expected.exp_final_mw));
  chk(`${name}.exp_cash_positive`,
      r.expansion.cashPositiveYear === expected.exp_cash_positive,
      `ts=${r.expansion.cashPositiveYear} py=${expected.exp_cash_positive}`);
}

rmSync('.parity-tmp', { recursive: true, force: true });
console.log(`${checks - failures}/${checks} parity checks passed`
  + (failures ? ` — ${failures} FAILURES` : ' — TS engine === verified model'));
process.exit(failures ? 1 : 0);
