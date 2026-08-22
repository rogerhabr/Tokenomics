#!/usr/bin/env python3
"""Sizing calculators for electrical, solar PV and battery storage work.

Every subcommand echoes its inputs alongside its results so output can be pasted
into a report without the assumptions getting separated from the numbers.

Tables are NEC 2023. The governing code edition is whatever the AHJ has adopted;
results are feasibility-grade and are not a substitute for a stamped design.

Usage:
    python3 sizing.py <subcommand> --help
"""

import argparse
import math
import sys

# --------------------------------------------------------------------------
# Tables
# --------------------------------------------------------------------------

# NEC Table 310.16 allowable ampacities, 30 C ambient, <=3 current-carrying
# conductors in a raceway. Keyed by size -> (60C, 75C, 90C). None = not tabulated.
AMPACITY = {
    "cu": {
        "14":   (15, 20, 25),
        "12":   (20, 25, 30),
        "10":   (30, 35, 40),
        "8":    (40, 50, 55),
        "6":    (55, 65, 75),
        "4":    (70, 85, 95),
        "3":    (85, 100, 115),
        "2":    (95, 115, 130),
        "1":    (110, 130, 145),
        "1/0":  (125, 150, 170),
        "2/0":  (145, 175, 195),
        "3/0":  (165, 200, 225),
        "4/0":  (195, 230, 260),
        "250":  (215, 255, 290),
        "300":  (240, 285, 320),
        "350":  (260, 310, 350),
        "400":  (280, 335, 380),
        "500":  (320, 380, 430),
        "600":  (350, 420, 475),
        "750":  (400, 475, 535),
    },
    "al": {
        "12":   (15, 20, 25),
        "10":   (25, 30, 35),
        "8":    (35, 40, 45),
        "6":    (40, 50, 55),
        "4":    (55, 65, 75),
        "3":    (65, 75, 85),
        "2":    (75, 90, 100),
        "1":    (85, 100, 115),
        "1/0":  (100, 120, 135),
        "2/0":  (115, 135, 150),
        "3/0":  (130, 155, 175),
        "4/0":  (150, 180, 205),
        "250":  (170, 205, 230),
        "300":  (195, 230, 260),
        "350":  (210, 250, 280),
        "400":  (225, 270, 305),
        "500":  (260, 310, 350),
        "600":  (285, 340, 385),
        "750":  (320, 385, 435),
    },
}

# Conductor size order, smallest first.
SIZES = ["14", "12", "10", "8", "6", "4", "3", "2", "1", "1/0", "2/0", "3/0",
         "4/0", "250", "300", "350", "400", "500", "600", "750"]

# Circular mils per conductor.
CIRCULAR_MILS = {
    "14": 4110, "12": 6530, "10": 10380, "8": 16510, "6": 26240, "4": 41740,
    "3": 52620, "2": 66360, "1": 83690, "1/0": 105600, "2/0": 133100,
    "3/0": 167800, "4/0": 211600, "250": 250000, "300": 300000, "350": 350000,
    "400": 400000, "500": 500000, "600": 600000, "750": 750000,
}

# NEC 240.6(A) standard overcurrent device ratings.
STANDARD_OCPD = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125,
                 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700,
                 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000]

# NEC 240.4(D) small-conductor overcurrent limits.
SMALL_CONDUCTOR_LIMIT = {
    "cu": {"14": 15, "12": 20, "10": 30},
    "al": {"12": 15, "10": 25},
}

# NEC 310.15(C)(1) adjustment factors, as (max_count, factor).
FILL_ADJUSTMENT = [(3, 1.00), (6, 0.80), (9, 0.70), (20, 0.50),
                   (30, 0.45), (40, 0.40)]

# Resistivity constants for the K-method, ohm-cmil/ft at ~75 C.
K_CONSTANT = {"cu": 12.9, "al": 21.2}

# Standard transformer kVA ratings.
STANDARD_KVA = [15, 30, 45, 75, 112.5, 150, 225, 300, 500, 750, 1000, 1500,
                2000, 2500, 3000]

TEMP_COL = {60: 0, 75: 1, 90: 2}


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

def banner(title):
    print()
    print(title)
    print("=" * len(title))


def show(label, value, unit="", note=""):
    text = f"  {label:<38} {value}"
    if unit:
        text += f" {unit}"
    if note:
        text += f"   ({note})"
    print(text)


