// Harness Adaptation Economics
// Source: Zhang, Liu, Wang et al. (2026) "Harness Learning Enables Generalizable
// Test-Time Adaptation", arXiv:2609.35738. Page/table refs point into that paper.
//
// Framing: test-time harness adaptation is a one-off setup cost (capex) that is
// amortised over production queries (opex), with accuracy playing the role of
// capacity factor — the same structure as LCOE. The paper reports NO token, GPU
// or $ figures, so every token count below is either a protocol cap (paper) or
// a labelled assumption that the UI exposes as a slider.

// ── Paper-extracted protocol (multi-hop QA, App. D.3 / Table 22) ──────────────
export const QA_PROTOCOL = {
  rounds: 10,              // T, ten-round revision runs (App. D.3)
  candidatesPerRound: 8,   // G (Table 22)
  feedbackQuestions: 6,    // |Q_fb| per round (App. D.3)
  scoringQuestions: 64,    // |Q_score| per round, every candidate is executed on these
  solverCallCap: 12,       // call budget per question (Table 22)
  solverOutputCap: 2048,   // solver response allowance, tokens (Table 22)
  solverContext: 16384,    // solver context window, tokens (Table 22)
  proposerResponseCap: 10240, // eval-time proposer response budget (App. D.3)
  seedSolverCalls: 4,      // seed: summarize → next query → summarize → answer (Fig. 12a)
} as const;

// Held-out exact match. seed + single-step mean are exact (Table 23); the
// ten-round mean is read off Fig. 5 (±0.02) except MuSiQue, stated in §5.3.
export interface QABenchmark {
  id: string;
  label: string;
  seed: number;
  singleStepMean: number;
  tenRoundMean: number;
  tenRoundSource: string;
}

export const QA_BENCHMARKS: QABenchmark[] = [
  { id: 'musique', label: 'MuSiQue (unseen)',  seed: 0.1438, singleStepMean: 0.1467, tenRoundMean: 0.27, tenRoundSource: '§5.3 text' },
  { id: 'hotpot',  label: 'HotpotQA (trained)', seed: 0.3900, singleStepMean: 0.4105, tenRoundMean: 0.61, tenRoundSource: 'Fig. 5a, read ±0.02' },
  { id: '2wiki',   label: '2Wiki (unseen)',    seed: 0.2500, singleStepMean: 0.3090, tenRoundMean: 0.55, tenRoundSource: 'Fig. 5c, read ±0.02' },
];

// Reasoning Gym proposer comparison, 21 unseen families, mean per proposal (Fig. 3c, §5.2)
export const PROPOSER_QUALITY = {
  base4B: 0.32,
  rl4B: 0.62,
  teacher35B: 0.56,
  seed: 0.47,          // Fig. 4 dashed line, read ±0.02
} as const;

export interface Prices { inputPerM: number; outputPerM: number }

// Qwen3-8B on OpenRouter ($0.05 / $0.40 per M) — used for both the 8B solver and
// the 4B proposer (no separate 4B listing; this overstates proposer cost slightly).
export const SMALL_MODEL_PRICES: Prices = { inputPerM: 0.05, outputPerM: 0.40 };

// Frontier what-if preset: solver priced at a frontier API rate, proposer kept at
// the small-model rate (the paper's design: a 4B proposer revising for the solver).
// Accuracy defaults are placeholders, NOT paper results — a stronger seed with a
// smaller relative uplift is the conservative prior.
export const FRONTIER_PRESET = {
  solverPrices: { inputPerM: 2, outputPerM: 10 } as Prices, // Claude Sonnet 5.5, live-data.json
  seedAccuracy: 0.50,
  adaptedAccuracy: 0.58,
} as const;

// How the learned edit changes the production query (Fig. 12):
//  'extra-hop'         — adds solver calls (third retrieval hop / verify branch)
//  'evidence-rewiring' — keeps the seed's calls; the answer call reads both hops'
//                        passages instead of summaries, so only input tokens grow
export type HarnessEditType = 'extra-hop' | 'evidence-rewiring';

// Cache-read price as a share of the input price (same convention as Token Cost Anatomy)
export const CACHE_READ_DISCOUNT = 0.1;

