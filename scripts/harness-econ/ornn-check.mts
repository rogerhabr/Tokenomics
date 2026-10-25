// Ornn parser + rental comparison checks: node scripts/harness-econ/ornn-check.mts [--live]
// --live calls the public OCPI endpoint once (free tier, no key). Output stays in
// the terminal — never write Ornn values to the repo (license: no redistribution).
import assert from 'node:assert/strict';
import { parseOrnnDailyIndex, ornnPrice, ORNN_BASE_URL } from '../../src/lib/ornn.ts';
import { calcHarnessEconomics, DEFAULT_HARNESS_INPUTS, rentalComparison } from '../../src/lib/harnessEconomics.ts';

const sample = {
  success: true, date: '2026-01-01T20:00:00.000Z', count: 2,
  data: [
    { gpu_type: 'H100 SXM', region: 'global', index_value: 2.5, date: '2026-01-01T20:00:00.000Z' },
    { gpu_type: 'B200', region: 'global', index_value: 8, date: '2026-01-01T20:00:00.000Z' },
  ],
};
const p = parseOrnnDailyIndex(sample);
assert.ok(p && p.prices.length === 2 && ornnPrice(p, 'H100 SXM') === 2.5);
assert.equal(ornnPrice(p, 'MI300X'), null);
// malformed inputs are rejected, bad rows dropped
assert.equal(parseOrnnDailyIndex(null), null);
assert.equal(parseOrnnDailyIndex({ success: false, date: 'x', data: [] }), null);
assert.equal(parseOrnnDailyIndex({ ...sample, data: [{ gpu_type: 'H100 SXM', index_value: '3', date: 'x' }] }), null);
assert.equal(parseOrnnDailyIndex({ ...sample, data: [...sample.data, { gpu_type: 'X', index_value: -1, date: 'x' }] })?.prices.length, 2);
console.log('parser: OK');

const r = calcHarnessEconomics(DEFAULT_HARNESS_INPUTS);
const c = rentalComparison(r, 2.5);
assert.ok(Math.abs(c.rentalCost - r.adaptGpuHours * 2.5) < 1e-12);
assert.ok(Math.abs(c.impliedApiGrossMargin - (1 - c.rentalCost / r.adaptCost)) < 1e-12);
console.log(`rental: OK  (${r.adaptGpuHours.toFixed(4)} H100-h, API $${r.adaptCost.toFixed(4)})`);

if (process.argv.includes('--live')) {
  const res = await fetch(`${ORNN_BASE_URL}/api/daily-index/all`);
  const live = parseOrnnDailyIndex(await res.json());
  assert.ok(live, `live response failed validation (HTTP ${res.status})`);
  const h100 = ornnPrice(live, 'H100 SXM');
  assert.ok(h100 !== null, 'no H100 SXM row');
  const lc = rentalComparison(r, h100);
  console.log(`live: OK  ${live.prices.length} GPUs, settled ${live.asOf}`);
  console.log(`      H100 $${h100}/h → rental $${lc.rentalCost.toFixed(2)} vs API $${lc.apiCost.toFixed(2)} → implied API margin ${(lc.impliedApiGrossMargin * 100).toFixed(1)}%`);
}
