"""Extract the white paper's quantitative backbone from AI_Factory_Model.xlsx.

Reads the recalculated workbook (the verified model is the single source of
truth for every Abu Dhabi test-fit number in the white paper) plus a few
physics cross-checks, and writes whitepaper_manifest.json for the docx
builder (scripts/build_whitepaper.js) and the fact-check harness
(scripts/test_whitepaper.py).
"""

import json
import sys

import openpyxl

from create_ai_factory_model import (
    FILE_NAME,
    LOCATION_INDEX,
    PROFORMA_SHEET,
    build_workbook,
)

OUT = "whitepaper_manifest.json"


def main():
    _, maps = build_workbook()
    P, T, F, U, X = maps["P"], maps["T"], maps["F"], maps["U"], maps["X"]
    wb = openpyxl.load_workbook(FILE_NAME, data_only=True)
    inp = wb["Control Panel & Inputs"]
    th = wb["Thermal Hydraulics & MLC"]
    pro = wb[PROFORMA_SHEET]
    ue = wb["Unit Economics & KPIs"]
    xs = wb["Phased Expansion"]

    def pv(name):
        return inp[f"C{P[name]}"].value

    def tv(name):
        return th[f"B{T[name]}"].value

    def fv(item, col="B"):
        return pro[f"{col}{F[item]}"].value

    def uv(name):
        return ue[f"B{U[name]}"].value

    loc = LOCATION_INDEX[pv("Geo_Location")]

    m = {
        # architecture
        "location": pv("Geo_Location"),
        "zone": loc[1], "mlc_limit": loc[2], "db20": loc[3], "wb20": loc[4],
        "vr_racks": pv("VR_Rack_Count"), "vr_kw": pv("VR_Rack_Power_kW"),
        "net_racks": pv("Network_Rack_Count"), "net_kw": pv("Network_Rack_Power_kW"),
        "sto_racks": pv("Storage_Rack_Count"), "sto_kw": pv("Storage_Rack_Power_kW"),
        "gpus": uv("Total GPU Count"),
        "it_kw": tv("Total Combined IT Load"),
        "liquid_kw": tv("Liquid-Cooled IT Load"),
        "air_kw": tv("Air-Cooled IT Load"),
        # thermal
        "fws": pv("Liquid_Supply_Temp_FWS"), "fwr": pv("Liquid_Return_Temp_FWR"),
        "dt": tv("S45 Loop Delta T"),
        "cp": pv("Coolant_Specific_Heat"), "rho": pv("Coolant_Density"),
        "flow_rack": tv("S45 Liquid Flow Rate per VR Rack"),
        "flow_total": tv("Total S45 Cluster Flow Rate"),
        "approach": tv("S45 Peak Rejection Approach"),
        "mlc": tv("Peak Mechanical Load Component (MLC)"),
        "mlc_margin": tv("Safety Compliance Margin"),
        "pue": pv("Target_Annualized_PUE"),
        "util": pv("Cluster_Utilization"), "uptime": pv("Uptime_Availability"),
        "energy_mwh": tv("Annual Facility Energy"),
        "water_m3": tv("Annual Water Consumption"),
        "co2_t": tv("Annual Carbon Emissions"),
        "wue": pv("Water_Usage_Effectiveness"),
        "carbon_kg_kwh": pv("Grid_Carbon_Intensity"),
        # finance (model defaults; Year 1 = col C, Year 2 = col D)
        "capex": pv("CapEx_Initial"),
        "debt_ratio": pv("Debt_Ratio"), "rate": pv("Interest_Rate"),
        "tenor": pv("Debt_Tenor"), "tax": pv("UAE_Corporate_Tax"),
        "gidlr": pv("GIDLR_EBITDA_Cap"), "tariff": pv("Electricity_Tariff"),
        "debt": fv("Debt Financed Amount"), "equity": fv("Equity Outlay"),
        "ds": fv("Annual Debt Service (P+I)", "C"),
        "rev_y1": fv("Gross Annual Revenue", "C"),
        "rev_y2": fv("Gross Annual Revenue", "D"),
        "ebitda_y1": fv("EBITDA", "C"),
        "margin_y1": fv("EBITDA Margin", "C"),
        "elec_y1": fv("Electricity Cost", "C"),
        "equity_irr": fv("Equity IRR (levered)"),
        "project_irr": fv("Project IRR (unlevered)"),
        "npv": fv("Equity NPV @ hurdle rate"),
        "moic": fv("MOIC (total distributions / equity)"),
        "payback": fv("Payback Period"),
        "min_dscr": fv("Minimum DSCR"),
        "avg_dscr": fv("Average DSCR"),
        # unit economics
        "capex_gpu": uv("CapEx per GPU"),
        "rev_gpu_hr": uv("Blended Revenue per Sold GPU-hour"),
        "opex_gpu_hr": uv("Cash OpEx per Sold GPU-hour"),
        "cost_mtok": uv("Cash Cost per M Tokens"),
        "price_mtok": uv("Implied Realized Price per M Tokens"),
        "tok_cap_t": uv("Annual Token Capacity (token fleet)"),
        "energy_pct": uv("Energy Cost as % of Revenue"),
        "breakeven_tariff": uv("Breakeven Power Tariff (EBITDA = 0)"),
    }

    # Phased expansion KPIs (Section 14)
    def xv(name):
        return xs[f"B{X[name]}"].value

    m["exp_final_mw"] = xv("Final Campus IT Capacity (MW)")
    m["exp_final_gpus"] = xv("Final Campus GPUs")
    m["exp_capex_total"] = xv("Total Campus CapEx")
    m["exp_peak_funding"] = xv("Peak Funding Requirement")
    m["exp_runrate_ebitda"] = xv("Run-Rate Campus EBITDA (full blocks)")
    m["exp_cash_positive"] = str(xv("Campus Cash-Positive Year"))
    m["exp_blocks"] = int(m["exp_capex_total"] / m["capex"])

    # Physics cross-checks used in the paper's corrected Section 3
    m["flow_water_230"] = 230.0 / (1.0 * 4.18 * 10.0) * 60      # ~330 LPM
    m["flow_pg25_230"] = 230.0 / (m["rho"] * m["cp"] * 10.0) * 60

    # CapEx cross-check (Section 15/17): benchmark ranges, USD millions
    m["bench_fac_low"] = 9.9 * m["it_kw"] / 1000    # facility-only $M
    m["bench_fac_high"] = 12.2 * m["it_kw"] / 1000
    m["bench_it_low"] = m["vr_racks"] * 6.0         # VR rack $6-8.8M reported
    m["bench_it_high"] = m["vr_racks"] * 8.8
    m["fac_block_mid"] = (m["bench_fac_low"] + m["bench_fac_high"]) / 2
    m["fac_campus_16"] = m["fac_block_mid"] * 16

    # PUE savings worked example (Section 16, corrected draft math)
    it_mw_ref = 128.0
    m["pue_ref_mwh_saved"] = it_mw_ref * 8760 * (1.35 - 1.06)   # ~325,000 MWh
    m["pue_ref_usd_saved"] = m["pue_ref_mwh_saved"] * 1000 * 0.08

    with open(OUT, "w") as f:
        json.dump(m, f, indent=1)
    bad = [k for k, v in m.items() if v is None]
    if bad:
        print("MISSING:", bad)
        sys.exit(1)
    print(f"manifest OK -> {OUT} ({len(m)} values)")


if __name__ == "__main__":
    main()