export interface HarnessInputs {
  benchmarkId: string;
  // Frontier-solver what-if: the paper has no accuracy data above an 8B solver,
  // so J0/J1 must be supplied by the user when these are set.
  seedAccuracyOverride?: number;
  adaptedAccuracyOverride?: number;
  rounds: number;
  candidatesPerRound: number;
  scoringQuestions: number;
  feedbackQuestions: number;
  seedCalls: number;          // solver calls / question, seed harness
  editType: HarnessEditType;
  adaptedCalls: number;       // solver calls / question, adapted harness — 'extra-hop' only (assumption)
  rewiringExtraInputTokens: number; // re-read passages on the answer call — 'evidence-rewiring' only (assumption)
  rewiringCachedShare: number;      // share of those re-read tokens served from prompt cache (0–1)
  inTokensPerCall: number;    // assumption: ~20 BM25 passages + prompt
  outTokensPerCall: number;   // assumption: non-thinking short answers/summaries
  proposerInTokens: number;   // assumption: harness source + 6-question trace report
  proposerOutTokens: number;  // assumption: thinking + diagnosis + code block
  solverPrices: Prices;
  proposerPrices: Prices;
  queryVolume: number;        // production queries the adapted harness serves
  valuePerCorrect: number;    // $ — free parameter
  demandElasticity: number;   // ε: % change in correct-answer demand per % change in cost/correct
  // Supply side: proposer substitution + compute
  teacherPrices: Prices;
  proposerActiveParamsB: number;
  teacherActiveParamsB: number;
  solverActiveParamsB: number;
  gpuPeakTflops: number;      // dense BF16
  mfu: number;                // model FLOP utilisation
  gpuPowerKw: number;
  pue: number;
}

export const DEFAULT_HARNESS_INPUTS: HarnessInputs = {
  benchmarkId: 'musique',
  rounds: QA_PROTOCOL.rounds,
  candidatesPerRound: QA_PROTOCOL.candidatesPerRound,
  scoringQuestions: QA_PROTOCOL.scoringQuestions,
  feedbackQuestions: QA_PROTOCOL.feedbackQuestions,
  seedCalls: QA_PROTOCOL.seedSolverCalls,
  editType: 'extra-hop',
  adaptedCalls: 5,
  rewiringExtraInputTokens: 3000, // 2 hops × ~20 passages − the two summaries they replace
  rewiringCachedShare: 0,
  inTokensPerCall: 1800,
  outTokensPerCall: 200,
  proposerInTokens: 7000,
  proposerOutTokens: 6000,
  solverPrices: SMALL_MODEL_PRICES,
  proposerPrices: SMALL_MODEL_PRICES,
  queryVolume: 100_000,
  valuePerCorrect: 0.01,
  demandElasticity: 1.0,
  teacherPrices: { inputPerM: 0.15, outputPerM: 0.60 },
  proposerActiveParamsB: 4,
  teacherActiveParamsB: 35,
  solverActiveParamsB: 8,
  gpuPeakTflops: 989,  // H100 SXM dense BF16
  mfu: 0.2,
  gpuPowerKw: 0.7,
  pue: 1.3,
};

const usd = (inTok: number, outTok: number, p: Prices) =>
  (inTok * p.inputPerM + outTok * p.outputPerM) / 1e6;

export interface HarnessResult {
  benchmark: QABenchmark;
  // per production query
  costPerQuerySeed: number;
  costPerQueryAdapted: number;
  tokensPerQuerySeed: number;
  tokensPerQueryAdapted: number;
  // adaptation capex
  costPerProposal: number;
  adaptCost: number;
  adaptTokens: number;
  adaptProposerCost: number;
  adaptScoringCost: number;
  adaptFeedbackCost: number;
  adaptQueryEquivalents: number;   // adaptation tokens ÷ adapted tokens/query
  // levelised cost per correct answer
  cpcSeed: number;
  cpcAdaptedAsymptotic: number;
  cpcAdaptedAtVolume: number;
  accuracyRatio: number;           // J1/J0
  costPerQueryRatio: number;       // c1/c0 — break-even exists iff J1/J0 > c1/c0
  breakEvenVolumeCpc: number;      // Infinity if never
  breakEvenVolumeValue: number;    // Infinity if never
  netValueAtVolume: number;
  // demand side
  tokensPerQueryMultiplier: number;
  tokensPerCorrectMultiplier: number;
  totalTokenDemandMultiplier: number;
  // supply side
  proposerCostRatioTeacherVs4B: number;
  qualityPerDollarRatio4BVsTeacher: number;
  flopRatioTeacherVs4B: number;
  adaptCachedTokens: number;       // cache-hit tokens: billed at the cache rate, no prefill FLOPs
  adaptGpuHours: number;
  adaptKwh: number;
}

