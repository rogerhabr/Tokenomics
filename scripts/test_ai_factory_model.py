"""Verification harness for AI_Factory_32x_Rubin_AbuDhabi.xlsx.

Re-implements the entire model independently in pure Python (no openpyxl
formula evaluation involved) and compares ~50 key cells of the recalculated
workbook against the expected values, including all 16 sensitivity-engine
IRRs. Run scripts/create_ai_factory_model.py and the xlsx recalc step first.

Exit code 0 = all checks pass.
"""

import sys

import openpyxl

from create_ai_factory_model import (
    DEBT_RATIOS,
    FILE_NAME,
    LOCATION_INDEX,
    TARIFFS,
    YEAR_COLS,
    build_workbook,
)

# ---------------------------------------------------------------------------
# Independent model implementation
# ---------------------------------------------------------------------------
INP = dict(
    location="Abu Dhabi, UAE",
    vr_count=32, vr_kw=227.0, vr_cool="Liquid",
    net_count=6, net_kw=100.0, net_cool="Air",
    sto_count=10, sto_kw=40.0, sto_cool="Air",
    liq_oh=0.05, air_oh=0.28,
    gpus_per_rack=72,
    pue=1.08, util=0.85, uptime=0.995, tokens_gpu_s=1800, token_share=0.30,
    tariff=0.06, tariff_esc=0.02, capex=139_500_000, resid_pct=0.10,
    debt_ratio=0.80, rate=0.065, tenor=5, tax=0.09, gidlr=0.30,
    hurdle=0.15, fixed_opex=10_877_000, opex_esc=0.03,
    lease_rev=58_800_000, token_rev=25_200_000, ramp=0.90,
    lease_esc=0.00, tok_decline=0.15, tok_growth=0.25,
    wue=0.15, carbon=0.39,
)


def pmt(rate, n, pv):
    return pv * rate / (1 - (1 + rate) ** -n)


