// Cross-check TS model vs Python reference: node scripts/harness-econ/crosscheck.mts
import { execFileSync } from 'node:child_process';
import { calcHarnessEconomics, DEFAULT_HARNESS_INPUTS } from '../../src/lib/harnessEconomics.ts';

const py = JSON.parse(execFileSync('python3', ['scripts/harness-econ/reference_model.py']).toString());
const ts = calcHarnessEconomics(DEFAULT_HARNESS_INPUTS) as unknown as Record<string, number>;
let fail = 0;
for (const [k, v] of Object.entries(py) as [string, number][]) {
  const rel = Math.abs(ts[k] - v) / Math.max(Math.abs(v), 1e-12);
  const ok = rel < 1e-9;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${k.padEnd(34)} ts=${ts[k].toPrecision(6).padStart(12)} py=${v.toPrecision(6).padStart(12)}`);
}
console.log(fail ? `${fail} mismatches` : 'all metrics match (rel err < 1e-9)');
process.exit(fail ? 1 : 0);
