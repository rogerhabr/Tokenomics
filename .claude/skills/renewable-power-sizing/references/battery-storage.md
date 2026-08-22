# Battery Energy Storage Sizing

## Contents
1. [Size for energy and power, take the larger](#1-size-for-energy-and-power-take-the-larger)
2. [Chemistry selection](#2-chemistry-selection)
3. [Efficiency and depth of discharge](#3-efficiency-and-depth-of-discharge)
4. [C-rate and duration](#4-c-rate-and-duration)
5. [Degradation and augmentation](#5-degradation-and-augmentation)
6. [Use cases and how each drives sizing](#6-use-cases-and-how-each-drives-sizing)
7. [Off-grid and hybrid systems](#7-off-grid-and-hybrid-systems)
8. [Power conversion and interconnection](#8-power-conversion-and-interconnection)
9. [Code, safety and siting](#9-code-safety-and-siting)
10. [Sanity checks](#10-sanity-checks)

---

## 1. Size for energy and power, take the larger

A battery has two independent ratings and a design must satisfy both. Sizing on
energy alone is the most common error — it produces a bank that holds enough kWh but
can't deliver the peak.

**Energy requirement**:

```
kWh_nameplate = (daily_kWh_served × autonomy_days) / (DoD × η_roundtrip × η_inverter)
```

**Power requirement**:

```
kW_pcs = peak_kW_served / η_inverter
kWh_min_from_C-rate = kW_pcs / C_rate_max
```

Then `kWh_nameplate = max(energy requirement, C-rate requirement)`, and
`kW_pcs = max(power requirement, whatever the application needs for ramping)`.

Example — a site serving 4,000 kWh/day with 12 hours of autonomy (0.5 days) and a
900 kW peak, LFP at DoD 0.90, η_rt 0.92, η_inv 0.97, max continuous 0.5 C:

- Energy: (4000 × 0.5) / (0.90 × 0.92 × 0.97) = **2,490 kWh**
- Power: 900 / 0.97 = **928 kW**
- C-rate floor: 928 / 0.5 = **1,856 kWh** → energy governs
- Result: ~2,500 kWh / 930 kW, a 2.7-hour system

## 2. Chemistry selection

| | LFP (LiFePO₄) | NMC | Lead-acid (AGM/flooded) | Flow (VRB) |
|---|---|---|---|---|
| Usable DoD | 90–100% | 80–90% | 50% (cycle), 80% (rare) | 100% |
| Round-trip (DC) | 92–96% | 93–96% | 75–85% | 65–75% |
| Cycle life @ DoD | 4,000–10,000 | 3,000–6,000 | 500–1,500 | 15,000+ |
| Energy density | Medium | High | Low | Very low |
| Thermal runaway risk | Low | Higher | None | None |
| Typical use | Stationary, the default | EV, space-constrained | Legacy off-grid, engine start | Long duration, 8h+ |

**LFP is the default for stationary storage** and has been since roughly 2021 — it's
cheaper per kWh, safer, and longer-cycling than NMC, and the energy-density penalty
doesn't matter when the battery sits in a container. Recommend it unless the user has
a specific constraint (weight, volume, extreme cold) that argues otherwise.

Sodium-ion is entering the stationary market with lower energy density but better
cold performance and no lithium supply exposure; treat it as emerging, not default.

## 3. Efficiency and depth of discharge

**Round-trip efficiency** is quoted at different boundaries and the difference matters:
- *DC-DC (cell level)*: 95–98% for Li-ion
- *DC-DC (system, includes BMS and thermal)*: 92–96%
- *AC-AC (through the PCS, includes auxiliary load)*: 85–90%

Use AC-AC for anything where the energy goes out to a grid or load — it's the number
that shows up on the meter. **Parasitic load** (HVAC, BMS, fire system) is 1–3% of
throughput and is often omitted from vendor round-trip figures; add it explicitly for
a hot climate.

**Depth of discharge** trades usable energy against cycle life. Modern LFP systems are
typically warranted at 90% DoD daily. The BMS enforces reserve at both ends, so
"usable kWh" on a datasheet is already DoD-adjusted — read carefully whether a quoted
capacity is nameplate or usable, and say which you used.

**Temperature**: capacity falls sharply below 0 °C and cycle life falls above 35 °C.
Assume active thermal management for any system that matters, and include its
parasitic draw.

## 4. C-rate and duration

`C-rate = power (kW) / energy (kWh)`. `Duration (h) = 1 / C-rate`.

| Duration | C-rate | Typical application |
|---|---|---|
| 0.25–0.5 h | 2–4 C | Frequency regulation, UPS ride-through |
| 1–2 h | 0.5–1 C | Peak shaving, capacity market |
| 4 h | 0.25 C | Solar shifting, resource adequacy (the utility-scale standard) |
| 8–12 h | 0.08–0.125 C | Long duration, high-renewable grids |
| 24 h+ | <0.05 C | Off-grid autonomy, islanded systems |

Most containerized LFP products are optimized for 2–4 hour duty. Below ~1 hour you
pay for power electronics you barely use; above ~8 hours the energy cost dominates
and alternative chemistries start to compete.

## 5. Degradation and augmentation

Li-ion loses capacity through calendar aging (time, temperature, average SoC) and
cycle aging (throughput, DoD, C-rate). For LFP cycling once daily, plan on
**2–3%/yr** in early years, tapering; end-of-warranty capacity is typically 70% of
nameplate at year 10 or 15.

Two ways to hold a guaranteed usable capacity over the life:

1. **Oversize on day one** — install `nameplate = required / EOL_retention`. Simple,
   pays for capacity that idles for a decade.
2. **Augment** — install closer to the requirement and add racks at years 5/10.
   Lower NPV, but requires physical space, compatible modules years later, and a
   contractual path. This is standard practice at utility scale.

State which strategy you assumed — it changes capex by 15–30%.

## 6. Use cases and how each drives sizing

| Use case | Sized by | Key input to ask for |
|---|---|---|
| Demand-charge (peak shaving) | Energy above the target kW threshold, worst month | 15-min interval meter data |
| Time-of-use arbitrage | Length of the price spread window | TOU rate schedule |
| Backup / resilience | Critical load × required hours | Critical load list, target hours |
| PV self-consumption | Evening load after sunset | Hourly load + PV production |
| Frequency regulation | Power, not energy | Market product spec |
| Renewable firming / shifting | Shape mismatch between generation and load | 8760 profiles for both |
| Grid-interconnection deferral | Peak kW above the service limit | Service capacity, load forecast |

**Peak shaving math**: for a target reduction of ΔkW, the required energy is the
largest single-day area of the load curve above `peak − ΔkW`. You cannot get this
from a monthly bill — it needs interval data. Say so rather than estimating from
average load, because the answer can be off by 3×.

## 7. Off-grid and hybrid systems

**Autonomy days** is how long the system carries the load with no generation:
- Grid-tied with backup: 0.25–1 day
- Off-grid with a generator backup: 1–2 days
- Off-grid, no generator, good solar resource: 2–3 days
- Off-grid, no generator, poor winter resource: 3–5 days (and the PV array must be
  sized on the *worst month*, not the annual average — usually 1.5–2.5× the
  annual-average sizing)

**Worst-month sizing** is the step people skip. For a year-round off-grid load:

```
kW_dc = daily_kWh / (PSH_worst_month × PR)
```

At 45° latitude, December PSH can be a third of June's. Sizing on the annual mean
produces a system that blacks out every winter. If a generator is in the design, size
PV/battery on an economic optimum instead and state the expected generator runtime
hours per year.

**Hybrid (PV + battery + generator)** dispatch order: PV to load → PV to battery →
battery to load → generator. Size the generator for the peak load (plus motor
starting), not for the battery charge rate, unless it must recharge on a schedule.

## 8. Power conversion and interconnection

The **PCS** (power conversion system) sets the kW rating and whether the system can
form a grid.

- *Grid-following* inverters need an existing grid reference — cheaper, standard for
  grid-tied arbitrage, cannot island.
- *Grid-forming* inverters set voltage and frequency themselves — required for
  off-grid, microgrid, and black-start, and increasingly for large grid-tied plants.

**DC-coupled vs AC-coupled PV+storage**:
- *DC-coupled* shares one inverter; captures otherwise-clipped PV energy; higher
  round-trip for PV charging; qualifies more cleanly for ITC treatment where charging
  source matters.
- *AC-coupled* uses separate inverters; simpler retrofit; independent siting; one
  extra conversion (≈2–3%) when charging from PV.

**Interconnection**: IEEE 1547-2018 (US) governs DER interconnection, including
voltage/frequency ride-through and the abnormal-operating-performance categories.
NEC 705 covers the interconnection wiring, including the **120% busbar rule**
(705.12(B)(3)) for load-side connections. Anything over a utility's fast-track
threshold needs a full study — flag the timeline, since it often exceeds the
construction schedule.

## 9. Code, safety and siting

- **NFPA 855** — Standard for the Installation of Stationary Energy Storage Systems:
  maximum stored energy per fire area (50 kWh for many indoor occupancies without
  extra protection), separation distances, explosion control, and large-scale fire
  testing (UL 9540A) requirements.
- **UL 9540** — system-level listing; **UL 9540A** — cell/module/unit fire propagation
  test data that the AHJ uses to set spacing.
- **UL 1973** — battery modules; **UL 1741 SA/SB** — inverter grid support functions.
- **NEC Article 706** — energy storage systems; **Article 480** — batteries.

Siting drivers: fire separation from property lines and buildings (commonly 3–10 ft
between enclosures, more to occupied structures), ventilation and deflagration
venting, spill containment for flow/lead-acid, and access for a fire department.
Note when a hazard mitigation analysis is required — it usually is for anything
indoors or over the per-fire-area limit.

## 10. Sanity checks

| Metric | Expected |
|---|---|
| Container energy density | 3–6 MWh per 20 ft container (current LFP products) |
| Footprint | 0.4–0.8 acre per 100 MWh including access and setbacks |
| Installed cost | $200–400/kWh (utility, 4h, 2020s market — verify current) |
| Usable vs nameplate | Usable ≈ 0.85–0.95 × nameplate for LFP |
| AC-AC round trip | 85–90%; anything above 92% AC-AC is suspect |
| Duration | If your result is <0.5 h or >12 h, re-check whether power or energy was intended |
