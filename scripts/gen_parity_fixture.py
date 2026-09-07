"""Generate tests/fixtures/ai-factory-parity.json from the verified Python
model (test_ai_factory_model.compute_model), covering the default scenario and
type/scale variants. scripts/test-ai-factory-parity.mjs replays these through
the TypeScript engine (src/lib/aiFactory.ts) and asserts equality — proving
the web app computes exactly what the verified Excel/Python model computes.
"""

import json
import os

from test_ai_factory_model import INP, compute_model

SCENARIOS = {
    "default": {},
    "gb200_x64_cpo": dict(vr_count=64, vr_kw=121.0, vr_price_m=3.5,
                          net_kw=80.0, net_cool="Liquid", net_price_m=0.8,
                          _ts=dict(vrType="GB200 NVL72", vrCount=64,
                                   netType="Spectrum-X CPO fabric rack")),
    "dublin_low_debt": dict(location="Dublin, Ireland", debt_ratio=0.5,
                            tariff=0.10,
                            _ts=dict(location="Dublin, Ireland",
                                     debtRatio=0.5, tariff=0.10)),
    "market_pricing": dict(lease_gpu_hr=9.0, tok_price_m=2.0,
                           _ts=dict(leasePerGpuHr=9.0, tokenPricePerM=2.0)),
}

KEYS = ["it_kw", "liquid_kw", "flow_per_rack", "flow_lpm", "mlc",
        "mlc_margin", "energy_mwh", "water_m3", "co2_t", "equity",
        "ds", "equity_irr", "project_irr", "npv", "moic", "min_dscr",
        "avg_dscr", "capex_gpu", "rev_gpu_hr", "cost_mtok", "energy_pct",
        "breakeven_tariff"]


def main():
    out = {}
    for name, over in SCENARIOS.items():
        ts_over = over.pop("_ts", {})
        m = compute_model(dict(INP, **over))
        rec = {k: m[k] for k in KEYS}
        rec["capex"] = m["debt"] + m["equity"]
        rec["payback"] = m["payback"]
        rec["rev"] = m["rev"]
        rec["ebitda"] = m["ebitda"]
        rec["fcfe"] = m["fcfe"]
        rec["engine_irr"] = [m["engine"][(t, d)]["irr"]
                             for t in (0.04, 0.06, 0.08, 0.10)
                             for d in (0.5, 0.6, 0.7, 0.8)]
        rec["exp_peak_funding"] = m["expansion"]["peak_funding"]
        rec["exp_final_mw"] = m["expansion"]["final_mw"]
        rec["exp_cash_positive"] = str(m["expansion"]["cash_positive_year"])
        out[name] = {"ts_overrides": ts_over, "expected": rec}
    os.makedirs("tests/fixtures", exist_ok=True)
    path = "tests/fixtures/ai-factory-parity.json"
    with open(path, "w") as f:
        json.dump(out, f, indent=1)
    print(f"fixture OK -> {path} ({len(out)} scenarios)")


if __name__ == "__main__":
    main()