export function calcHarnessEconomics(i: HarnessInputs): HarnessResult {
  const benchmark = QA_BENCHMARKS.find(b => b.id === i.benchmarkId) ?? QA_BENCHMARKS[0];

  const perCallTokens = i.inTokensPerCall + i.outTokensPerCall;
  const perCallCost = usd(i.inTokensPerCall, i.outTokensPerCall, i.solverPrices);
  const costPerQuerySeed = i.seedCalls * perCallCost;
  const tokensPerQuerySeed = i.seedCalls * perCallTokens;
  let costPerQueryAdapted: number;
  let tokensPerQueryAdapted: number;
  if (i.editType === 'evidence-rewiring') {
    const x = i.rewiringExtraInputTokens;
    const cachedShare = Math.min(Math.max(i.rewiringCachedShare, 0), 1);
    const extraCost = x * i.solverPrices.inputPerM * ((1 - cachedShare) + cachedShare * CACHE_READ_DISCOUNT) / 1e6;
    costPerQueryAdapted = costPerQuerySeed + extraCost;
    tokensPerQueryAdapted = tokensPerQuerySeed + x; // counted in full: cache hits are cheaper, not absent (KV memory)
  } else {
    costPerQueryAdapted = i.adaptedCalls * perCallCost;
    tokensPerQueryAdapted = i.adaptedCalls * perCallTokens;
  }

  // C_adapt = T·G·c_prop + T·G·|Q_score|·c_q(h') + |Q_fb|·[c_q(h0) + (T−1)·c_q(h')]
  const proposals = i.rounds * i.candidatesPerRound;
  const costPerProposal = usd(i.proposerInTokens, i.proposerOutTokens, i.proposerPrices);
  const adaptProposerCost = proposals * costPerProposal;
  const adaptScoringCost = proposals * i.scoringQuestions * costPerQueryAdapted;
  const fbRuns = Math.max(i.rounds - 1, 0);
  const adaptFeedbackCost = i.feedbackQuestions * (costPerQuerySeed + fbRuns * costPerQueryAdapted);
  const adaptCost = adaptProposerCost + adaptScoringCost + adaptFeedbackCost;

  const proposerTokens = proposals * (i.proposerInTokens + i.proposerOutTokens);
  const solverTokens = proposals * i.scoringQuestions * tokensPerQueryAdapted
    + i.feedbackQuestions * (tokensPerQuerySeed + fbRuns * tokensPerQueryAdapted);
  const adaptTokens = proposerTokens + solverTokens;
  // Prompt-cache hits skip prefill compute (KV is reused), so they are kept in the
  // token totals (demand, KV memory) but excluded from FLOPs below.
  const cachedTokensPerAdaptedQuery = i.editType === 'evidence-rewiring'
    ? i.rewiringExtraInputTokens * Math.min(Math.max(i.rewiringCachedShare, 0), 1) : 0;
  const adaptedQueryRuns = proposals * i.scoringQuestions + i.feedbackQuestions * fbRuns;
  const adaptCachedTokens = adaptedQueryRuns * cachedTokensPerAdaptedQuery;

  const J0 = i.seedAccuracyOverride ?? benchmark.seed;
  const J1 = i.adaptedAccuracyOverride ?? benchmark.tenRoundMean;
  const N = i.queryVolume;

  const cpcSeed = costPerQuerySeed / J0;
  const cpcAdaptedAsymptotic = costPerQueryAdapted / J1;
  const cpcAdaptedAtVolume = N > 0 ? (adaptCost + N * costPerQueryAdapted) / (N * J1) : Infinity;

  // Equal correct answers: seed needs N·J1/J0 queries. Break-even when
  // C_adapt + N·c1 = N·c0·J1/J0  →  N* = C_adapt / (c0·J1/J0 − c1)
  const cpcMargin = costPerQuerySeed * J1 / J0 - costPerQueryAdapted;
  const breakEvenVolumeCpc = cpcMargin > 0 ? adaptCost / cpcMargin : Infinity;

  // Value view: N* = C_adapt / (ΔJ·V − Δc)
  const valueMargin = (J1 - J0) * i.valuePerCorrect - (costPerQueryAdapted - costPerQuerySeed);
  const breakEvenVolumeValue = valueMargin > 0 ? adaptCost / valueMargin : Infinity;
  const netValueAtVolume = N * valueMargin - adaptCost;

  // Demand side. Constant-elasticity demand for correct answers:
  // answers ∝ cpc^(−ε) → total tokens ∝ answers · tokens/answer
  const tokensPerQueryMultiplier = tokensPerQueryAdapted / tokensPerQuerySeed;
  const tokensPerCorrectMultiplier = (tokensPerQueryAdapted / J1) / (tokensPerQuerySeed / J0);
  const cpcRatio = (Number.isFinite(cpcAdaptedAtVolume) ? cpcAdaptedAtVolume : cpcAdaptedAsymptotic) / cpcSeed;
  const totalTokenDemandMultiplier = Math.pow(cpcRatio, -i.demandElasticity) * tokensPerCorrectMultiplier;

  // Supply side: same proposal tokens priced at teacher vs 4B rates
  const teacherCostPerProposal = usd(i.proposerInTokens, i.proposerOutTokens, i.teacherPrices);
  const proposerCostRatioTeacherVs4B = teacherCostPerProposal / costPerProposal;
  const qualityPerDollarRatio4BVsTeacher =
    (PROPOSER_QUALITY.rl4B / costPerProposal) / (PROPOSER_QUALITY.teacher35B / teacherCostPerProposal);
  const flopRatioTeacherVs4B = i.teacherActiveParamsB / i.proposerActiveParamsB;

  // Compute: FLOPs ≈ 2 · active params · tokens actually computed (cache hits excluded)
  const flops = 2 * (i.proposerActiveParamsB * 1e9 * proposerTokens
    + i.solverActiveParamsB * 1e9 * (solverTokens - adaptCachedTokens));
  const adaptGpuHours = flops / (i.gpuPeakTflops * 1e12 * i.mfu) / 3600;
  const adaptKwh = adaptGpuHours * i.gpuPowerKw * i.pue;

  return {
    benchmark,
    costPerQuerySeed, costPerQueryAdapted, tokensPerQuerySeed, tokensPerQueryAdapted,
    costPerProposal, adaptCost, adaptTokens, adaptProposerCost, adaptScoringCost, adaptFeedbackCost,
    adaptQueryEquivalents: adaptTokens / tokensPerQueryAdapted,
    accuracyRatio: J1 / J0, costPerQueryRatio: costPerQueryAdapted / costPerQuerySeed,
    cpcSeed, cpcAdaptedAsymptotic, cpcAdaptedAtVolume, breakEvenVolumeCpc, breakEvenVolumeValue, netValueAtVolume,
    tokensPerQueryMultiplier, tokensPerCorrectMultiplier, totalTokenDemandMultiplier,
    proposerCostRatioTeacherVs4B, qualityPerDollarRatio4BVsTeacher, flopRatioTeacherVs4B,
    adaptCachedTokens, adaptGpuHours, adaptKwh,
  };
}

// Levelised cost per correct answer vs production volume (log-spaced)
export function cpcCurve(i: HarnessInputs, points = 25): { volume: number; seed: number; adapted: number }[] {
  const out: { volume: number; seed: number; adapted: number }[] = [];
  for (let k = 0; k < points; k++) {
    const volume = Math.round(Math.pow(10, 2 + (5 * k) / (points - 1))); // 1e2 → 1e7
    const r = calcHarnessEconomics({ ...i, queryVolume: volume });
    out.push({ volume, seed: r.cpcSeed, adapted: r.cpcAdaptedAtVolume });
  }
  return out;
}
