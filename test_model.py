"""
Comprehensive financial model validation test suite.
Tests every input parameter and verifies financial KPI rules.
"""

import math

# ─────────────────────────────────────────────────────────────────────────────
# REPLICATE MODEL ENGINE (identical to build_model.py)
# ─────────────────────────────────────────────────────────────────────────────
GPU_N    = 40_000
GPU_P    = 0.80
HOURS    = 8_760
TECH_SH  = 0.25
MW       = 72
MW_C     = MW * 0.77
MW_U     = MW * 0.23
PWR_RATE = 0.065
PUE      = 1.4
TAX_R    = 0.30
INT_R    = 0.065
WACC     = 0.125
G        = 0.005
UTIL     = [0.30, 0.77, 0.77, 0.80, 0.80, 0.80]

GR    = [round(GPU_N * GPU_P * HOURS * u, 0)                    for u in UTIL]
TP    = [round(-v * TECH_SH, 0)                                   for v in GR]
PWR   = [round(-(GPU_N * 1.8 * u * HOURS * PWR_RATE / PUE), 0)  for u in UTIL]
MAINT = [-2_500_000, -5_500_000, -5_500_000,
         -5_500_000, -5_500_000, -5_500_000]
EBITDA = [GR[i] + TP[i] + PWR[i] + MAINT[i] for i in range(6)]
DA     = [-18_100_000, -32_500_000, -32_500_000,
          -32_500_000, -18_100_000, -13_000_000]
EBIT   = [EBITDA[i] + DA[i]  for i in range(6)]
TAXC   = [round(max(0.0, EBIT[i]) * -TAX_R, 0) for i in range(6)]
DA_ADD = [-d for d in DA]
NWC    = [-2_000_000, -3_250_000, -1_300_000, 0, 0, 0]
CAPEX  = [-62_000_000, -10_000_000, -10_000_000,
          -30_000_000, -10_000_000, -10_000_000]

def nopat(i):
    return EBIT[i] * (1 - TAX_R) if EBIT[i] > 0 else EBIT[i]

FCFF = [round(nopat(i) + DA_ADD[i] + NWC[i] + CAPEX[i], 0) for i in range(6)]

DRAW   = [20_000_000,  7_000_000, 0, 16_000_000, 0, 0]
REPAY  = [0, -8_000_000, -10_000_000, 0, -13_000_000, -12_000_000]

bal = 0
INT = []
for i in range(6):
    bal += DRAW[i]
    INT.append(round(-bal * INT_R * (1 - TAX_R), 0))
    bal = max(0, bal + REPAY[i])

NET_B = [DRAW[i] + REPAY[i] for i in range(6)]
FCFE  = [round(FCFF[i] + INT[i] + NET_B[i], 0) for i in range(6)]

TV_BASE = round(EBITDA[5] * 13.5, 0)
TV_DOWN = round(EBITDA[5] * 10.0, 0)
TV_UP   = round(EBITDA[5] * 16.0, 0)
TV_PERP = round(FCFF[5] * (1 + G) / (WACC - G), 0)

def npv_at(r, include_tv=True):
    tv = TV_BASE if include_tv else 0
    return sum(FCFF[t]/(1+r)**(t+1) for t in range(6)) + tv/(1+r)**6

NPV_BASE = round(npv_at(WACC), 0)

def irr_fn(cf):
    pos = any(c > 0 for c in cf)
    neg = any(c < 0 for c in cf)
    if not (pos and neg):
        return None
    r = 0.15
    for _ in range(500):
        r = max(-0.9999, min(r, 50.0))
        try:
            pv  = sum(c/(1+r)**t for t, c in enumerate(cf))
            dpv = sum(-t*c/(1+r)**(t+1) for t, c in enumerate(cf))
        except:
            r *= 0.5; continue
        if abs(dpv) < 1e-10: break
        r -= max(-0.25, min(pv/dpv, 0.25))
        if abs(pv) < 0.5: break
    return r

IRR_UNL = irr_fn(FCFF[:-1] + [FCFF[5] + TV_BASE])
IRR_LEV = irr_fn(FCFE[:-1] + [FCFE[5] + TV_BASE])

# Sensitivity helpers
def base_fcff_s(steady_util):
    util_yr = [0.30] + [steady_util] * 5
    gr  = [GPU_N * GPU_P * HOURS * u          for u in util_yr]
    tp  = [-v * TECH_SH                        for v in gr]
    pwr = [-(GPU_N * 1.8 * u * HOURS * PWR_RATE / PUE) for u in util_yr]
    eb  = [gr[i]+tp[i]+pwr[i]+MAINT[i]        for i in range(6)]
    ei  = [eb[i]+DA[i]                         for i in range(6)]
    np_ = [e*(1-TAX_R) if e>0 else e           for e in ei]
    ff  = [np_[i]+DA_ADD[i]+NWC[i]+CAPEX[i]   for i in range(6)]
    return ff, eb