def fill_factor(count):
    if count <= 3:
        return 1.00
    for max_count, factor in FILL_ADJUSTMENT:
        if count <= max_count:
            return factor
    return 0.35


def temp_correction(ambient_c, insulation_c):
    """NEC 310.15(B)(2) correction factor for ambient other than 30 C."""
    numerator = insulation_c - ambient_c
    if numerator <= 0:
        raise ValueError(
            f"ambient {ambient_c} C meets or exceeds the {insulation_c} C "
            "conductor rating - this conductor cannot be used here"
        )
    return math.sqrt(numerator / (insulation_c - 30.0))


def next_standard_ocpd(amps):
    for rating in STANDARD_OCPD:
        if rating >= amps - 1e-9:
            return rating
    return None


def current_from_kw(kw, volts, phase, pf):
    if phase == 3:
        return kw * 1000.0 / (math.sqrt(3) * volts * pf)
    return kw * 1000.0 / (volts * pf)


# --------------------------------------------------------------------------
# vdrop
# --------------------------------------------------------------------------

def cmd_vdrop(args):
    size = args.size
    if size not in CIRCULAR_MILS:
        sys.exit(f"unknown conductor size '{size}'. Known: {', '.join(SIZES)}")

    k = K_CONSTANT[args.material]
    cm = CIRCULAR_MILS[size] * args.parallel
    multiplier = math.sqrt(3) if args.phase == 3 else 2.0

    vd = multiplier * k * args.length * args.amps / cm
    pct = vd / args.voltage * 100.0

    banner("Voltage drop")
    show("Load current", f"{args.amps:.1f}", "A")
    show("One-way length", f"{args.length:.0f}", "ft")
    show("System voltage", f"{args.voltage:.0f}", "V", f"{args.phase}-phase")
    show("Conductor", f"{size} AWG/kcmil {args.material.upper()}",
         "", f"{args.parallel} per phase" if args.parallel > 1 else "")
    show("K constant", f"{k}", "ohm-cmil/ft")
    print()
    show("Voltage drop", f"{vd:.2f}", "V")
    show("Percent drop", f"{pct:.2f}", "%")
    show("Voltage at load", f"{args.voltage - vd:.1f}", "V")
    print()
    formula = "sqrt(3)" if args.phase == 3 else "2"
    print(f"  VD = {formula} x {k} x {args.length:.0f} ft x {args.amps:.1f} A "
          f"/ {cm:,} cmil = {vd:.2f} V")
    print()
    if pct <= 3.0:
        print("  Within the 3% branch-circuit design target (NEC 210.19(A) IN).")
    elif pct <= 5.0:
        print("  Over 3% but within the 5% total design target. Acceptable for a "
              "feeder if the\n  downstream branch drop is small; check the whole path.")
    else:
        print("  Exceeds the 5% total design target. Upsize the conductor, "
              "parallel it, or\n  raise the distribution voltage.")

    # Suggest the smallest size meeting the target.
    target = args.target
    for candidate in SIZES:
        if candidate not in CIRCULAR_MILS:
            continue
        cm_c = CIRCULAR_MILS[candidate] * args.parallel
        pct_c = multiplier * k * args.length * args.amps / cm_c / args.voltage * 100
        if pct_c <= target:
            if candidate != size:
                verb = ("upsize to" if SIZES.index(candidate) > SIZES.index(size)
                        else "as small as")
                print(f"\n  Voltage drop alone would allow {verb} {candidate} "
                      f"({pct_c:.2f}% against a {target:.0f}% target).")
                print("  Ampacity is a separate constraint - run the 'ampacity' "
                      "subcommand and take\n  the larger of the two conductors.")
            break
    else:
        print(f"\n  No tabulated single size meets {target:.0f}% at this length. "
              "Parallel conductors\n  or a higher distribution voltage is required.")


# --------------------------------------------------------------------------
# ampacity
# --------------------------------------------------------------------------

