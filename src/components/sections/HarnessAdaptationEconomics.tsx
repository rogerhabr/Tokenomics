'use client';

import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import SectionHeader from '../SectionHeader';
import MetricCard from '../MetricCard';
import {
  QA_BENCHMARKS, QA_PROTOCOL, PROPOSER_QUALITY, DEFAULT_HARNESS_INPUTS, FRONTIER_PRESET, SMALL_MODEL_PRICES,
  CACHE_READ_DISCOUNT, calcHarnessEconomics, cpcCurve, type HarnessInputs, type HarnessEditType, type Prices,
} from '@/lib/harnessEconomics';
import { useLiveData } from '@/hooks/useLiveData';

const SEED_COLOR = '#3b82f6';     // sa-blue
const ADAPTED_COLOR = '#f97316';  // sa-accent

function fmtUSD(n: number): string {
  if (!Number.isFinite(n)) return 'never';
  const a = Math.abs(n);
  const s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}k`;
  if (a >= 1) return `${s}$${a.toFixed(2)}`;
  if (a >= 0.01) return `${s}$${a.toFixed(3)}`;
  return `${s}$${a.toPrecision(2)}`;
}

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return 'never';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toFixed(0);
}

const fmtX = (n: number) => `${n.toFixed(2)}×`;
const fmtQueries = (n: number) => (Number.isFinite(n) ? `${fmtNum(n)} q` : 'never');
const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(0)}%`;

interface SliderProps {
  label: string; value: number; min: number; max: number; step: number;
  display: string; note?: string; onChange: (v: number) => void;
}
function Slider({ label, value, min, max, step, display, note, onChange }: SliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-300">{label}</label>
        <span className="text-xs font-bold text-white number-cell">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full" />
      {note && <p className="text-[10px] text-sa-muted mt-0.5">{note}</p>}
    </div>
  );
}