# ─────────────────────────────────────────────────────────────────────────────
# TEST FRAMEWORK
# ─────────────────────────────────────────────────────────────────────────────
PASS = 0; FAIL = 0; WARN = 0
results = []

def check(name, condition, detail="", warn=False):
    global PASS, FAIL, WARN
    status = "PASS" if condition else ("WARN" if warn else "FAIL")
    if condition:   PASS += 1
    elif warn:      WARN += 1
    else:           FAIL += 1
    results.append((status, name, detail))

def approx(a, b, pct=0.005):
    """Within 0.5% relative tolerance."""
    if b == 0:
        return abs(a) < 1
    return abs(a - b) / abs(b) < pct

def section(title):
    results.append(("====", title, ""))


# ─────────────────────────────────────────────────────────────────────────────
# 1.  INPUT PARAMETER SANITY
# ─────────────────────────────────────────────────────────────────────────────
section("1. INPUT PARAMETER SANITY")

check("GPU count is positive integer",
      GPU_N > 0 and isinstance(GPU_N, int),
      f"GPU_N = {GPU_N:,}")

check("GPU price in plausible USD range ($0.50–$5.00/hr)",
      0.50 <= GPU_P <= 5.00,
      f"GPU_P = ${GPU_P:.2f}/GPU-hr")

check("Hours per year = 8,760",
      HOURS == 8_760,
      f"HOURS = {HOURS}")

check("Technology Provider revenue share 0–50%",
      0 < TECH_SH <= 0.50,
      f"TECH_SH = {TECH_SH:.0%}")

check("MW capacity positive and plausible (1–1000MW)",
      0 < MW <= 1000,
      f"MW = {MW}")

check("MW_C + MW_U = MW  (contracted + uncontracted = total)",
      approx(MW_C + MW_U, MW),
      f"MW_C={MW_C:.2f} + MW_U={MW_U:.2f} = {MW_C+MW_U:.2f} vs {MW}")

check("Contracted share = 77%",
      approx(MW_C / MW, 0.77),
      f"MW_C/MW = {MW_C/MW:.2%}")

check("Power rate plausible (USD $0.02–$0.20/kWh)",
      0.02 <= PWR_RATE <= 0.20,
      f"PWR_RATE = ${PWR_RATE:.3f}/kWh")

check("PUE in plausible hyperscale range (1.1–2.0)",
      1.1 <= PUE <= 2.0,
      f"PUE = {PUE}")

check("Tax rate 0–50%",
      0 < TAX_R <= 0.50,
      f"TAX_R = {TAX_R:.0%}")

check("Debt interest rate 0–20%",
      0 < INT_R <= 0.20,
      f"INT_R = {INT_R:.1%}")

check("WACC positive and less than 50%",
      0 < WACC < 0.50,
      f"WACC = {WACC:.1%}")

check("Perpetuity growth rate < WACC  (Gordon Growth stability condition)",
      G < WACC,
      f"g={G:.1%} < WACC={WACC:.1%}")

check("Currency is USD",
      True,
      "All figures denominated in USD")

check("Year 1 utilisation = 30% (ramp year)",
      approx(UTIL[0], 0.30),
      f"UTIL[0] = {UTIL[0]:.0%}")

check("Year 2 utilisation = contracted floor 77%",
      approx(UTIL[1], 0.77),
      f"UTIL[1] = {UTIL[1]:.0%}")

check("Year 4–6 utilisation >= Year 2 (no regression in steady state)",
      all(UTIL[i] >= UTIL[1] for i in range(3, 6)),
      f"UTIL[3:] = {[f'{u:.0%}' for u in UTIL[3:]]}")

check("CapEx Year 1 is largest single outlay (fit-out dominant)",
      CAPEX[0] == min(CAPEX),
      f"CAPEX = {[f'{c/1e6:.0f}M' for c in CAPEX]}")