def cmd_ampacity(args):
    if args.amps is not None:
        load_amps = args.amps
        source = "given"
    elif args.load_kw is not None:
        load_amps = current_from_kw(args.load_kw, args.voltage, args.phase, args.pf)
        source = (f"from {args.load_kw} kW at {args.voltage} V "
                  f"{args.phase}-phase, PF {args.pf}")
    else:
        sys.exit("provide either --amps or --load-kw")

    factor = 1.25 if args.continuous else 1.00
    required = load_amps * factor

    ocpd = next_standard_ocpd(required)
    if ocpd is None:
        sys.exit("required current exceeds the largest standard OCPD rating")

    tc = temp_correction(args.ambient, args.insulation)
    fa = fill_factor(args.conductors)
    derate = tc * fa

    term_col = TEMP_COL[args.termination]
    derate_col = TEMP_COL[args.insulation]
    table = AMPACITY[args.material]

    banner("Conductor and overcurrent device sizing")
    show("Load current", f"{load_amps:.1f}", "A", source)
    show("Continuous load", "yes (125%)" if args.continuous else "no (100%)")
    show("Required current", f"{required:.1f}", "A")
    show("Standard OCPD", f"{ocpd}", "A", "NEC 240.6(A)")
    print()
    show("Ambient temperature", f"{args.ambient:.0f}", "C",
         f"correction {tc:.3f}")
    show("Current-carrying conductors", f"{args.conductors}",
         "", f"adjustment {fa:.2f}")
    show("Combined derating", f"{derate:.3f}")
    show("Conductor insulation", f"{args.insulation}", "C", "used for derating")
    show("Termination rating", f"{args.termination}", "C",
         "caps the final selection, NEC 110.14(C)")
    print()

    chosen = None
    for size in SIZES:
        if size not in table:
            continue
        derated = table[size][derate_col] * derate
        term_limit = table[size][term_col]
        usable = min(derated, term_limit)
        small_cap = SMALL_CONDUCTOR_LIMIT.get(args.material, {}).get(size)
        if small_cap is not None:
            usable = min(usable, small_cap)
        if usable >= required:
            chosen = (size, table[size][derate_col], derated, term_limit,
                      usable, small_cap)
            break

    if chosen is None:
        print("  No single conductor carries this load at the stated derating.")
        suggestion = parallel_suggestion(required, table, derate_col, term_col,
                                         derate, args.material)
        if suggestion:
            sets, size, usable_each = suggestion
            print(f"\n  Try {sets} parallel sets of {size} "
                  f"{args.material.upper()} per phase:")
            print(f"    {usable_each:.0f} A usable each x {sets} = "
                  f"{usable_each * sets:.0f} A vs {required:.1f} A required")
            print("    NEC 310.10(G): 1/0 and larger only; all sets identical in "
                  "length, material,\n    size, insulation and termination.")
            print(f"    Re-run with --conductors set to the actual raceway count "
                  f"- {sets} sets in one\n    raceway is "
                  f"{sets * 3} current-carrying conductors, which derates further. "
                  "Separate\n    raceways per set avoid that.")
        else:
            print("  Even parallel sets are impractical here. Raise the "
                  "distribution voltage.")
        print("\n  Busway is also worth comparing above roughly 800 A.")
        return

    size, table_amp, derated, term_limit, usable, small_cap = chosen
    show("Selected conductor", f"{size} AWG/kcmil {args.material.upper()}")
    show(f"  Table 310.16 @ {args.insulation} C", f"{table_amp}", "A")
    show("  After derating", f"{derated:.1f}", "A")
    show(f"  Termination limit @ {args.termination} C", f"{term_limit}", "A")
    if small_cap is not None:
        show("  Small-conductor limit", f"{small_cap}", "A", "NEC 240.4(D)")
    show("  Usable ampacity", f"{usable:.1f}", "A",
         f"vs {required:.1f} A required")
    print()

    if ocpd > usable:
        adjusted = next_standard_ocpd(usable)
        note = ("  OCPD exceeds the conductor's usable ampacity. The next-size-up "
                "rule (240.4(B))\n  applies only at 800 A or less and with no "
                f"receptacle outlets; otherwise use {adjusted} A\n  or upsize the "
                "conductor.")
        print(note)
    else:
        print(f"  {ocpd} A device protects {size} {args.material.upper()} "
              f"({usable:.0f} A usable). OK.")

    egc = egc_size(ocpd)
    if egc:
        print(f"  Equipment grounding conductor: {egc} Cu (NEC Table 250.122). "
              "Upsize proportionally\n  if the phase conductors were upsized for "
              "voltage drop (250.122(B)).")


def parallel_suggestion(required, table, derate_col, term_col, derate, material,
                        max_sets=6):
    """Smallest workable (number of sets, size) using parallel conductors.

    Fewer sets is preferred, so sets are tried in increasing order. Only 1/0 and
    larger may be paralleled (NEC 310.10(G)).
    """
    parallel_ok = SIZES[SIZES.index("1/0"):]
    for sets in range(2, max_sets + 1):
        per_set = required / sets
        for size in parallel_ok:
            if size not in table:
                continue
            usable = min(table[size][derate_col] * derate, table[size][term_col])
            if usable >= per_set:
                return sets, size, usable
    return None


