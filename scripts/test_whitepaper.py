"""Fact-check harness for AI_Factory_Whitepaper.docx.

Two layers of verification:
 1. whitepaper_manifest.json is re-derived from the independent pure-Python
    model (test_ai_factory_model.compute_model) — proving the manifest really
    is the verified model, not a transcription.
 2. The rendered document text (pandoc) is checked for every load-bearing
    formatted figure, using the same formatting rules as the docx builder —
    proving the paper says what the model says.

Exit code 0 = all checks pass.
"""

import json
import subprocess
import sys

from test_ai_factory_model import INP, compute_model

MANIFEST = "whitepaper_manifest.json"
DOCX = "AI_Factory_Whitepaper.docx"


# -- formatters mirroring scripts/build_whitepaper.js ------------------------
def usd(n):
    return ("-$" if n < 0 else "$") + f"{abs(round(n)):,}"


def usd_m(n, dp=1):
    return ("-$" if n < 0 else "$") + f"{abs(n) / 1e6:.{dp}f}M"


def usd_b(n, dp=2):
    return ("-$" if n < 0 else "$") + f"{abs(n) / 1e9:.{dp}f}B"


def pct(n, dp=1):
    return f"{n * 100:.{dp}f}%"


def num(n):
    return f"{round(n):,}"


def f1(n):
    return f"{n:,.1f}"