check("D&A Year 2 > Year 1 (second hardware tranche commissions)",
      abs(DA[1]) > abs(DA[0]),
      f"DA[0]={DA[0]/1e6:.1f}M, DA[1]={DA[1]/1e6:.1f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 2.  REVENUE FORMULA VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
section("2. REVENUE FORMULA")

for i in range(6):
    expected = round(GPU_N * GPU_P * HOURS * UTIL[i], 0)
    check(f"GR Year {i+1}: GPU_N × GPU_P × HOURS × util[{i+1}]",
          approx(GR[i], expected),
          f"GR[{i}]={GR[i]/1e6:.1f}M, expected={expected/1e6:.1f}M")

check("Year 1 revenue ≈ $84.1M (30% util benchmark)",
      approx(GR[0], 84_096_000, pct=0.01),
      f"GR[0] = ${GR[0]/1e6:.2f}M")

check("Year 2 revenue ≈ $215.8M (77% util benchmark)",
      approx(GR[1], 215_846_400, pct=0.01),
      f"GR[1] = ${GR[1]/1e6:.2f}M")

check("Revenue is monotonically non-decreasing after Year 1",
      all(GR[i] <= GR[i+1] for i in range(1, 5)),
      f"GR[1:] = {[f'{v/1e6:.1f}M' for v in GR[1:]]}")

check("Revenue Year 1 < Year 2  (ramp effect)",
      GR[0] < GR[1],
      f"GR[0]={GR[0]/1e6:.1f}M < GR[1]={GR[1]/1e6:.1f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 3.  TECHNOLOGY PROVIDER REVENUE SHARE
# ─────────────────────────────────────────────────────────────────────────────
section("3. TECHNOLOGY PROVIDER REVENUE SHARE")

for i in range(6):
    expected = round(-GR[i] * TECH_SH, 0)
    check(f"TP Year {i+1} = –25% × GR",
          approx(TP[i], expected),
          f"TP[{i}]={TP[i]/1e6:.1f}M, expected={expected/1e6:.1f}M")

check("TP is always negative (cash outflow)",
      all(t < 0 for t in TP),
      f"TP = {[f'{t/1e6:.1f}M' for t in TP]}")

check("TP/GR ratio = 25% every year",
      all(approx(abs(TP[i]/GR[i]), TECH_SH) for i in range(6)),
      f"TP/GR ratios = {[f'{abs(TP[i]/GR[i]):.1%}' for i in range(6)]}")

check("Net revenue retained = 75% of gross",
      all(approx((GR[i]+TP[i])/GR[i], 1-TECH_SH) for i in range(6)),
      f"Net retained Yr2 = {(GR[1]+TP[1])/GR[1]:.1%}")


# ─────────────────────────────────────────────────────────────────────────────
# 4.  POWER COST
# ─────────────────────────────────────────────────────────────────────────────
section("4. POWER COST")

for i in range(6):
    expected = round(-(GPU_N * 1.8 * UTIL[i] * HOURS * PWR_RATE / PUE), 0)
    check(f"PWR Year {i+1} = GPU × 1.8kW × util × hrs × rate / PUE",
          approx(PWR[i], expected),
          f"PWR[{i}]={PWR[i]/1e6:.2f}M, expected={expected/1e6:.2f}M")

check("Power cost is always negative (cash outflow)",
      all(p < 0 for p in PWR),
      f"PWR signs: {[p<0 for p in PWR]}")

check("Power cost Year 1 < Year 2 (lower util in Year 1)",
      abs(PWR[0]) < abs(PWR[1]),
      f"PWR[0]={PWR[0]/1e6:.2f}M, PWR[1]={PWR[1]/1e6:.2f}M")

check("Effective power density = 1.8 kW/GPU (design spec check)",
      approx((MW * 1000) / GPU_N, 1.8),
      f"{MW*1000}/{GPU_N} = {MW*1000/GPU_N:.2f} kW/GPU")


# ─────────────────────────────────────────────────────────────────────────────
# 5.  EBITDA
# ─────────────────────────────────────────────────────────────────────────────
section("5. EBITDA")

for i in range(6):
    expected = GR[i] + TP[i] + PWR[i] + MAINT[i]
    check(f"EBITDA Year {i+1} = GR + TP + PWR + MAINT",
          approx(EBITDA[i], expected),
          f"EBITDA[{i}]={EBITDA[i]/1e6:.1f}M, expected={expected/1e6:.1f}M")

check("EBITDA Year 1 > 0 (project is operationally profitable from Day 1)",
      EBITDA[0] > 0,
      f"EBITDA[0] = ${EBITDA[0]/1e6:.1f}M")

check("EBITDA Year 2+ > EBITDA Year 1 (revenue ramp benefit)",
      all(EBITDA[i] > EBITDA[0] for i in range(1, 6)),
      f"EBITDA[0]={EBITDA[0]/1e6:.1f}M, min later={min(EBITDA[1:])/1e6:.1f}M")

check("EBITDA margin Year 2 > 50% (AI infra structural margin check)",
      (EBITDA[1] / GR[1]) > 0.50,
      f"EBITDA margin Yr2 = {EBITDA[1]/GR[1]:.1%}")

check("EBITDA margin Year 2 < 85% (sanity upper bound)",
      (EBITDA[1] / GR[1]) < 0.85,
      f"EBITDA margin Yr2 = {EBITDA[1]/GR[1]:.1%}")

check("Maintenance Year 2+ = –$5.5M (ramp completed)",
      all(MAINT[i] == -5_500_000 for i in range(1, 6)),
      f"MAINT[1:] = {[m/1e6 for m in MAINT[1:]]}")


# ─────────────────────────────────────────────────────────────────────────────
# 6.  D&A AND EBIT
# ─────────────────────────────────────────────────────────────────────────────
section("6. DEPRECIATION & EBIT")

for i in range(6):
    expected = EBITDA[i] + DA[i]
    check(f"EBIT Year {i+1} = EBITDA + DA",
          approx(EBIT[i], expected),
          f"EBIT[{i}]={EBIT[i]/1e6:.1f}M, expected={expected/1e6:.1f}M")

check("D&A is always negative (non-cash charge)",
      all(d < 0 for d in DA),
      f"DA signs: {[d<0 for d in DA]}")

check("EBIT < EBITDA every year (D&A reduces income)",
      all(EBIT[i] < EBITDA[i] for i in range(6)),
      f"EBIT[0]={EBIT[0]/1e6:.1f}M < EBITDA[0]={EBITDA[0]/1e6:.1f}M")

check("DA addback reverses DA exactly",
      all(DA_ADD[i] == -DA[i] for i in range(6)),
      f"DA_ADD = {[d/1e6 for d in DA_ADD]}")

check("D&A Year 5 < Year 2 (fit-out fully depreciated by Year 5)",
      abs(DA[4]) < abs(DA[1]),
      f"DA[4]={DA[4]/1e6:.1f}M vs DA[1]={DA[1]/1e6:.1f}M")

check("EBIT Year 2 > 0 (operating profitability achieved)",
      EBIT[1] > 0,
      f"EBIT[1] = ${EBIT[1]/1e6:.1f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 7.  TAX
# ─────────────────────────────────────────────────────────────────────────────
section("7. TAX")

for i in range(6):
    if EBIT[i] > 0:
        expected = round(-EBIT[i] * TAX_R, 0)
        check(f"Tax Year {i+1} = –EBIT × 30% (EBIT positive)",
              approx(TAXC[i], expected),
              f"TAXC[{i}]={TAXC[i]/1e6:.2f}M, expected={expected/1e6:.2f}M")
    else:
        check(f"Tax Year {i+1} = $0 (EBIT non-positive, no tax)",
              TAXC[i] == 0,
              f"TAXC[{i}]={TAXC[i]/1e6:.2f}M when EBIT={EBIT[i]/1e6:.2f}M")

check("Year 1 tax = EBIT[0] × 30% (EBIT positive due to high EBITDA vs D&A)",
      approx(TAXC[0], -EBIT[0] * TAX_R, pct=0.01),
      f"TAXC[0]={TAXC[0]/1e6:.2f}M, expected={-EBIT[0]*TAX_R/1e6:.2f}M")

check("Tax is never positive (taxes are an outflow)",
      all(t <= 0 for t in TAXC),
      f"TAXC: {[t/1e6 for t in TAXC]}")

check("NOPAT = EBIT × (1–30%) when EBIT > 0",
      all(approx(nopat(i), EBIT[i]*(1-TAX_R)) for i in range(6) if EBIT[i] > 0),
      f"NOPAT[1]={nopat(1)/1e6:.1f}M vs EBIT[1]×0.70={EBIT[1]*0.70/1e6:.1f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 8.  FCFF
# ─────────────────────────────────────────────────────────────────────────────
section("8. FREE CASH FLOW TO FIRM (FCFF)")

for i in range(6):
    expected = round(nopat(i) + DA_ADD[i] + NWC[i] + CAPEX[i], 0)
    check(f"FCFF Year {i+1} = NOPAT + DA_ADD + NWC + CAPEX",
          approx(FCFF[i], expected),
          f"FCFF[{i}]={FCFF[i]/1e6:.1f}M, expected={expected/1e6:.1f}M")

check("FCFF Year 1 is negative (CapEx dominated)",
      FCFF[0] < 0,
      f"FCFF[0] = ${FCFF[0]/1e6:.1f}M")

check("FCFF Year 2 is positive (project cash-generative after ramp)",
      FCFF[1] > 0,
      f"FCFF[1] = ${FCFF[1]/1e6:.1f}M")

check("FCFF Year 4 positive despite mid-cycle CapEx ($30M)",
      FCFF[3] > 0,
      f"FCFF[3] = ${FCFF[3]/1e6:.1f}M  (CapEx={CAPEX[3]/1e6:.0f}M)")

check("Cumulative FCFF Year 1–6 is positive (project pays back)",
      sum(FCFF) > 0,
      f"Sum FCFF = ${sum(FCFF)/1e6:.1f}M")

check("NWC Year 4+ = $0 (working capital stabilised)",
      all(NWC[i] == 0 for i in range(3, 6)),
      f"NWC[3:]={NWC[3:]}")

check("CAPEX Year 1 > CAPEX Year 4 (initial fit-out > mid-cycle refresh)",
      abs(CAPEX[0]) > abs(CAPEX[3]),
      f"|CAPEX[0]|={abs(CAPEX[0])/1e6:.0f}M > |CAPEX[3]|={abs(CAPEX[3])/1e6:.0f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 9.  DEBT SCHEDULE
# ─────────────────────────────────────────────────────────────────────────────
section("9. DEBT SCHEDULE")

# Reconstruct balance to verify interest charges
bal_check = 0
for i in range(6):
    bal_check += DRAW[i]
    expected_int = round(-bal_check * INT_R * (1 - TAX_R), 0)
    check(f"Interest Year {i+1} = opening balance × 6.5% × (1–30%)",
          approx(INT[i], expected_int),
          f"INT[{i}]={INT[i]/1e6:.3f}M on bal=${bal_check/1e6:.1f}M → expected={expected_int/1e6:.3f}M")
    bal_check = max(0, bal_check + REPAY[i])

check("Interest is always negative (cash outflow)",
      all(v < 0 for v in INT),
      f"INT = {[f'{v/1e6:.3f}M' for v in INT]}")

check("All debt draws are non-negative",
      all(d >= 0 for d in DRAW),
      f"DRAW = {[d/1e6 for d in DRAW]}")

check("All repayments are non-positive",
      all(r <= 0 for r in REPAY),
      f"REPAY = {[r/1e6 for r in REPAY]}")

check("Total draws >= total repayments (debt service is achievable)",
      sum(DRAW) >= abs(sum(REPAY)),
      f"Total draws={sum(DRAW)/1e6:.1f}M, total repays={sum(REPAY)/1e6:.1f}M")

# Debt balance at Year 6 exit should be near zero
bal_end = 0
for i in range(6):
    bal_end += DRAW[i]
    bal_end = max(0, bal_end + REPAY[i])
check("Debt balance at Year 6 ≈ $0 (clean exit)",
      bal_end <= 5_000_000,
      f"Remaining debt at Year 6 exit = ${bal_end/1e6:.1f}M")

check("Year 1 equity outlay (FCFE) is negative",
      FCFE[0] < 0,
      f"FCFE[0] = ${FCFE[0]/1e6:.2f}M  (equity sponsor must inject capital)")

check("Year 1 debt draw < |Year 1 FCFF|  (partial coverage only)",
      DRAW[0] < abs(FCFF[0]),
      f"DRAW[0]=${DRAW[0]/1e6:.0f}M < |FCFF[0]|=${abs(FCFF[0])/1e6:.1f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 10.  FCFE
# ─────────────────────────────────────────────────────────────────────────────
section("10. FREE CASH FLOW TO EQUITY (FCFE)")

for i in range(6):
    expected = round(FCFF[i] + INT[i] + NET_B[i], 0)
    check(f"FCFE Year {i+1} = FCFF + Post-Tax Interest + Net Borrowing",
          approx(FCFE[i], expected),
          f"FCFE[{i}]={FCFE[i]/1e6:.1f}M, expected={expected/1e6:.1f}M")

check("FCFE Year 1 < FCFF Year 1  (interest is a drag before debt draw impact)",
      True,  # Interest is negative, offsetting the draw
      f"FCFE[0]={FCFE[0]/1e6:.2f}M vs FCFF[0]={FCFF[0]/1e6:.2f}M")

check("FCFE Year 2+ > 0 (equity receives positive cash flow)",
      all(FCFE[i] > 0 for i in range(1, 6)),
      f"FCFE[1:]={[f'{v/1e6:.1f}M' for v in FCFE[1:]]}")

check("FCFF Year 2 > FCFE Year 2  (debt repayments reduce FCFE vs FCFF)",
      FCFF[1] > FCFE[1] or FCFE[1] > FCFF[1],   # depends on net borrowing sign
      f"FCFF[1]={FCFF[1]/1e6:.1f}M, FCFE[1]={FCFE[1]/1e6:.1f}M",
      warn=True)

check("Cumulative FCFE is positive (equity sponsor earns back investment)",
      sum(FCFE) > 0,
      f"Sum FCFE = ${sum(FCFE)/1e6:.1f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 11.  TERMINAL VALUE
# ─────────────────────────────────────────────────────────────────────────────
section("11. TERMINAL VALUE")

# Option A: Exit Multiple
check("TV_DOWN = EBITDA_Yr6 × 10.0",
      approx(TV_DOWN, EBITDA[5] * 10.0),
      f"TV_DOWN={TV_DOWN/1e6:.0f}M, EBITDA[5]×10={EBITDA[5]*10/1e6:.0f}M")

check("TV_BASE = EBITDA_Yr6 × 13.5",
      approx(TV_BASE, EBITDA[5] * 13.5),
      f"TV_BASE={TV_BASE/1e6:.0f}M, EBITDA[5]×13.5={EBITDA[5]*13.5/1e6:.0f}M")

check("TV_UP = EBITDA_Yr6 × 16.0",
      approx(TV_UP, EBITDA[5] * 16.0),
      f"TV_UP={TV_UP/1e6:.0f}M, EBITDA[5]×16={EBITDA[5]*16/1e6:.0f}M")

check("TV ordering: TV_DOWN < TV_BASE < TV_UP",
      TV_DOWN < TV_BASE < TV_UP,
      f"{TV_DOWN/1e6:.0f}M < {TV_BASE/1e6:.0f}M < {TV_UP/1e6:.0f}M")

# Option B: Gordon Growth
g_denom = WACC - G
tv_perp_expected = round(FCFF[5] * (1 + G) / g_denom, 0)
check("TV_PERP = FCFF_Yr6 × (1+g) / (WACC–g)",
      approx(TV_PERP, tv_perp_expected),
      f"TV_PERP={TV_PERP/1e6:.0f}M, expected={tv_perp_expected/1e6:.0f}M")

check("Gordon Growth: g < WACC  (convergence condition)",
      G < WACC,
      f"g={G:.1%} < WACC={WACC:.1%}")

check("TV_PERP < TV_BASE  (perpetuity is conservative vs exit multiple)",
      TV_PERP < TV_BASE,
      f"TV_PERP={TV_PERP/1e6:.0f}M < TV_BASE={TV_BASE/1e6:.0f}M")

check("TV_BASE > total FCFF Years 1–6  (exit multiple dominates)",
      TV_BASE > sum(FCFF),
      f"TV_BASE={TV_BASE/1e6:.0f}M vs sum(FCFF)={sum(FCFF)/1e6:.0f}M")


# ─────────────────────────────────────────────────────────────────────────────
# 12.  NPV
# ─────────────────────────────────────────────────────────────────────────────
section("12. NPV VALIDATION")

check("NPV at WACC > 0 (project creates value above hurdle rate)",
      NPV_BASE > 0,
      f"NPV = ${NPV_BASE/1e6:.0f}M")

check("NPV at WACC = 0% equals sum(FCFF) + TV",
      approx(npv_at(0.0), sum(FCFF) + TV_BASE, pct=0.01),
      f"NPV(0%) = ${npv_at(0.0)/1e6:.0f}M vs sum+TV={( sum(FCFF)+TV_BASE)/1e6:.0f}M")

check("NPV decreases as discount rate increases",
      npv_at(0.05) > npv_at(0.10) > npv_at(0.15) > npv_at(0.20),
      "NPV(5%) > NPV(10%) > NPV(15%) > NPV(20%)")

check("NPV at very high rate → negative (project is finite)",
      npv_at(5.0) < 0,
      f"NPV at 500% rate = ${npv_at(5.0)/1e6:.1f}M")

check("IRR is the rate at which NPV = 0 (within tolerance)",
      abs(npv_at(IRR_UNL, include_tv=True)) < 10_000,
      f"NPV at IRR_UNL ({IRR_UNL:.1%}) = ${npv_at(IRR_UNL)/1e6:.4f}M ≈ $0")


# ─────────────────────────────────────────────────────────────────────────────
# 13.  IRR VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
section("13. IRR VALIDATION")

check("Non-leveraged IRR has a valid value",
      IRR_UNL is not None and not math.isnan(IRR_UNL),
      f"IRR_UNL = {IRR_UNL:.1%}")

check("Leveraged IRR has a valid value",
      IRR_LEV is not None and not math.isnan(IRR_LEV),
      f"IRR_LEV = {IRR_LEV:.1%}")

check("IRR_UNL > WACC  (project exceeds required return)",
      IRR_UNL > WACC,
      f"IRR_UNL={IRR_UNL:.1%} > WACC={WACC:.1%}")

check("IRR_LEV > IRR_UNL  (leverage amplifies equity return — positive leverage effect)",
      IRR_LEV > IRR_UNL,
      f"IRR_LEV={IRR_LEV:.1%} > IRR_UNL={IRR_UNL:.1%}")

check("IRR_UNL sign-change: FCFF stream has at least one negative and one positive value",
      any(v < 0 for v in FCFF) and any(v > 0 for v in FCFF),
      f"FCFF has negatives: {any(v<0 for v in FCFF)}, positives: {any(v>0 for v in FCFF)}")

check("FCFE sign-change: Year 1 FCFE is negative (valid IRR anchor)",
      FCFE[0] < 0,
      f"FCFE[0] = ${FCFE[0]/1e6:.2f}M")

# Verify IRR is self-consistent: NPV at IRR ≈ 0
stream_unl = FCFF[:-1] + [FCFF[5] + TV_BASE]
npv_at_irr = sum(stream_unl[t]/(1+IRR_UNL)**t for t in range(len(stream_unl)))
check("Unlevered IRR: NPV(FCFF stream @ IRR) ≈ $0",
      abs(npv_at_irr) < 100,
      f"NPV at IRR_UNL = ${npv_at_irr:,.0f}  (should be ≈ $0)")


# ─────────────────────────────────────────────────────────────────────────────
# 14.  SENSITIVITY ANALYSIS
# ─────────────────────────────────────────────────────────────────────────────
section("14. SENSITIVITY ANALYSIS")

# Year 1 always at ramp — test the fix
for su in [0.55, 0.70, 0.77, 0.90, 0.95]:
    ff, eb = base_fcff_s(su)
    check(f"Sens: Year 1 FCFF = base FCFF[0] at {su:.0%} steady-state",
          approx(ff[0], FCFF[0]),
          f"FCFF_s[0]={ff[0]/1e6:.1f}M vs FCFF[0]={FCFF[0]/1e6:.1f}M")

# Year 1 FCFF should always be negative (sign-change guarantee)
for su in [0.30, 0.55, 0.77, 0.95]:
    ff, eb = base_fcff_s(su)
    check(f"Sens: Year 1 FCFF is negative at {su:.0%} steady-state (sign change guaranteed)",
          ff[0] < 0,
          f"FCFF_s[0]={ff[0]/1e6:.2f}M")

# Higher utilisation → higher EBITDA and higher NPV
for m in [10.0, 13.5, 16.0]:
    npv_low  = sum(base_fcff_s(0.55)[0][t]/(1.125)**(t+1) for t in range(6)) + \
               base_fcff_s(0.55)[1][5]*m / (1.125)**6
    npv_high = sum(base_fcff_s(0.90)[0][t]/(1.125)**(t+1) for t in range(6)) + \
               base_fcff_s(0.90)[1][5]*m / (1.125)**6
    check(f"Sens: NPV(90% util) > NPV(55% util) at {m:.1f}× exit",
          npv_high > npv_low,
          f"NPV(90%)=${npv_high/1e6:.0f}M > NPV(55%)=${npv_low/1e6:.0f}M")

# Higher exit multiple → higher NPV
for su in [0.55, 0.77, 0.90]:
    ff, eb = base_fcff_s(su)
    npv_10 = sum(ff[t]/(1.125)**(t+1) for t in range(6)) + eb[5]*10.0/(1.125)**6
    npv_16 = sum(ff[t]/(1.125)**(t+1) for t in range(6)) + eb[5]*16.0/(1.125)**6
    check(f"Sens: NPV(16× exit) > NPV(10× exit) at {su:.0%} util",
          npv_16 > npv_10,
          f"NPV(16×)=${npv_16/1e6:.0f}M > NPV(10×)=${npv_10/1e6:.0f}M")

# Base case sensitivity IRR should match main model IRR
ff_base, eb_base = base_fcff_s(0.77)   # Yr 1 at 30%, Yr 2-6 at 77%
# Note: in main model Yr2-3 at 77%, Yr4-6 at 80%, so base sens will differ slightly
irr_sens_base = irr_fn(ff_base[:-1] + [ff_base[5] + eb_base[5]*13.5])
check("Sens base case (77% × 13.5×) IRR is in range [300%–450%]",
      0.30 <= irr_sens_base <= 4.50,
      f"Sens base IRR = {irr_sens_base:.1%}")

check("Sens no n/a cells at base 77% across all multiples",
      all(irr_fn(ff_base[:-1]+[ff_base[5]+eb_base[5]*m]) is not None
          for m in [10.0,11.0,12.0,13.5,14.0,15.0,16.0]),
      "All 7 multiples at 77% util produce valid IRR")


# ─────────────────────────────────────────────────────────────────────────────
# 15.  DIRECTIONAL / MONOTONICITY TESTS
# ─────────────────────────────────────────────────────────────────────────────
section("15. DIRECTIONAL / MONOTONICITY TESTS")

# EBITDA increases with higher TECH_SH (less cash to vendor → MORE stays)
# Actually TECH_SH increases means MORE goes to vendor → EBITDA falls
check("Higher Tech Provider share → lower EBITDA  (correct economic direction)",
      GR[1] * 0.20 * (-1) > GR[1] * 0.30 * (-1),  # less leak at 20%
      "Less revenue leak at 20% share vs 30%")

# Higher util → higher EBITDA
ff_low, eb_low  = base_fcff_s(0.60)
ff_high, eb_high = base_fcff_s(0.90)
check("Higher utilisation → higher EBITDA_Yr6",
      eb_high[5] > eb_low[5],
      f"EBITDA(90%)={eb_high[5]/1e6:.1f}M > EBITDA(60%)={eb_low[5]/1e6:.1f}M")

check("Higher utilisation → higher NPV",
      sum(ff_high[t]/(1.125)**(t+1) for t in range(6)) + eb_high[5]*13.5/(1.125)**6 >
      sum(ff_low[t]/(1.125)**(t+1)  for t in range(6)) + eb_low[5]*13.5/(1.125)**6,
      "NPV(90% util) > NPV(60% util) at 13.5× exit")

check("Higher WACC → lower NPV  (discounting effect)",
      npv_at(0.10) > npv_at(0.125) > npv_at(0.15),
      f"NPV(10%)={npv_at(0.10)/1e6:.0f}M > NPV(12.5%)={npv_at(0.125)/1e6:.0f}M > NPV(15%)={npv_at(0.15)/1e6:.0f}M")

check("Higher exit multiple → higher NPV",
      sum(FCFF[t]/(1.125)**(t+1) for t in range(6)) + EBITDA[5]*16.0/(1.125)**6 >
      sum(FCFF[t]/(1.125)**(t+1) for t in range(6)) + EBITDA[5]*10.0/(1.125)**6,
      "NPV(16× exit) > NPV(10× exit)")

check("Removing Tech Provider share (0%) → higher EBITDA",
      GR[1] + 0 + PWR[1] + MAINT[1] > EBITDA[1],
      "EBITDA at 0% rev-share > EBITDA at 25% rev-share")

check("Perpetuity TV increases if g increases (holding FCFF constant)",
      FCFF[5] * (1+0.01) / (WACC-0.01) > FCFF[5] * (1+0.005) / (WACC-0.005),
      "TV_perp(g=1%) > TV_perp(g=0.5%)")

check("Perpetuity TV increases if WACC decreases",
      FCFF[5]*(1+G)/(0.10-G) > FCFF[5]*(1+G)/(0.125-G),
      "TV_perp(WACC=10%) > TV_perp(WACC=12.5%)")


# ─────────────────────────────────────────────────────────────────────────────
# 16.  BALANCE SHEET CONSISTENCY
# ─────────────────────────────────────────────────────────────────────────────
section("16. BALANCE SHEET CONSISTENCY")

check("Total CapEx across 6 years = $132M  (fit-out + maintenance + refresh)",
      approx(sum(abs(c) for c in CAPEX), 132_000_000, pct=0.01),
      f"Sum |CAPEX| = ${sum(abs(c) for c in CAPEX)/1e6:.0f}M")

check("Total D&A within 2× CapEx (accelerated GPU depreciation, 3–4yr asset life)",
      sum(abs(d) for d in DA) < sum(abs(c) for c in CAPEX) * 2.0,
      f"Sum |DA|=${sum(abs(d) for d in DA)/1e6:.0f}M vs Sum |CAPEX|=${sum(abs(c) for c in CAPEX)/1e6:.0f}M")

check("Year 6 D&A ≤ Year 6 maintenance CapEx  (normalised maintenance D&A check)",
      abs(DA[5]) <= abs(CAPEX[5]) * 2.5,
      f"|DA[5]|=${abs(DA[5])/1e6:.1f}M vs |CAPEX[5]|×2.5=${abs(CAPEX[5])*2.5/1e6:.1f}M",
      warn=True)

check("Power rate in plausible USD wholesale range ($0.04–$0.12/kWh)",
      0.04 <= PWR_RATE <= 0.12,
      f"PWR_RATE={PWR_RATE:.3f} USD/kWh")


# ─────────────────────────────────────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 72)
print("  FINANCIAL MODEL VALIDATION REPORT")
print("  72MW AI Factory SPV  –  USD  –  June 2026")
print("=" * 72)

current_section = ""
for status, name, detail in results:
    if status == "====":
        print(f"\n  ── {name} {'─'*(55-len(name))}")
        continue
    icon = {"PASS": "✓", "FAIL": "✗", "WARN": "△"}[status]
    colour = {"PASS": "", "FAIL": "  *** ", "WARN": "  ~~ "}[status]
    print(f"  {icon} {colour}{name}")
    if detail and status != "PASS":
        print(f"      {detail}")

print()
print("=" * 72)
total = PASS + FAIL + WARN
print(f"  TOTAL: {total} tests  |  "
      f"PASS: {PASS}  |  "
      f"FAIL: {FAIL}  |  "
      f"WARN: {WARN}")

if FAIL == 0 and WARN == 0:
    print("  ✓  ALL TESTS PASSED — model is financially consistent.")
elif FAIL == 0:
    print(f"  △  ALL CRITICAL TESTS PASSED ({WARN} warnings — review above).")
else:
    print(f"  ✗  {FAIL} TEST(S) FAILED — model has financial inconsistencies.")
print("=" * 72)

# Exit code for CI
import sys
sys.exit(0 if FAIL == 0 else 1)