EGC_TABLE = [(15, "14"), (20, "12"), (60, "10"), (100, "8"), (200, "6"),
             (300, "4"), (400, "3"), (500, "2"), (600, "1"), (800, "1/0"),
             (1000, "2/0"), (1200, "3/0"), (1600, "4/0"), (2000, "250"),
             (2500, "350"), (3000, "400"), (4000, "500"), (5000, "700"),
             (6000, "800")]


def egc_size(ocpd_amps):
    for rating, size in EGC_TABLE:
        if ocpd_amps <= rating:
            return size
    return None


# --------------------------------------------------------------------------
# array
# --------------------------------------------------------------------------

def cmd_array(args):
    if args.annual_kwh is not None:
        daily = args.annual_kwh / 365.0
        annual = args.annual_kwh
        basis = "annual target"
    elif args.daily_kwh is not None:
        daily = args.daily_kwh
        annual = args.daily_kwh * 365.0
        basis = "daily target"
    else:
        sys.exit("provide either --annual-kwh or --daily-kwh")

    kw_dc_ideal = daily / (args.psh * args.pr)
    modules = math.ceil(kw_dc_ideal * 1000.0 / args.module_w)
    kw_dc = modules * args.module_w / 1000.0
    kw_ac = kw_dc / args.ilr
    yield_actual = kw_dc * args.psh * 365.0 * args.pr
    specific = yield_actual / kw_dc
    cf = yield_actual / (kw_ac * 8760.0) * 100.0

    banner("PV array sizing")
    show("Energy target", f"{annual:,.0f}", "kWh/yr", basis)
    show("Peak sun hours (POA)", f"{args.psh:.2f}", "kWh/m2/day")
    show("Performance ratio", f"{args.pr:.2f}")
    show("Module rating", f"{args.module_w:.0f}", "W STC")
    show("Assumed ILR (DC:AC)", f"{args.ilr:.2f}")
    print()
    show("Required DC capacity", f"{kw_dc_ideal:,.1f}", "kW_dc", "before rounding")
    show("Module count", f"{modules:,}")
    show("Installed DC capacity", f"{kw_dc:,.1f}", "kW_dc")
    show("Inverter AC capacity", f"{kw_ac:,.1f}", "kW_ac")
    show("Expected annual yield", f"{yield_actual:,.0f}", "kWh/yr")
    show("Specific yield", f"{specific:,.0f}", "kWh/kWp/yr")
    show("AC capacity factor", f"{cf:.1f}", "%")
    print()
    print(f"  kW_dc = {annual:,.0f} kWh / (365 x {args.psh:.2f} PSH x "
          f"{args.pr:.2f} PR) = {kw_dc_ideal:,.1f} kW_dc")
    print()

    if args.area_m2_per_kw:
        area = kw_dc * args.area_m2_per_kw
        show("Array area", f"{area:,.0f}", "m2",
             f"at {args.area_m2_per_kw} m2/kW_dc")
    acres_low, acres_high = kw_dc / 1000.0 * 4, kw_dc / 1000.0 * 8
    if kw_dc >= 500:
        print(f"  Ground-mount land estimate: {acres_low:.1f}-{acres_high:.1f} "
              f"acres ({acres_low*0.405:.1f}-{acres_high*0.405:.1f} ha) all-in.")

    if specific > 2000:
        print("  WARNING: specific yield above 2,000 kWh/kWp/yr. Check the PSH "
              "and PR inputs.")
    elif specific < 700:
        print("  NOTE: specific yield below 700 kWh/kWp/yr - plausible at high "
              "latitude, but\n  confirm the resource figure.")


# --------------------------------------------------------------------------
# string
# --------------------------------------------------------------------------

