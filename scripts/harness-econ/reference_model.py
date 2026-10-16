"""Independent Python reference for src/lib/harnessEconomics.ts.

Recomputes the default case from first principles (no shared code) so the TS
port can be checked numerically:  python3 scripts/harness-econ/reference_model.py
"""
import json, math, sys

P = dict(  # paper protocol, arXiv:2609.35738 App. D.3 / Table 22
    T=10, G=8, Qfb=6, Qscore=64, k0=4,
)
A = dict(  # labelled assumptions (paper reports no token counts)
    k1=5, tin=1800, tout=200, pin=7000, pout=6000,
    s_in=0.05, s_out=0.40,      # Qwen3-8B OpenRouter $/M
    t_in=0.15, t_out=0.60,      # teacher-class $/M (assumption)
    N=100_000, V=0.01, eps=1.0,
    p_params=4, s_params=8, t_params=35, tflops=989, mfu=0.2, kw=0.7, pue=1.3,
)
J0, J1 = 0.1438, 0.27  # MuSiQue seed (Table 23), ten-round mean (§5.3)

def cost(i, o, pi, po): return (i * pi + o * po) / 1e6

c_call = cost(A['tin'], A['tout'], A['s_in'], A['s_out'])
c0, c1 = P['k0'] * c_call, A['k1'] * c_call
tok_call = A['tin'] + A['tout']
q0, q1 = P['k0'] * tok_call, A['k1'] * tok_call

props = P['T'] * P['G']
c_prop = cost(A['pin'], A['pout'], A['s_in'], A['s_out'])
C_prop = props * c_prop
C_score = props * P['Qscore'] * c1
C_fb = P['Qfb'] * (c0 + (P['T'] - 1) * c1)
C = C_prop + C_score + C_fb

tok_prop = props * (A['pin'] + A['pout'])
tok_solver = props * P['Qscore'] * q1 + P['Qfb'] * (q0 + (P['T'] - 1) * q1)

cpc0 = c0 / J0
cpcN = (C + A['N'] * c1) / (A['N'] * J1)
Nstar_cpc = C / (c0 * J1 / J0 - c1)
vm = (J1 - J0) * A['V'] - (c1 - c0)
Nstar_val = C / vm if vm > 0 else math.inf

tpc_mult = (q1 / J1) / (q0 / J0)
demand_mult = (cpcN / cpc0) ** (-A['eps']) * tpc_mult

flops = 2 * (A['p_params'] * 1e9 * tok_prop + A['s_params'] * 1e9 * tok_solver)
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
    adaptGpuHours=gpu_h, adaptKwh=gpu_h * A['kw'] * A['pue'],
)
json.dump(out, sys.stdout, indent=1)
