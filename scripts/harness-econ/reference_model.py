"""Independent Python reference for src/lib/harnessEconomics.ts.

Recomputes the default case from first principles (no shared code) so the TS
port can be checked numerically:  python3 scripts/harness-econ/reference_model.py
"""
import json, math, sys

P = dict(  # paper protocol, arXiv:2609.35738 App. D.3 / Table 22
    T=10, G=8, Qfb=6, Qscore=64, k0=4,
)
A = dict(  # labelled assumptions (paper reports no token counts)
    edit='extra-hop', x=3000, cache=0.0,
    k1=5, tin=1800, tout=200, pin=7000, pout=6000,
    s_in=0.05, s_out=0.40,      # Qwen3-8B OpenRouter $/M
    t_in=0.15, t_out=0.60,      # teacher-class $/M (assumption)
    N=100_000, V=0.01, eps=1.0,
    p_params=4, s_params=8, t_params=35, tflops=989, mfu=0.2, kw=0.7, pue=1.3,
)
J0, J1 = 0.1438, 0.27  # MuSiQue seed (Table 23), ten-round mean (§5.3)

# Optional case override: python3 reference_model.py '{"s_in":2,"s_out":10,"J0":0.5,"J1":0.58}'
# s_in/s_out reprice the solver only; the proposer keeps p_in/p_out.
A.update(p_in=A['s_in'], p_out=A['s_out'])
if len(sys.argv) > 1:
    ov = json.loads(sys.argv[1])
    J0, J1 = ov.pop('J0', J0), ov.pop('J1', J1)
    A.update(ov)

def cost(i, o, pi, po): return (i * pi + o * po) / 1e6

c_call = cost(A['tin'], A['tout'], A['s_in'], A['s_out'])
tok_call = A['tin'] + A['tout']
c0, q0 = P['k0'] * c_call, P['k0'] * tok_call
if A['edit'] == 'evidence-rewiring':
    # seed calls unchanged; answer call re-reads x passage tokens, a share cached at 10% of input
    c1 = c0 + A['x'] * A['s_in'] * ((1 - A['cache']) + A['cache'] * 0.1) / 1e6
    q1 = q0 + A['x']
else:
    c1, q1 = A['k1'] * c_call, A['k1'] * tok_call

props = P['T'] * P['G']
c_prop = cost(A['pin'], A['pout'], A['p_in'], A['p_out'])
C_prop = props * c_prop
C_score = props * P['Qscore'] * c1
C_fb = P['Qfb'] * (c0 + (P['T'] - 1) * c1)
C = C_prop + C_score + C_fb

tok_prop = props * (A['pin'] + A['pout'])
tok_solver = props * P['Qscore'] * q1 + P['Qfb'] * (q0 + (P['T'] - 1) * q1)

cpc0 = c0 / J0
cpcN = (C + A['N'] * c1) / (A['N'] * J1)
cm = c0 * J1 / J0 - c1  # break-even exists only if J1/J0 > c1/c0
Nstar_cpc = C / cm if cm > 0 else math.inf
vm = (J1 - J0) * A['V'] - (c1 - c0)
Nstar_val = C / vm if vm > 0 else math.inf

tpc_mult = (q1 / J1) / (q0 / J0)
demand_mult = (cpcN / cpc0) ** (-A['eps']) * tpc_mult

# cache hits: counted as tokens, but no prefill FLOPs
cached_q = A['x'] * A['cache'] if A['edit'] == 'evidence-rewiring' else 0.0
tok_cached = (props * P['Qscore'] + P['Qfb'] * (P['T'] - 1)) * cached_q
flops = 2 * (A['p_params'] * 1e9 * tok_prop + A['s_params'] * 1e9 * (tok_solver - tok_cached))
gpu_h = flops / (A['tflops'] * 1e12 * A['mfu']) / 3600

t_prop = cost(A['pin'], A['pout'], A['t_in'], A['t_out'])
out = dict(
    costPerQuerySeed=c0, costPerQueryAdapted=c1, adaptCost=C,
    adaptProposerCost=C_prop, adaptScoringCost=C_score, adaptFeedbackCost=C_fb,
    adaptTokens=tok_prop + tok_solver, cpcSeed=cpc0, cpcAdaptedAtVolume=cpcN,
    breakEvenVolumeCpc=Nstar_cpc, breakEvenVolumeValue=Nstar_val,
    tokensPerQueryMultiplier=q1 / q0, tokensPerCorrectMultiplier=tpc_mult,
    totalTokenDemandMultiplier=demand_mult,
    proposerCostRatioTeacherVs4B=t_prop / c_prop,
    qualityPerDollarRatio4BVsTeacher=(0.62 / c_prop) / (0.56 / t_prop),
    cpcAdaptedAsymptotic=c1 / J1, netValueAtVolume=A['N'] * vm - C,
    adaptCachedTokens=tok_cached, adaptGpuHours=gpu_h, adaptKwh=gpu_h * A['kw'] * A['pue'],
)
json.dump(out, sys.stdout, indent=1)