def cmd_string(args):
    voc_max = args.voc * (1 + args.beta_voc / 100.0 * (args.tmin - 25.0))
    vmp_min = args.vmp * (1 + args.beta_vmp / 100.0 * (args.tmax_cell - 25.0))

    n_max = math.floor(args.inv_vmax / voc_max)
    n_min = math.ceil(args.inv_mppt_min / vmp_min)

    banner("String sizing")
    show("Module V_oc (STC)", f"{args.voc:.2f}", "V")
    show("Module V_mp (STC)", f"{args.vmp:.2f}", "V")
    show("Module I_sc (STC)", f"{args.isc:.2f}", "A")
    show("Temp coeff of V_oc", f"{args.beta_voc:.3f}", "%/C")
    show("Temp coeff of V_mp", f"{args.beta_vmp:.3f}", "%/C")
    show("Record low ambient", f"{args.tmin:.1f}", "C",
         "ASHRAE extreme annual mean minimum")
    show("Max cell temperature", f"{args.tmax_cell:.1f}", "C")
    show("Inverter max DC voltage", f"{args.inv_vmax:.0f}", "V")
    show("Inverter MPPT minimum", f"{args.inv_mppt_min:.0f}", "V")
    print()
    show("V_oc at record low", f"{voc_max:.2f}", "V/module", "NEC 690.7")
    show("V_mp at max cell temp", f"{vmp_min:.2f}", "V/module")
    print()

    if n_max < n_min:
        print(f"  NO VALID STRING LENGTH: max {n_max} < min {n_min}. This module "
              "and inverter\n  combination does not work at these temperatures. "
              "Pick a different inverter\n  or module.")
        return

    show("Maximum modules per string", f"{n_max}", "", "cold V_oc limit")
    show("Minimum modules per string", f"{n_min}", "", "hot MPPT-window limit")
    show("Valid range", f"{n_min} to {n_max}", "modules")
    print()
    print(f"  V_oc,max = {args.voc:.2f} x [1 + {args.beta_voc:.3f}%/C x "
          f"({args.tmin:.0f} - 25)] = {voc_max:.2f} V")
    print(f"  n_max = floor({args.inv_vmax:.0f} / {voc_max:.2f}) = {n_max}")
    print()

    for n in (n_max, n_min):
        label = "Longest string" if n == n_max else "Shortest string"
        if n_max == n_min:
            label = "Only valid string"
        print(f"  {label} ({n} modules):")
        print(f"    V_oc cold        {n * voc_max:8.1f} V   "
              f"(headroom {args.inv_vmax - n * voc_max:.1f} V to the "
              f"{args.inv_vmax:.0f} V limit)")
        print(f"    V_mp hot         {n * vmp_min:8.1f} V")
        print(f"    V_mp STC         {n * args.vmp:8.1f} V")
        if args.module_w:
            print(f"    String power     {n * args.module_w / 1000.0:8.2f} kW_dc")
        if n_max == n_min:
            break

    print()
    i_690_8a = args.isc * 1.25
    i_690_8b = i_690_8a * 1.25
    show("Max circuit current", f"{i_690_8a:.2f}", "A", "1.25 x I_sc, NEC 690.8(A)")
    show("Conductor sizing current", f"{i_690_8b:.2f}", "A",
         "1.56 x I_sc, before derating")
    print("\n  Size PV source-circuit conductors from the 1.56 x I_sc figure, then "
          "apply\n  ambient and conduit-fill derating (rooftop and free-air PV runs "
          "are hot).")
    print("  Series fuses are required once three or more strings are paralleled "
          "(690.9).")
    print("\n  Design toward the upper end of the range: fewer, longer strings mean "
          "less\n  combiner hardware, lower current and lower I2R loss. Leave "
          "margin below n_max.")


# --------------------------------------------------------------------------
# battery
# --------------------------------------------------------------------------

