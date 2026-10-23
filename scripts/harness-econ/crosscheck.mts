// Cross-check TS model vs Python reference: node scripts/harness-econ/crosscheck.mts
import { execFileSync } from 'node:child_process';
import {
  calcHarnessEconomics, DEFAULT_HARNESS_INPUTS, FRONTIER_PRESET, type HarnessInputs,
} from '../../src/lib/harnessEconomics.ts';

const cases: { name: string; ts: HarnessInputs; py: Record<string, number> }[] = [
  { name: 'paper defaults (small-model prices)', ts: DEFAULT_HARNESS_INPUTS, py: {} },
  {
    name: 'frontier preset (frontier solver, small proposer)',
    ts: {
      ...DEFAULT_HARNESS_INPUTS,
      solverPrices: FRONTIER_PRESET.solverPrices,
      seedAccuracyOverride: FRONTIER_PRESET.seedAccuracy,
      adaptedAccuracyOverride: FRONTIER_PRESET.adaptedAccuracy,
    },
    py: {
      s_in: FRONTIER_PRESET.solverPrices.inputPerM, s_out: FRONTIER_PRESET.solverPrices.outputPerM,
      J0: FRONTIER_PRESET.seedAccuracy, J1: FRONTIER_PRESET.adaptedAccuracy,
    },
  },
  {
    name: 'frontier + evidence rewiring, 90% of re-read passages cached',
    ts: {
      ...DEFAULT_HARNESS_INPUTS,
      solverPrices: FRONTIER_PRESET.solverPrices,
      seedAccuracyOverride: FRONTIER_PRESET.seedAccuracy,
      adaptedAccuracyOverride: FRONTIER_PRESET.adaptedAccuracy,
      editType: 'evidence-rewiring',
      rewiringCachedShare: 0.9,
    },
    py: {
      s_in: FRONTIER_PRESET.solverPrices.inputPerM, s_out: FRONTIER_PRESET.solverPrices.outputPerM,
      J0: FRONTIER_PRESET.seedAccuracy, J1: FRONTIER_PRESET.adaptedAccuracy,
      edit: 'evidence-rewiring' as unknown as number, cache: 0.9,
    },
  },
];

let fail = 0;
for (const c of cases) {
  console.log(`\n# ${c.name}`);
  // Python emits bare Infinity (not JSON); 1e999 parses to Infinity
  const raw = execFileSync('python3', ['scripts/harness-econ/reference_model.py', JSON.stringify(c.py)]).toString();
  const py = JSON.parse(raw.replace(/\bInfinity\b/g, '1e999'));
  const ts = calcHarnessEconomics(c.ts) as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(py) as [string, number][]) {
    const rel = ts[k] === v ? 0 : Math.abs(ts[k] - v) / Math.max(Math.abs(v), 1e-12);
    const ok = rel < 1e-9;
    if (!ok) fail++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${k.padEnd(34)} ts=${ts[k].toPrecision(6).padStart(12)} py=${v.toPrecision(6).padStart(12)}`);
  }
}
console.log(fail ? `\n${fail} mismatches` : '\nall metrics match in every case (rel err < 1e-9)');
process.exit(fail ? 1 : 0);