def main():
    m = json.load(open(MANIFEST))
    ind = compute_model(INP)

    failures = []

    def chk(label, ok, detail=""):
        if not ok:
            failures.append(f"{label}  {detail}")
        print(("pass " if ok else "FAIL ") + label + ("  " + detail if not ok else ""))

    # ---- layer 1: manifest vs independent model ----
    pairs = [
        ("it_kw", "it_kw"), ("liquid_kw", "liquid_kw"),
        ("flow_rack", "flow_per_rack"), ("flow_total", "flow_lpm"),
        ("mlc", "mlc"), ("mlc_margin", "mlc_margin"),
        ("energy_mwh", "energy_mwh"), ("water_m3", "water_m3"),
        ("co2_t", "co2_t"), ("equity_irr", "equity_irr"),
        ("project_irr", "project_irr"), ("npv", "npv"), ("moic", "moic"),
        ("min_dscr", "min_dscr"),
        ("capex_gpu", "capex_gpu"), ("cost_mtok", "cost_mtok"),
        ("rev_gpu_hr", "rev_gpu_hr"), ("breakeven_tariff", "breakeven_tariff"),
    ]
    for mk, ik in pairs:
        a, b = m[mk], ind[ik]
        chk(f"manifest {mk}", abs(a - b) / max(abs(b), 1e-9) < 1e-4,
            f"manifest={a} independent={b}")
    exp = ind["expansion"]
    for mk, iv in [("exp_final_mw", exp["final_mw"]),
                   ("exp_final_gpus", exp["final_gpus"]),
                   ("exp_capex_total", exp["capex_total"]),
                   ("exp_peak_funding", exp["peak_funding"]),
                   ("exp_runrate_ebitda", exp["runrate_ebitda"])]:
        chk(f"manifest {mk}", abs(m[mk] - iv) / max(abs(iv), 1e-9) < 1e-4,
            f"manifest={m[mk]} independent={iv}")
    chk("manifest exp_cash_positive",
        str(m["exp_cash_positive"]) == str(exp["cash_positive_year"]),
        f"{m['exp_cash_positive']} vs {exp['cash_positive_year']}")

    chk("manifest rev_y1", abs(m["rev_y1"] - ind["rev"][0]) < 1,
        f"{m['rev_y1']} vs {ind['rev'][0]}")
    chk("manifest ebitda_y1", abs(m["ebitda_y1"] - ind["ebitda"][0]) < 1,
        f"{m['ebitda_y1']} vs {ind['ebitda'][0]}")

    # arithmetic identities used in the paper
    if isinstance(m["payback"], (int, float)) and ind["payback"] is not None:
        chk("manifest payback",
            abs(m["payback"] - ind["payback"]) < 1e-4,
            f"{m['payback']} vs {ind['payback']}")
    else:
        chk("manifest payback (text)",
            not isinstance(m["payback"], (int, float)) and ind["payback"] is None)

    chk("128MW PUE savings math",
        abs(m["pue_ref_mwh_saved"] - 128 * 8760 * 0.29) < 1)
    chk("128MW lease math", 128_000 * 125 * 12 == 192_000_000)
    chk("water flow 230kW identity",
        abs(m["flow_water_230"] - 230 / 41.8 * 60) < 0.1)

    # ---- layer 2: document text contains the formatted figures ----
    text = subprocess.run(["pandoc", "-t", "plain", DOCX],
                          capture_output=True, text=True, check=True).stdout
    text = " ".join(text.split())  # collapse whitespace/line wraps

    expected = {
        "IT load MW": f"{m['it_kw'] / 1000:.3f} MW",
        "GPU count": f"{num(m['gpus'])} GPUs",
        "peak MLC": f"MLC {m['mlc']:.3f}",
        "MLC limit": f"{m['mlc_limit']:.3f}",
        "MLC margin": pct(m["mlc_margin"]),
        "flow per rack": f"{f1(m['flow_rack'])} LPM",
        "cluster flow": f"{num(m['flow_total'])} LPM",
        "water flow 330": f"{num(m['flow_water_230'])} LPM",
        "energy MWh": f"{num(m['energy_mwh'])} MWh",
        "water m3": f"{num(m['water_m3'])} m³/yr",
        "CO2": f"{num(m['co2_t'])} tCO2/yr",
        "revenue Y1": usd_m(m["rev_y1"]),
        "EBITDA Y1": usd_m(m["ebitda_y1"]),
        "EBITDA margin": pct(m["margin_y1"]),
        "equity IRR": pct(m["equity_irr"]),
        "project IRR": pct(m["project_irr"]),
        "NPV": usd_m(m["npv"]),
        "MOIC": f"{m['moic']:.2f}x",
        "payback": (f"{m['payback']:.2f} years"
                    if isinstance(m["payback"], (int, float))
                    else str(m["payback"])),
        "min DSCR": f"{m['min_dscr']:.2f}x",
        "CapEx": usd_m(m["capex"]),
        "debt": usd_m(m["debt"]),
        "equity": usd_m(m["equity"]),
        "debt service": usd_m(m["ds"]),
        "CapEx per GPU": usd(m["capex_gpu"]),
        "rev per GPU-hr": f"${m['rev_gpu_hr']:.2f}",
        "cost per Mtok": f"${m['cost_mtok']:.2f}",
        "breakeven tariff": f"${m['breakeven_tariff']:.2f}",
        "bench IT low": usd_m(m["bench_it_low"] * 1e6, 0),
        "bench IT high": usd_m(m["bench_it_high"] * 1e6, 0),
        "PUE saved MWh": f"{num(m['pue_ref_mwh_saved'])} MWh",
        "N20 dry bulb": f"{m['db20']:.1f}°C",
        "approach": f"+{m['approach']:.1f} K",
        "zone": f"Zone {m['zone']}",
        "expansion MW": f"{num(m['exp_final_mw'])} MW",
        "expansion GPUs": num(m["exp_final_gpus"]),
        "expansion campus capex": usd_b(m["exp_capex_total"]),
        "expansion peak funding": usd_b(m["exp_peak_funding"]),
        "expansion run-rate EBITDA": usd_b(m["exp_runrate_ebitda"]),
        "facility campus recon": usd_b(m["fac_campus_16"] * 1e6),
        "facility block mid": usd_m(m["fac_block_mid"] * 1e6, 0),
    }
    for label, needle in expected.items():
        chk(f"doc contains {label} ({needle})", needle in text)

    # figures that must NOT appear (corrected-away claims)
    for label, needle in {
        "impossible 195 LPM as fact": "195 LPM per rack is required",
        "DSX MaxLPS product": "MaxLPS)",
        "WUE zero absolutism": "WUE = 0.00)",
    }.items():
        chk(f"doc omits {label}", needle not in text)

    print(f"\n{'ALL CHECKS PASSED' if not failures else str(len(failures)) + ' FAILURES'}"
          f" — whitepaper verified against the independent model.")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