def cmd_battery(args):
    energy_need = (args.daily_kwh * args.autonomy) / (
        args.dod * args.eta_rt * args.eta_inv)
    pcs_kw = args.peak_kw / args.eta_inv
    crate_need = pcs_kw / args.max_c

    nameplate = max(energy_need, crate_need)
    governing = "energy" if energy_need >= crate_need else "C-rate"
    usable = nameplate * args.dod
    duration = nameplate / pcs_kw if pcs_kw else float("inf")

    banner("Battery energy storage sizing")
    show("Daily energy served", f"{args.daily_kwh:,.0f}", "kWh/day")
    show("Autonomy", f"{args.autonomy:.2f}", "days",
         f"{args.autonomy * 24:.1f} hours")
    show("Peak power served", f"{args.peak_kw:,.0f}", "kW")
    show("Depth of discharge", f"{args.dod:.2f}")
    show("Round-trip efficiency", f"{args.eta_rt:.2f}")
    show("Inverter efficiency", f"{args.eta_inv:.2f}")
    show("Max continuous C-rate", f"{args.max_c:.2f}", "C")
    print()
    show("Energy requirement", f"{energy_need:,.0f}", "kWh nameplate")
    show("C-rate requirement", f"{crate_need:,.0f}", "kWh nameplate")
    show("Governing constraint", governing)
    print()
    show("Battery nameplate", f"{nameplate:,.0f}", "kWh")
    show("Usable energy", f"{usable:,.0f}", "kWh", f"at {args.dod:.0%} DoD")
    show("PCS rating", f"{pcs_kw:,.0f}", "kW")
    show("System duration", f"{duration:.2f}", "hours",
         f"{1/duration:.2f} C" if duration else "")
    print()
    print(f"  Energy: ({args.daily_kwh:,.0f} kWh x {args.autonomy:.2f} d) / "
          f"({args.dod:.2f} DoD x {args.eta_rt:.2f} RTE x {args.eta_inv:.2f} inv) "
          f"= {energy_need:,.0f} kWh")
    print(f"  C-rate: {pcs_kw:,.0f} kW / {args.max_c:.2f} C = {crate_need:,.0f} kWh")
    print()

    if args.eol_retention < 1.0:
        oversized = nameplate / args.eol_retention
        print(f"  To hold {nameplate:,.0f} kWh at end of life "
              f"({args.eol_retention:.0%} retention),\n  either install "
              f"{oversized:,.0f} kWh on day one or plan augmentation. Day-one "
              "oversizing\n  costs 15-30% more capex; augmentation needs space and "
              "a contractual path.")
        print()

    if duration < 0.5:
        print("  Duration under 0.5 h - confirm this is a power application "
              "(regulation, UPS\n  ride-through) rather than an energy one.")
    elif duration > 12:
        print("  Duration over 12 h - at this point alternative chemistries "
              "(flow, thermal)\n  and a generator hybrid are worth comparing "
              "against Li-ion.")

    print("  NFPA 855 governs installation: per-fire-area energy limits, separation "
          "and\n  explosion control. UL 9540A test data sets the AHJ's spacing "
          "requirements.")


# --------------------------------------------------------------------------
# pf
# --------------------------------------------------------------------------

def cmd_pf(args):
    if not (0 < args.pf_now <= 1 and 0 < args.pf_target <= 1):
        sys.exit("power factors must be between 0 and 1")
    if args.pf_target <= args.pf_now:
        sys.exit("--pf-target must be higher than --pf-now")

    tan1 = math.tan(math.acos(args.pf_now))
    tan2 = math.tan(math.acos(args.pf_target))
    kvar = args.kw * (tan1 - tan2)

    kva1 = args.kw / args.pf_now
    kva2 = args.kw / args.pf_target

    banner("Power factor correction")
    show("Real power", f"{args.kw:,.1f}", "kW")
    show("Existing power factor", f"{args.pf_now:.3f}",
         "", f"{math.degrees(math.acos(args.pf_now)):.1f} deg")
    show("Target power factor", f"{args.pf_target:.3f}",
         "", f"{math.degrees(math.acos(args.pf_target)):.1f} deg")
    print()
    show("Capacitor bank required", f"{kvar:,.1f}", "kVAr")
    show("Apparent power before", f"{kva1:,.1f}", "kVA")
    show("Apparent power after", f"{kva2:,.1f}", "kVA")
    show("Capacity freed", f"{kva1 - kva2:,.1f}", "kVA",
         f"{(1 - kva2/kva1):.1%} reduction")
    print()
    if args.voltage:
        i1 = kva1 * 1000 / (math.sqrt(3) * args.voltage)
        i2 = kva2 * 1000 / (math.sqrt(3) * args.voltage)
        show("Line current before", f"{i1:,.1f}", "A", f"at {args.voltage} V 3-ph")
        show("Line current after", f"{i2:,.1f}", "A")
        show("I2R loss reduction", f"{(1 - (i2/i1)**2):.1%}")
        print()
    print(f"  kVAr = {args.kw:,.1f} x (tan{math.degrees(math.acos(args.pf_now)):.1f}"
          f" - tan{math.degrees(math.acos(args.pf_target)):.1f}) = "
          f"{args.kw:,.1f} x ({tan1:.4f} - {tan2:.4f}) = {kvar:,.1f} kVAr")
    print()
    print("  Where VFDs, rectifiers or UPS are a large share of load, specify "
          "detuned\n  (reactor-connected) capacitors - plain capacitors can "
          "resonate with harmonics.\n  A harmonic study is warranted above roughly "
          "20% non-linear load.")