export default function HarnessAdaptationEconomics() {
  const { liveData, liveLoaded } = useLiveData();
  const [inp, setInp] = useState<HarnessInputs>(DEFAULT_HARNESS_INPUTS);
  // '' = small open model (paper scale), 'frontier' = preset, else a live-data model key
  const [solverTier, setSolverTier] = useState('');
  const isFrontier = solverTier !== '';

  const pickTier = (tier: string) => {
    setSolverTier(tier);
    const live = liveData.modelPricing?.[tier];
    const prices: Prices = tier === '' ? SMALL_MODEL_PRICES
      : live ? { inputPerM: live.inputPerM, outputPerM: live.outputPerM }
      : FRONTIER_PRESET.solverPrices;
    setInp(p => ({
      ...p,
      solverPrices: prices,
      // proposer stays the small trained model in every tier
      seedAccuracyOverride: tier === '' ? undefined : p.seedAccuracyOverride ?? FRONTIER_PRESET.seedAccuracy,
      adaptedAccuracyOverride: tier === '' ? undefined : p.adaptedAccuracyOverride ?? FRONTIER_PRESET.adaptedAccuracy,
    }));
  };
  const set = <K extends keyof HarnessInputs>(k: K, v: HarnessInputs[K]) => setInp(p => ({ ...p, [k]: v }));

  const r = useMemo(() => calcHarnessEconomics(inp), [inp]);
  const curve = useMemo(() => cpcCurve(inp), [inp]);
  const yDomain = useMemo(() => {
    const ys = curve.flatMap(p => [p.seed, p.adapted]).filter(v => Number.isFinite(v) && v > 0);
    return [Math.min(...ys) * 0.8, Math.max(...ys) * 1.2];
  }, [curve]);

  // Volume slider runs on log10 scale
  const logN = Math.log10(inp.queryVolume);

  const capexRows = [
    { name: 'Proposer generations', cost: r.adaptProposerCost },
    { name: 'Candidate scoring runs', cost: r.adaptScoringCost },
    { name: 'Feedback runs', cost: r.adaptFeedbackCost },
  ];

  return (
    <div>
      <SectionHeader
        title="Harness Adaptation Economics"
        subtitle="Test-time harness learning (Zhang et al., 2026) rewrites the code around a frozen model instead of its weights. Treated like plant commissioning: adaptation is capex, production queries are opex, and accuracy is the capacity factor — giving a levelised cost per correct answer, a break-even volume, and the net effect on token demand and GPU supply."
        badge="Interactive"
        sources={[
          { type: 'actual', label: 'Protocol & accuracy: arXiv:2609.35738', url: 'https://arxiv.org/abs/2609.35738' },
          { type: 'actual', label: 'Pricing: Qwen3-8B, OpenRouter', url: 'https://openrouter.ai/qwen/qwen3-8b' },
          { type: 'derived', label: 'Token counts: labelled assumptions' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 bg-sa-card rounded-xl border border-sa-border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Inputs</h3>
            <button onClick={() => { setInp(DEFAULT_HARNESS_INPUTS); setSolverTier(''); }} className="text-[11px] text-sa-accent hover:underline">
              Reset to paper defaults
            </button>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">Benchmark (held-out exact match)</label>
            <select value={inp.benchmarkId} onChange={e => set('benchmarkId', e.target.value)} className="w-full text-xs">
              {QA_BENCHMARKS.map(b => (
                <option key={b.id} value={b.id}>{b.label} — seed {b.seed.toFixed(2)} → {b.tenRoundMean.toFixed(2)}</option>
              ))}
            </select>
            <p className="text-[10px] text-sa-muted mt-1">10-round value: {r.benchmark.tenRoundSource}. Seed: Table 23.</p>
          </div>

          <div className="space-y-3 pt-3 border-t border-sa-border">
            <p className="text-[11px] uppercase tracking-wider text-sa-muted">Adaptation protocol (paper)</p>
            <Slider label="Revision rounds T" value={inp.rounds} min={1} max={20} step={1} display={`${inp.rounds}`}
              note={`Paper: ${QA_PROTOCOL.rounds}`} onChange={v => set('rounds', v)} />
            <Slider label="Candidates per round G" value={inp.candidatesPerRound} min={1} max={16} step={1} display={`${inp.candidatesPerRound}`}
              note={`Paper: ${QA_PROTOCOL.candidatesPerRound}`} onChange={v => set('candidatesPerRound', v)} />
            <Slider label="Scoring questions |Q_score|" value={inp.scoringQuestions} min={8} max={256} step={8} display={`${inp.scoringQuestions}`}
              note={`Paper: ${QA_PROTOCOL.scoringQuestions} — the dominant cost driver`} onChange={v => set('scoringQuestions', v)} />
          </div>

          <div className="space-y-3 pt-3 border-t border-sa-border">
            <p className="text-[11px] uppercase tracking-wider text-sa-muted">Token assumptions (not reported in paper)</p>
            <div>
              <label className="text-xs text-slate-300 mb-1.5 block">Learned edit type (Fig. 12)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {([['extra-hop', 'Extra hop / verify'], ['evidence-rewiring', 'Evidence rewiring']] as [HarnessEditType, string][]).map(([k, label]) => (
                  <button key={k} onClick={() => set('editType', k)}
                    className={`text-[11px] py-1.5 rounded border transition-colors ${inp.editType === k
                      ? 'bg-sa-accent/20 border-sa-accent/50 text-sa-accent' : 'border-sa-border text-sa-muted hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-sa-muted mt-1">
                {inp.editType === 'extra-hop'
                  ? 'Adds solver calls (Fig. 12c/d).'
                  : 'Same calls as the seed; the answer call reads both hops\' passages instead of summaries (Fig. 12b), so only input tokens grow.'}
              </p>
            </div>
            {inp.editType === 'extra-hop' ? (
              <Slider label="Solver calls / query — adapted" value={inp.adaptedCalls} min={1} max={QA_PROTOCOL.solverCallCap} step={1}
                display={`${inp.adaptedCalls} (seed ${inp.seedCalls})`} note="Cap 12"
                onChange={v => set('adaptedCalls', v)} />
            ) : (
              <>
                <Slider label="Re-read passage tokens / query" value={inp.rewiringExtraInputTokens} min={0} max={10000} step={100}
                  display={fmtNum(inp.rewiringExtraInputTokens)} note="≈2 hops × 20 passages, minus the 2 summaries replaced"
                  onChange={v => set('rewiringExtraInputTokens', v)} />
                <Slider label="Re-read tokens served from prompt cache" value={inp.rewiringCachedShare} min={0} max={1} step={0.05}
                  display={`${Math.round(inp.rewiringCachedShare * 100)}%`}
                  note={`Cache reads billed at ${Math.round(CACHE_READ_DISCOUNT * 100)}% of input. Needs a harness that keeps passages in a shared prompt prefix.`}
                  onChange={v => set('rewiringCachedShare', v)} />
              </>
            )}
            <Slider label="Input tokens / solver call" value={inp.inTokensPerCall} min={200} max={QA_PROTOCOL.solverContext} step={100}
              display={fmtNum(inp.inTokensPerCall)} note="≈20 BM25 passages + prompt; context cap 16k" onChange={v => set('inTokensPerCall', v)} />
            <Slider label="Output tokens / solver call" value={inp.outTokensPerCall} min={20} max={QA_PROTOCOL.solverOutputCap} step={20}
              display={fmtNum(inp.outTokensPerCall)} note="Non-thinking solver; cap 2,048" onChange={v => set('outTokensPerCall', v)} />
            <Slider label="Proposer output tokens / proposal" value={inp.proposerOutTokens} min={500} max={QA_PROTOCOL.proposerResponseCap} step={250}
              display={fmtNum(inp.proposerOutTokens)} note="Thinking enabled; cap 10,240" onChange={v => set('proposerOutTokens', v)} />
          </div>

          <div className="space-y-3 pt-3 border-t border-sa-border">
            <p className="text-[11px] uppercase tracking-wider text-sa-muted">Deployment</p>
            <Slider label="Production query volume N" value={logN} min={2} max={8} step={0.05}
              display={fmtNum(inp.queryVolume)} onChange={v => set('queryVolume', Math.round(Math.pow(10, v)))} />
            <Slider label="Value per correct answer V" value={Math.log10(inp.valuePerCorrect)} min={-4} max={2} step={0.05}
              display={fmtUSD(inp.valuePerCorrect)} note="Free parameter" onChange={v => set('valuePerCorrect', Math.pow(10, v))} />
            <Slider label="Demand elasticity ε (answers vs $/correct)" value={inp.demandElasticity} min={0} max={3} step={0.1}
              display={inp.demandElasticity.toFixed(1)} note="ε > 1: cheaper answers grow total token demand (Jevons)"
              onChange={v => set('demandElasticity', v)} />
          </div>

          <div className="space-y-3 pt-3 border-t border-sa-border">
            <p className="text-[11px] uppercase tracking-wider text-sa-muted">Solver price tier</p>
            <div>
              <select value={solverTier} onChange={e => pickTier(e.target.value)} className="w-full text-xs">
                <option value="">Small open model — Qwen3-8B ${SMALL_MODEL_PRICES.inputPerM}/${SMALL_MODEL_PRICES.outputPerM} (paper scale)</option>
                <option value="frontier">Frontier preset — Sonnet 5.5 ${FRONTIER_PRESET.solverPrices.inputPerM}/${FRONTIER_PRESET.solverPrices.outputPerM}</option>
                {liveLoaded && Object.entries(liveData.modelPricing || {}).map(([model, p]) => (
                  <option key={model} value={model}>{p.displayName} — ${p.inputPerM}/${p.outputPerM} (live)</option>
                ))}
              </select>
              <p className="text-[10px] text-sa-muted mt-1">
                Solver ${inp.solverPrices.inputPerM}/${inp.solverPrices.outputPerM} per M · proposer stays the small
                4B model at ${inp.proposerPrices.inputPerM}/${inp.proposerPrices.outputPerM}
              </p>
            </div>
            {isFrontier && (
              <>
                <p className="text-[10px] text-sa-yellow leading-relaxed">
                  The paper has no results above an 8B solver. Accuracy below is your input, not data — the
                  defaults assume a stronger seed with a smaller relative uplift.
                </p>
                <Slider label="Seed accuracy J₀" value={inp.seedAccuracyOverride ?? FRONTIER_PRESET.seedAccuracy} min={0.05} max={0.95} step={0.01}
                  display={(inp.seedAccuracyOverride ?? FRONTIER_PRESET.seedAccuracy).toFixed(2)}
                  onChange={v => set('seedAccuracyOverride', v)} />
                <Slider label="Adapted accuracy J₁" value={inp.adaptedAccuracyOverride ?? FRONTIER_PRESET.adaptedAccuracy} min={0.05} max={1} step={0.01}
                  display={(inp.adaptedAccuracyOverride ?? FRONTIER_PRESET.adaptedAccuracy).toFixed(2)}
                  onChange={v => set('adaptedAccuracyOverride', v)} />
              </>
            )}
          </div>
        </div>

        {/* ── Results ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Adaptation capex" value={fmtUSD(r.adaptCost)} subtext={`${fmtNum(r.adaptTokens)} tokens, one run`} accent />
            <MetricCard label="Break-even (cost/correct)" value={fmtQueries(r.breakEvenVolumeCpc)}
              subtext="queries to match seed $/correct" />
            <MetricCard label="$/correct @ N" value={fmtUSD(r.cpcAdaptedAtVolume)}
              subtext={`seed ${fmtUSD(r.cpcSeed)}`}
              change={Number.isFinite(r.cpcAdaptedAtVolume) ? `${fmtPct((r.cpcAdaptedAtVolume / r.cpcSeed - 1) * 100)} vs seed` : undefined}
              changePositive={r.cpcAdaptedAtVolume < r.cpcSeed} />
            <MetricCard label="Net value @ N" value={fmtUSD(r.netValueAtVolume)}
              subtext={Number.isFinite(r.breakEvenVolumeValue) ? `break-even ${fmtQueries(r.breakEvenVolumeValue)} at V` : 'never breaks even at this V'}
              changePositive={r.netValueAtVolume > 0}
              change={r.netValueAtVolume > 0 ? 'NPV-positive (undiscounted)' : 'loss-making'} />
          </div>

          {/* Levelised cost per correct answer */}
          <div className="bg-sa-card rounded-xl border border-sa-border p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Levelised Cost per Correct Answer vs Volume</h3>
            <p className="text-xs text-sa-muted mb-3">
              LCPCA(N) = (C_adapt + N·c₁) / (N·J₁) against seed c₀/J₀. Adaptation pays back once
              N &gt; C_adapt / (c₀·J₁/J₀ − c₁) — the dashed line. A break-even exists only if the accuracy ratio
              beats the cost-per-query ratio, and it does not depend on price level: scaling every price by k scales
              capex and margin alike.
            </p>
            <p className={`text-xs mb-3 number-cell ${r.accuracyRatio > r.costPerQueryRatio ? 'text-sa-green' : 'text-sa-red'}`}>
              J₁/J₀ = {fmtX(r.accuracyRatio)} {r.accuracyRatio > r.costPerQueryRatio ? '>' : '≤'} c₁/c₀ = {fmtX(r.costPerQueryRatio)}
              {' — '}{r.accuracyRatio > r.costPerQueryRatio ? 'adaptation can pay back' : 'adaptation never pays back on cost per correct answer'}
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={curve} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a42" />
                <XAxis dataKey="volume" type="number" scale="log" domain={[1e2, 1e7]}
                  ticks={[1e2, 1e3, 1e4, 1e5, 1e6, 1e7]} tickFormatter={fmtNum}
                  tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="number" scale="log" domain={yDomain} tickFormatter={fmtUSD}
                  tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  formatter={(v: number, n: string) => [fmtUSD(v), n]}
                  labelFormatter={(l: number) => `N = ${fmtNum(l)} queries`}
                  contentStyle={{ background: '#141b2d', border: '1px solid #1e2a42', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {Number.isFinite(r.breakEvenVolumeCpc) && r.breakEvenVolumeCpc >= 1e2 && r.breakEvenVolumeCpc <= 1e7 && (
                  <ReferenceLine x={r.breakEvenVolumeCpc} stroke="#64748b" strokeDasharray="4 4"
                    label={{ value: `break-even ${fmtNum(r.breakEvenVolumeCpc)}`, fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }} />
                )}
                <Line type="monotone" dataKey="seed" name="Seed harness" stroke={SEED_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="adapted" name="Adapted harness (incl. capex)" stroke={ADAPTED_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <details className="mt-2">
              <summary className="text-[11px] text-sa-muted cursor-pointer">Table view</summary>
              <table className="w-full text-xs mt-2">
                <thead><tr className="text-sa-muted text-left"><th>N</th><th>Seed $/correct</th><th>Adapted $/correct</th></tr></thead>
                <tbody>
                  {curve.filter((_, k) => k % 4 === 0).map(p => (
                    <tr key={p.volume} className="border-t border-sa-border">
                      <td className="number-cell py-1">{fmtNum(p.volume)}</td>
                      <td className="number-cell">{fmtUSD(p.seed)}</td>
                      <td className="number-cell">{fmtUSD(p.adapted)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>

          {/* Capex composition */}
          <div className="bg-sa-card rounded-xl border border-sa-border p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Where the Adaptation Capex Goes</h3>
            <p className="text-xs text-sa-muted mb-3">
              C_adapt = T·G·c_prop + T·G·|Q_score|·c₁ + |Q_fb|·[c₀ + (T−1)·c₁]. Executing candidates, not
              generating them, is the bill — the paper calls the compute &quot;unmatched&quot; but never prices it.
            </p>
            <table className="w-full text-xs">
              <tbody>
                {capexRows.map(row => (
                  <tr key={row.name} className="border-t border-sa-border">
                    <td className="py-1.5 text-slate-300">{row.name}</td>
                    <td className="number-cell text-right text-white">{fmtUSD(row.cost)}</td>
                    <td className="number-cell text-right text-sa-muted w-20">{((row.cost / r.adaptCost) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Demand & supply ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="bg-sa-card rounded-xl border border-sa-border p-4">
          <h3 className="text-sm font-semibold text-white mb-1">Demand Side — Token Multipliers</h3>
          <p className="text-xs text-sa-muted mb-3">
            Heavier harnesses burn more tokens per query but fewer per correct answer. Whether total demand
            rises depends on how elastic demand for correct answers is to their cost.
          </p>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Tokens / query</td>
                <td className="number-cell text-right text-white">{fmtX(r.tokensPerQueryMultiplier)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Tokens / correct answer</td>
                <td className="number-cell text-right text-white">{fmtX(r.tokensPerCorrectMultiplier)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Total token demand at ε = {inp.demandElasticity.toFixed(1)}</td>
                <td className={`number-cell text-right font-bold ${r.totalTokenDemandMultiplier >= 1 ? 'text-sa-green' : 'text-sa-red'}`}>
                  {fmtX(r.totalTokenDemandMultiplier)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Adaptation tokens, in production-query equivalents</td>
                <td className="number-cell text-right text-white">{fmtNum(r.adaptQueryEquivalents)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bg-sa-card rounded-xl border border-sa-border p-4">
          <h3 className="text-sm font-semibold text-white mb-1">Supply Side — Proposer Substitution &amp; Compute</h3>
          <p className="text-xs text-sa-muted mb-3">
            Trained 4B proposer: {PROPOSER_QUALITY.rl4B.toFixed(2)} mean held-out vs 35B teacher {PROPOSER_QUALITY.teacher35B.toFixed(2)} on
            21 unseen families (§5.2) — but the teacher still wins best-of-8.
          </p>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Teacher / 4B cost per proposal (API $)</td>
                <td className="number-cell text-right text-white">{fmtX(r.proposerCostRatioTeacherVs4B)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">4B / teacher quality per $</td>
                <td className="number-cell text-right text-white">{fmtX(r.qualityPerDollarRatio4BVsTeacher)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">
                  Teacher / 4B FLOPs per token
                  <span className="block text-[10px] text-sa-muted">Active params; set teacher to 3 if it is an A3B MoE — paper does not say</span></td>
                <td className="number-cell text-right text-white">{fmtX(r.flopRatioTeacherVs4B)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Adaptation compute (H100-hours @ {Math.round(inp.mfu * 100)}% MFU)</td>
                <td className="number-cell text-right text-white">{r.adaptGpuHours.toFixed(2)}</td></tr>
              <tr className="border-t border-sa-border"><td className="py-1.5 text-slate-300">Adaptation energy (kWh @ PUE {inp.pue})</td>
                <td className="number-cell text-right text-white">{r.adaptKwh.toFixed(2)}</td></tr>
            </tbody>
          </table>
          <div className="mt-3">
            <Slider label="Teacher active params (B)" value={inp.teacherActiveParamsB} min={1} max={70} step={1}
              display={`${inp.teacherActiveParamsB}B`} onChange={v => set('teacherActiveParamsB', v)} />
          </div>
        </div>
      </div>

      {/* ── Caveats ────────────────────────────────────────────────── */}
      <div className="bg-sa-card rounded-xl border border-sa-border p-4">
        <h3 className="text-sm font-semibold text-white mb-2">Model Limits</h3>
        <ul className="text-xs text-sa-muted space-y-1 list-disc pl-4">
          <li>The paper reports no token, latency or $ figures; costs here use protocol caps plus the labelled token assumptions.</li>
          <li>One revision run is priced. The paper&apos;s headline curves average 4 runs (320 proposals) and its best-run figures select on held-out data.</li>
          <li>Adaptation needs a grader and dev questions at test time; most production workloads have neither, so the addressable share of tokens is below 100%.</li>
          <li>Solvers are 4B/8B with low absolute accuracy (MuSiQue 0.27 EM); gains on frontier solvers are unproven.</li>
          <li>Adaptation GPU-hours count cache-hit tokens as full prefill, which overstates compute for the evidence-rewiring edit.</li>
          <li>Failed or zero-scoring candidates (1–5% in QA, Table 23) are priced as full runs — a slight overstatement.</li>
        </ul>
      </div>
    </div>
  );
}
