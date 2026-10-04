"""Stage 3 experiment: derive thresholds, test out-of-sample, paired by seed.

Grid: toxicity (informed_mult) x Jev skill on quote_environment.
Writes reports/stage3.md and config/thresholds.json (from the default scenario).
Usage: python scripts/stage3_report.py [--blocks 6000] [--seeds 6]
"""
import argparse
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from jev_trader.sim.derive import (FeeModel, baselines, derive, economics, evaluate, make_world,  # noqa: E402
                                   paired_diff)

ap = argparse.ArgumentParser()
ap.add_argument("--blocks", type=int, default=6000)
ap.add_argument("--seeds", type=int, default=6)
args = ap.parse_args()
fees = FeeModel()
TRAIN = list(range(100, 100 + args.seeds))
TEST = list(range(200, 200 + args.seeds))
SKILLS = {"none (0)": (0.0, 0.0), "weak (0.1-0.5)": (0.1, 0.5), "strong (0.4-0.95)": (0.4, 0.95)}
lines, t0, shipped = [], time.time(), None
lines += ["# Stage 3 - derived thresholds, out-of-sample", "",
          f"{args.seeds} train seeds x {args.seeds} test seeds x {args.blocks} blocks (~{args.blocks*0.3/60:.0f} min each). "
          f"Fees: maker {fees.maker_bps} bp, replace {fees.replace_cost_bps} bp/order. PnL in quote ccy, summed over test seeds.",
          "`vs best const` = derived minus the better of always/never-quote *chosen on train*, paired by test seed, ±~95% CI.", "",
          "| informed x | quote_env skill | G | L | θ* | always | tox-oracle | derived tol=0.02 | vs best const | derived tol=∞ | vs best const | θ (tox, q) tol=∞ |",
          "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for mult in (1.0, 0.5, 0.3):
    for sname, sk in SKILLS.items():
        kw = {"mock_kw": {"skill_by_question": {"quote_environment": sk}}, "informed_mult": mult}
        tr = [make_world(s, args.blocks, **kw) for s in TRAIN]
        te = [make_world(s, args.blocks, **kw) for s in TEST]
        e = economics(tr)
        always_train = sum(baselines(w)["always_quote"] for w in tr)
        const_key = "always_quote" if always_train > 0 else "never_quote"
        bl = [baselines(w) for w in te]
        const = [b[const_key] for b in bl]
        row = [f"{mult}", sname, f"{e['G']:+.4f}", f"{e['L']:+.4f}", f"{e['theta_star']:.2f}",
               f"{sum(b['always_quote'] for b in bl):+.1f}", f"{sum(b['toxicity_oracle'] for b in bl):+.1f}"]
        for tol in (0.02, float("inf")):
            th, info = derive(tr, fees, acc_tol=tol)
            res = [evaluate(w, th, fees)["pnl"] for w in te]
            m, ci = paired_diff(res, const)
            row += [f"{sum(res):+.1f}", f"{m*len(res):+.1f} ± {ci*len(res):.1f}"]
            if mult == 1.0 and sname.startswith("strong") and tol == 0.02:
                shipped = (th, info, e)
        row.append(f"({th.toxic_pull}, {th.quote_both})")
        lines.append("| " + " | ".join(row) + " |")
        print(lines[-1], f"[{time.time()-t0:.0f}s]", flush=True)

th, info, e = shipped
th.dump(Path("config/thresholds.json"), meta={
    "derived_by": "scripts/stage3_report.py", "scenario": "informed_mult=1.0, quote_env skill strong (mock)",
    "acc_tol": 0.02, "train_seeds": TRAIN, "blocks": args.blocks, "G": e["G"], "L": e["L"], "theta_star": e["theta_star"],
    "train": info["train"], "warning": "derived on a SIMULATOR with a MOCK Jev; re-derive on logged real decisions"})
Path("reports/stage3.md").write_text("\n".join(lines) + "\n")
print("done", f"{time.time()-t0:.0f}s")