# --------------------------------------------------------------------------
# transformer
# --------------------------------------------------------------------------

def cmd_transformer(args):
    fla_sec = args.load_kva * 1000.0 / (math.sqrt(3) * args.secondary_v)
    z_pu = args.impedance / 100.0
    isc = fla_sec / z_pu

    sized = None
    for kva in STANDARD_KVA:
        if kva >= args.load_kva / args.max_loading:
            sized = kva
            break

    banner("Transformer sizing and fault duty")
    show("Connected load", f"{args.load_kva:,.1f}", "kVA")
    show("Target max loading", f"{args.max_loading:.0%}")
    show("Secondary voltage", f"{args.secondary_v:,.0f}", "V")
    show("Impedance", f"{args.impedance:.2f}", "%")
    print()
    if sized:
        show("Standard rating", f"{sized:,.1f}", "kVA",
             f"loaded to {args.load_kva/sized:.0%}")
        fla_rated = sized * 1000.0 / (math.sqrt(3) * args.secondary_v)
        isc_rated = fla_rated / z_pu
        show("Secondary FLA at rating", f"{fla_rated:,.1f}", "A")
        show("Available fault current", f"{isc_rated/1000:,.1f}", "kA",
             "infinite primary bus")
    else:
        show("Standard rating", "above 3000 kVA",
             "", "consider multiple units or medium-voltage distribution")
        show("Secondary FLA at load", f"{fla_sec:,.1f}", "A")
        show("Available fault current", f"{isc/1000:,.1f}", "kA",
             "infinite primary bus")
    print()
    ref_isc = isc_rated if sized else isc
    print(f"  I_sc = FLA / Z_pu = {fla_rated if sized else fla_sec:,.0f} A / "
          f"{z_pu:.4f} = {ref_isc:,.0f} A")
    print()
    for aic in (10000, 22000, 35000, 42000, 65000, 100000, 200000):
        if aic >= ref_isc:
            show("Minimum device AIC", f"{aic//1000} kAIC",
                 "", "NEC 110.9, next standard rating above available fault current")
            break
    else:
        print("  Available fault current exceeds 200 kAIC - current-limiting "
              "devices or a\n  higher-impedance transformer are needed.")
    print()
    print("  The infinite-bus figure is conservative and suits feasibility work. "
          "Get the\n  utility's source impedance and run a point-to-point or "
          "software study before\n  specifying equipment for construction.")
    print("  For harmonic-rich load (UPS, VFD, IT), specify a K-rated or "
          "harmonic-mitigating\n  transformer and derate accordingly.")


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def build_parser():
    p = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    # vdrop
    vd = sub.add_parser("vdrop", help="conductor voltage drop")
    vd.add_argument("--amps", type=float, required=True)
    vd.add_argument("--length", type=float, required=True,
                    help="one-way circuit length in feet")
    vd.add_argument("--voltage", type=float, required=True)
    vd.add_argument("--size", required=True, help="e.g. 10, 2, 1/0, 250, 500")
    vd.add_argument("--phase", type=int, choices=[1, 3], default=3)
    vd.add_argument("--material", choices=["cu", "al"], default="cu")
    vd.add_argument("--parallel", type=int, default=1,
                    help="parallel conductors per phase")
    vd.add_argument("--target", type=float, default=3.0,
                    help="design target percent (default 3)")
    vd.set_defaults(func=cmd_vdrop)

    # ampacity
    am = sub.add_parser("ampacity",
                        help="conductor and OCPD selection with derating")
    am.add_argument("--amps", type=float, help="load current, if known")
    am.add_argument("--load-kw", type=float, help="load in kW (alternative to --amps)")
    am.add_argument("--voltage", type=float, default=480)
    am.add_argument("--phase", type=int, choices=[1, 3], default=3)
    am.add_argument("--pf", type=float, default=1.0)
    am.add_argument("--continuous", action="store_true",
                    help="load runs 3 hours or more (applies 125%%)")
    am.add_argument("--ambient", type=float, default=30.0, help="ambient C")
    am.add_argument("--conductors", type=int, default=3,
                    help="current-carrying conductors in the raceway")
    am.add_argument("--material", choices=["cu", "al"], default="cu")
    am.add_argument("--insulation", type=int, choices=[60, 75, 90], default=90,
                    help="conductor insulation rating used for derating")
    am.add_argument("--termination", type=int, choices=[60, 75, 90], default=75,
                    help="equipment termination rating (NEC 110.14(C))")
    am.set_defaults(func=cmd_ampacity)

    # array
    ar = sub.add_parser("array", help="PV array capacity from an energy target")
    ar.add_argument("--annual-kwh", type=float)
    ar.add_argument("--daily-kwh", type=float)
    ar.add_argument("--psh", type=float, required=True,
                    help="plane-of-array peak sun hours, kWh/m2/day")
    ar.add_argument("--pr", type=float, default=0.80, help="performance ratio")
    ar.add_argument("--module-w", type=float, default=550.0, help="module W STC")
    ar.add_argument("--ilr", type=float, default=1.20, help="DC:AC ratio")
    ar.add_argument("--area-m2-per-kw", type=float,
                    help="module area per kW_dc, ~4.5-5.5 for modern modules")
    ar.set_defaults(func=cmd_array)

    # string
    st = sub.add_parser("string", help="string length against the MPPT window")
    st.add_argument("--voc", type=float, required=True, help="module V_oc at STC")
    st.add_argument("--vmp", type=float, required=True, help="module V_mp at STC")
    st.add_argument("--isc", type=float, required=True, help="module I_sc at STC")
    st.add_argument("--beta-voc", type=float, default=-0.27,
                    help="temp coeff of V_oc, %%/C (negative)")
    st.add_argument("--beta-vmp", type=float, default=-0.35,
                    help="temp coeff of V_mp, %%/C (negative)")
    st.add_argument("--tmin", type=float, required=True,
                    help="record low ambient C (ASHRAE extreme annual mean minimum)")
    st.add_argument("--tmax-cell", type=float, default=70.0,
                    help="max cell temperature C")
    st.add_argument("--inv-vmax", type=float, required=True,
                    help="inverter maximum DC input voltage")
    st.add_argument("--inv-mppt-min", type=float, required=True,
                    help="inverter MPPT window lower bound")
    st.add_argument("--module-w", type=float, help="module W STC, for string power")
    st.set_defaults(func=cmd_string)

    # battery
    bt = sub.add_parser("battery", help="battery bank energy and power sizing")
    bt.add_argument("--daily-kwh", type=float, required=True)
    bt.add_argument("--autonomy", type=float, required=True,
                    help="days of autonomy (0.5 = 12 hours)")
    bt.add_argument("--peak-kw", type=float, required=True)
    bt.add_argument("--dod", type=float, default=0.90, help="depth of discharge")
    bt.add_argument("--eta-rt", type=float, default=0.92,
                    help="round-trip efficiency")
    bt.add_argument("--eta-inv", type=float, default=0.97,
                    help="inverter/PCS efficiency")
    bt.add_argument("--max-c", type=float, default=0.5,
                    help="max continuous C-rate")
    bt.add_argument("--eol-retention", type=float, default=0.70,
                    help="end-of-life capacity retention (1.0 to skip)")
    bt.set_defaults(func=cmd_battery)

    # pf
    pf = sub.add_parser("pf", help="power factor correction kVAr")
    pf.add_argument("--kw", type=float, required=True)
    pf.add_argument("--pf-now", type=float, required=True)
    pf.add_argument("--pf-target", type=float, default=0.95)
    pf.add_argument("--voltage", type=float,
                    help="3-phase line voltage, to also show current reduction")
    pf.set_defaults(func=cmd_pf)

    # transformer
    tr = sub.add_parser("transformer", help="transformer rating and fault duty")
    tr.add_argument("--load-kva", type=float, required=True)
    tr.add_argument("--secondary-v", type=float, default=480)
    tr.add_argument("--impedance", type=float, default=5.75, help="%%Z nameplate")
    tr.add_argument("--max-loading", type=float, default=0.80,
                    help="target continuous loading fraction")
    tr.set_defaults(func=cmd_transformer)

    return p


def main():
    args = build_parser().parse_args()
    try:
        args.func(args)
    except ValueError as exc:
        sys.exit(f"error: {exc}")
    print()
    print("  Feasibility-grade. A constructed installation needs a stamped design "
          "coordinated\n  with the AHJ and the interconnecting utility. Tables are "
          "NEC 2023.")
    print()


if __name__ == "__main__":
    main()