def irr(cashflows, lo=-0.99, hi=10.0, tol=1e-10):
    def npv(r):
        return sum(cf / (1 + r) ** t for t, cf in enumerate(cashflows))
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        raise ValueError("IRR not bracketed")
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < tol:
            return mid
        if f_lo * f_mid < 0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def compute_model(p):
    m = {}
    loads = {
        "vr": p["vr_count"] * p["vr_kw"],
        "net": p["net_count"] * p["net_kw"],
        "sto": p["sto_count"] * p["sto_kw"],
    }
    it_kw = sum(loads.values())
    m["it_kw"] = it_kw
    liquid_kw = sum(loads[k] for k in loads
                    if p[f"{k}_cool"] == "Liquid")
    air_kw = it_kw - liquid_kw
    m["liquid_kw"] = liquid_kw
    m["liquid_racks"] = sum(
        p[f"{k}_count"] for k in ("vr", "net", "sto")
        if p[f"{k}_cool"] == "Liquid")
    m["flow_lpm"] = 195.0 * m["liquid_racks"]
    m["mlc"] = (liquid_kw * p["liq_oh"] + air_kw * p["air_oh"]) / it_kw
    loc = LOCATION_INDEX[p["location"]]
    m["zone"], m["mlc_limit"], m["db20"], m["wb20"] = loc[1], loc[2], loc[3], loc[4]
    m["mlc_margin"] = (m["mlc_limit"] - m["mlc"]) / m["mlc_limit"]
    avg_it_kw = it_kw * p["util"] * p["uptime"]
    m["energy_mwh"] = avg_it_kw * 8760 * p["pue"] / 1000
    kwh = m["energy_mwh"] * 1000
    m["kwh"] = kwh
    m["water_m3"] = m["energy_mwh"] * p["wue"]
    m["co2_t"] = m["energy_mwh"] * p["carbon"]

    # Revenue / OpEx / EBITDA per year (1..5)
    ramp = [p["ramp"], 1, 1, 1, 1]
    lease = [p["lease_rev"] * (1 + p["lease_esc"]) ** t * ramp[t]
             for t in range(5)]
    tok_f = (1 + p["tok_growth"]) * (1 - p["tok_decline"])
    token = [p["token_rev"] * tok_f ** t * ramp[t] for t in range(5)]
    rev = [a + b for a, b in zip(lease, token)]
    elec = [kwh * p["tariff"] * (1 + p["tariff_esc"]) ** t for t in range(5)]
    fixed = [p["fixed_opex"] * (1 + p["opex_esc"]) ** t for t in range(5)]
    opex = [a + b for a, b in zip(elec, fixed)]
    ebitda = [r - o for r, o in zip(rev, opex)]
    m.update(rev=rev, token=token, elec=elec, opex=opex, ebitda=ebitda)

    # Debt schedule
    debt = p["capex"] * p["debt_ratio"]
    equity = p["capex"] - debt
    ds = pmt(p["rate"], p["tenor"], debt)
    bal, interest, principal, ending = debt, [], [], []
    for _ in range(5):
        i = bal * p["rate"]
        pr = ds - i
        interest.append(i)
        principal.append(pr)
        bal -= pr
        ending.append(bal)
    m.update(debt=debt, equity=equity, ds=ds, interest=interest,
             ending=ending)

    depr = p["capex"] / 5
    resid = p["capex"] * p["resid_pct"]
    ded_int = [min(i, p["gidlr"] * e) for i, e in zip(interest, ebitda)]
    taxable = [e - depr - di for e, di in zip(ebitda, ded_int)]
    tax = [max(0, ti) * p["tax"] for ti in taxable]
    fcfe = [e - ds - tx for e, tx in zip(ebitda, tax)]
    fcfe[4] += resid
    m.update(tax=tax, fcfe=[-equity] + fcfe)

    cum = []
    running = -equity
    cum.append(running)
    for cf in fcfe:
        running += cf
        cum.append(running)
    m["cum"] = cum
    m["equity_irr"] = irr(m["fcfe"])
    m["npv"] = sum(cf / (1 + p["hurdle"]) ** t for t, cf in enumerate(m["fcfe"]))
    m["moic"] = sum(m["fcfe"][1:]) / equity
    n_neg = sum(1 for c in cum if c < 0)
    m["payback"] = (n_neg - 1) + abs(cum[n_neg - 1]) / m["fcfe"][n_neg]
    m["dscr"] = [e / ds for e in ebitda]
    m["min_dscr"] = min(m["dscr"])
    m["avg_dscr"] = sum(m["dscr"]) / 5

    utax = [max(0, e - depr) * p["tax"] for e in ebitda]
    fcff = [e - t for e, t in zip(ebitda, utax)]
    fcff[4] += resid
    m["fcff"] = [-p["capex"]] + fcff
    m["project_irr"] = irr(m["fcff"])

    # Unit economics (Year 2 = index 1, post-ramp)
    gpus = p["vr_count"] * p["gpus_per_rack"]
    avail = gpus * 8760 * p["uptime"]
    sold = avail * p["util"]
    m["gpus"] = gpus
    m["rev_gpu_hr"] = rev[1] / sold
    m["opex_gpu_hr"] = opex[1] / sold
    m["capex_gpu"] = p["capex"] / gpus
    tok_cap_t = (gpus * p["token_share"] * p["tokens_gpu_s"] * 3600 * 8760
                 * p["util"] * p["uptime"] / 1e12)
    m["tok_cap_t"] = tok_cap_t
    m["price_mtok"] = token[1] / (tok_cap_t * 1e6)
    m["cost_mtok"] = opex[1] * p["token_share"] / (tok_cap_t * 1e6)
    m["energy_pct"] = elec[1] / rev[1]
    m["breakeven_tariff"] = (rev[1] - fixed[1]) / kwh
    m["min_rev_dscr1"] = ds + opex[1]

    # Sensitivity engine
    m["engine"] = {}
    for tariff in TARIFFS:
        for dr in DEBT_RATIOS:
            q = dict(p, tariff=tariff, debt_ratio=dr)
            sd = q["capex"] * dr
            se = q["capex"] - sd
            sds = pmt(q["rate"], q["tenor"], sd)
            sbal = sd
            s_int = []
            for _ in range(5):
                i = sbal * q["rate"]
                s_int.append(i)
                sbal -= sds - i
            s_elec = [kwh * tariff * (1 + q["tariff_esc"]) ** t
                      for t in range(5)]
            s_eb = [r - f - el for r, f, el in zip(rev, fixed, s_elec)]
            s_ded = [min(i, q["gidlr"] * e) for i, e in zip(s_int, s_eb)]
            s_tax = [max(0, e - depr - di) * q["tax"]
                     for e, di in zip(s_eb, s_ded)]
            s_fcfe = [e - sds - tx for e, tx in zip(s_eb, s_tax)]
            s_fcfe[4] += resid
            m["engine"][(tariff, dr)] = dict(
                irr=irr([-se] + s_fcfe),
                avg_dscr=sum(s_eb) / 5 / sds,
            )
    return m


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------
def main():
    _, maps = build_workbook()  # cell coordinates only; nothing is saved
    P, T, F, U, E = maps["P"], maps["T"], maps["F"], maps["U"], maps["E"]
    m = compute_model(INP)

    wb = openpyxl.load_workbook(FILE_NAME, data_only=True)
    thermal = wb["Thermal Hydraulics & MLC"]
    pro = wb["5Yr Pro Forma Financials"]
    ue = wb["Unit Economics & KPIs"]
    eng = wb["Sensitivity Engine"]
    dash = wb["Dashboard"]
    mat = wb["Sensitivity Matrices"]

    checks = []

    def chk(label, actual, expected, tol=1e-4):
        if actual is None:
            checks.append((label, "MISSING (None)", expected, False))
            return
        rel = abs(actual - expected) / max(abs(expected), 1e-9)
        checks.append((label, actual, expected, rel <= tol))

    chk("Thermal: total IT kW", thermal[f"B{T['Total Combined IT Load']}"].value,
        m["it_kw"])
    chk("Thermal: peak MLC",
        thermal[f"B{T['Peak Mechanical Load Component (MLC)']}"].value, m["mlc"])
    chk("Thermal: MLC margin",
        thermal[f"B{T['Safety Compliance Margin']}"].value, m["mlc_margin"])
    chk("Thermal: liquid-cooled kW",
        thermal[f"B{T['Liquid-Cooled IT Load']}"].value, m["liquid_kw"])
    chk("Thermal: S45 flow LPM",
        thermal[f"B{T['Total S45 Cluster Flow Rate']}"].value, m["flow_lpm"])
    chk("Thermal: MLC limit (location)",
        thermal[f"B{T['ASHRAE 90.4 MLC Limit (from location)']}"].value,
        m["mlc_limit"])
    chk("Thermal: N=20yr peak DB (location)",
        thermal[f"B{T['Peak Ambient Dry-Bulb (N=20yr)']}"].value, m["db20"])
    chk("Thermal: energy MWh",
        thermal[f"B{T['Annual Facility Energy']}"].value, m["energy_mwh"])
    chk("Thermal: water m3",
        thermal[f"B{T['Annual Water Consumption']}"].value, m["water_m3"])
    chk("Thermal: CO2 t",
        thermal[f"B{T['Annual Carbon Emissions']}"].value, m["co2_t"])

    for t in range(1, 6):
        col = YEAR_COLS[t]
        chk(f"ProForma: Y{t} revenue",
            pro[f"{col}{F['Gross Annual Revenue']}"].value, m["rev"][t - 1])
        chk(f"ProForma: Y{t} EBITDA",
            pro[f"{col}{F['EBITDA']}"].value, m["ebitda"][t - 1])
        chk(f"ProForma: Y{t} FCFE",
            pro[f"{col}{F['Leveraged Free Cash Flow (FCFE)']}"].value,
            m["fcfe"][t])

    chk("ProForma: Y0 FCFE (=-equity)",
        pro[f"B{F['Leveraged Free Cash Flow (FCFE)']}"].value, m["fcfe"][0])
    chk("ProForma: debt service",
        pro[f"C{F['Annual Debt Service (P+I)']}"].value, m["ds"])
    chk("ProForma: Y5 ending debt ~ 0",
        pro[f"G{F['Ending Debt Balance']}"].value + 1, m["ending"][4] + 1,
        tol=1e-6)
    chk("ProForma: equity IRR",
        pro[f"B{F['Equity IRR (5-Yr, levered)']}"].value, m["equity_irr"],
        tol=1e-5)
    chk("ProForma: project IRR",
        pro[f"B{F['Project IRR (5-Yr, unlevered)']}"].value, m["project_irr"],
        tol=1e-5)
    chk("ProForma: NPV", pro[f"B{F['Equity NPV @ hurdle rate']}"].value,
        m["npv"])
    chk("ProForma: MOIC",
        pro[f"B{F['MOIC (total distributions / equity)']}"].value, m["moic"])
    chk("ProForma: payback", pro[f"B{F['Payback Period']}"].value,
        m["payback"])
    chk("ProForma: min DSCR", pro[f"B{F['Minimum DSCR']}"].value,
        m["min_dscr"])
    chk("ProForma: avg DSCR", pro[f"B{F['Average DSCR']}"].value,
        m["avg_dscr"])

    chk("UnitEcon: GPUs", ue[f"B{U['Total GPU Count']}"].value, m["gpus"])
    chk("UnitEcon: rev/GPU-hr",
        ue[f"B{U['Blended Revenue per Sold GPU-hour']}"].value,
        m["rev_gpu_hr"])
    chk("UnitEcon: capex/GPU", ue[f"B{U['CapEx per GPU']}"].value,
        m["capex_gpu"])
    chk("UnitEcon: token capacity (T)",
        ue[f"B{U['Annual Token Capacity (token fleet)']}"].value,
        m["tok_cap_t"])
    chk("UnitEcon: $/M tok realized",
        ue[f"B{U['Implied Realized Price per M Tokens']}"].value,
        m["price_mtok"])
    chk("UnitEcon: cost/M tok", ue[f"B{U['Cash Cost per M Tokens']}"].value,
        m["cost_mtok"])
    chk("UnitEcon: energy % rev",
        ue[f"B{U['Energy Cost as % of Revenue']}"].value, m["energy_pct"])
    chk("UnitEcon: breakeven tariff",
        ue[f"B{U['Breakeven Power Tariff (EBITDA = 0)']}"].value,
        m["breakeven_tariff"])

    for ti, tariff in enumerate(TARIFFS):
        for di, dr in enumerate(DEBT_RATIOS):
            row = E[str(ti * len(DEBT_RATIOS) + di)] \
                if str(ti * len(DEBT_RATIOS) + di) in E \
                else E[ti * len(DEBT_RATIOS) + di]
            exp = m["engine"][(tariff, dr)]
            chk(f"Engine IRR: ${tariff:.2f}/{int(dr*100)}%",
                eng[f"M{row}"].value, exp["irr"], tol=1e-5)
            chk(f"Engine DSCR: ${tariff:.2f}/{int(dr*100)}%",
                eng[f"N{row}"].value, exp["avg_dscr"])
            chk(f"Matrix IRR: ${tariff:.2f}/{int(dr*100)}%",
                mat.cell(row=6 + ti, column=2 + di).value, exp["irr"],
                tol=1e-5)

    chk("Dashboard: equity IRR", dash["B5"].value, m["equity_irr"], tol=1e-5)
    chk("Dashboard: CO2", dash["B17"].value, m["co2_t"])

    failures = [c for c in checks if not c[3]]
    for label, actual, expected, ok in checks:
        mark = "PASS" if ok else "FAIL"
        if not ok:
            print(f"[{mark}] {label}: got {actual!r}, expected {expected!r}")
    print(f"\n{len(checks) - len(failures)}/{len(checks)} checks passed.")
    if failures:
        sys.exit(1)
    print("All checks passed — workbook is fully verified.")


if __name__ == "__main__":
    main()
