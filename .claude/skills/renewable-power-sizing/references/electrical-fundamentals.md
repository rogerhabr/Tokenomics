# Electrical Fundamentals for Power System Sizing

Clause references are NEC 2023 unless noted. The governing edition is whatever the
AHJ has adopted — check before citing in a deliverable.

## Contents
1. [Power relationships](#1-power-relationships)
2. [Load calculations](#2-load-calculations)
3. [Conductor ampacity and derating](#3-conductor-ampacity-and-derating)
4. [Overcurrent protection](#4-overcurrent-protection)
5. [Voltage drop](#5-voltage-drop)
6. [Transformers](#6-transformers)
7. [Fault current](#7-fault-current)
8. [Power factor correction](#8-power-factor-correction)
9. [Grounding and bonding](#9-grounding-and-bonding)
10. [Motor circuits](#10-motor-circuits)
11. [Common voltage systems](#11-common-voltage-systems)

---

## 1. Power relationships

| Quantity | Single phase | Three phase |
|---|---|---|
| Real power W | `V × I × PF` | `√3 × V_LL × I × PF` |
| Apparent power VA | `V × I` | `√3 × V_LL × I` |
| Current from kW | `1000·kW / (V × PF)` | `1000·kW / (√3 × V_LL × PF)` |
| Current from kVA | `1000·kVA / V` | `1000·kVA / (√3 × V_LL)` |

`PF = kW / kVA = cos φ`. Reactive power `kVAr = √(kVA² − kW²)`.

In a wye system `V_LL = √3 × V_LN`. Balanced three-phase line current equals phase
current in wye; in delta `I_line = √3 × I_phase`.

**Useful anchors** (three phase, PF = 1.0):
- 208 V: 1 A ≈ 0.36 kW → 100 A ≈ 36 kW
- 480 V: 1 A ≈ 0.83 kW → 100 A ≈ 83 kW; 1 MW ≈ 1203 A
- 4160 V: 1 MW ≈ 139 A
- 13.8 kV: 1 MW ≈ 42 A

## 2. Load calculations

**Connected vs. demand load.** Connected load is the sum of nameplates; demand load
applies diversity. Article 220 gives demand factors by occupancy. For engineered
loads (datacenter, industrial process) use a measured or specified diversity, not the
dwelling-unit tables.

**Continuous load** (220.18(B), 210.19(A), 215.2(A)): a load expected to run at its
maximum for 3 hours or more. Feeder/branch conductors and the OCPD must be rated for
`125% × continuous + 100% × non-continuous`. Almost all PV output circuits, EV
charging, and datacenter IT load are continuous.

**Load factor** = average demand / peak demand. Drives storage and generator sizing
much more than peak alone.

**Diversity/coincidence factor** = sum of individual peaks / coincident system peak.
Ask for it rather than assuming 1.0 on a multi-tenant or multi-process site.

## 3. Conductor ampacity and derating

Table 310.16 (not more than three current-carrying conductors in a raceway, ambient
30 °C). Values in amperes.

| Size | Cu 60 °C | Cu 75 °C | Cu 90 °C | Al 75 °C | Al 90 °C |
|---|---|---|---|---|---|
| 14 AWG | 15 | 20 | 25 | — | — |
| 12 | 20 | 25 | 30 | 20 | 25 |
| 10 | 30 | 35 | 40 | 30 | 35 |
| 8 | 40 | 50 | 55 | 40 | 45 |
| 6 | 55 | 65 | 75 | 50 | 55 |
| 4 | 70 | 85 | 95 | 65 | 75 |
| 3 | 85 | 100 | 115 | 75 | 85 |
| 2 | 95 | 115 | 130 | 90 | 100 |
| 1 | 110 | 130 | 145 | 100 | 115 |
| 1/0 | 125 | 150 | 170 | 120 | 135 |
| 2/0 | 145 | 175 | 195 | 135 | 150 |
| 3/0 | 165 | 200 | 225 | 155 | 175 |
| 4/0 | 195 | 230 | 260 | 180 | 205 |
| 250 kcmil | 215 | 255 | 290 | 205 | 230 |
| 300 | 240 | 285 | 320 | 230 | 260 |
| 350 | 260 | 310 | 350 | 250 | 280 |
| 400 | 280 | 335 | 380 | 270 | 305 |
| 500 | 320 | 380 | 430 | 310 | 350 |
| 600 | 350 | 420 | 475 | 340 | 385 |
| 750 | 400 | 475 | 535 | 385 | 435 |

**Small-conductor rule (240.4(D))**: regardless of ampacity, overcurrent protection
is limited to 15 A for 14 AWG Cu, 20 A for 12 AWG Cu, 30 A for 10 AWG Cu (15/25 A for
12/10 AWG Al).

**Termination temperature limit (110.14(C))**: equipment terminations are rated
60 °C (≤100 A circuits, common on small gear) or 75 °C. You may start from the 90 °C
column for derating arithmetic, but the final selected ampacity may not exceed the
termination rating's column value.

**Ambient temperature correction (310.15(B)(2))**:

```
correction = √[ (T_conductor − T_ambient) / (T_conductor − 30) ]
```

where `T_conductor` is the insulation rating (75 or 90 °C). E.g. 90 °C conductor at
45 °C ambient: √(45/60) = 0.87.

**Conduit fill adjustment (310.15(C)(1))**, by number of current-carrying conductors:

| Count | Factor |
|---|---|
| 4–6 | 0.80 |
| 7–9 | 0.70 |
| 10–20 | 0.50 |
| 21–30 | 0.45 |
| 31–40 | 0.40 |
| 41+ | 0.35 |

Neutrals carrying only unbalance are not counted; a neutral on a circuit with
significant harmonic (non-linear) load **is** counted — relevant for datacenter and
UPS feeders.

**Rooftop conduit**: 310.15(B)(3) removed the old 33 °C adder for most cases, but
raceways in direct sun still see elevated ambient. Use the site's ASHRAE 2% design
dry-bulb plus an allowance and state it.

**Parallel conductors (310.10(G))**: permitted for 1/0 AWG and larger; all parallel
sets must be the same length, material, size, and insulation, and terminate the same
way. Count all conductors in the raceway for the fill adjustment.

**Derating order**: `corrected ampacity = table ampacity × temp correction × fill adjustment`,
then compare against the required (already 125%-inflated) current, then cap by
termination rating.

## 4. Overcurrent protection

**Standard OCPD ratings (240.6(A))**: 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90,
100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600, 700, 800, 1000,
1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000 A.

**Next-size-up rule (240.4(B))**: where the conductor ampacity doesn't match a
standard rating, the next standard size above is permitted if the circuit has no
receptacle outlets and the OCPD is 800 A or less. Above 800 A you must go down
(240.4(C)).

**Interrupting rating (110.9)**: the device's AIC must equal or exceed the available
fault current at its line terminals. Common: 10 kAIC (residential/light commercial),
22–65 kAIC (480 V commercial), 100–200 kAIC (large services, series-rated or
current-limiting).

**Selective coordination** is required for emergency systems (700.32), legally
required standby (701.32), and COPS (708.54). It is a study, not a rule of thumb —
say so rather than asserting coordination from breaker ratings alone.

## 5. Voltage drop

```
1φ (2-wire):  VD_volts = 2 × K × L × I / CM
3φ:           VD_volts = √3 × K × L × I / CM
%VD = VD_volts / V_source × 100
```

`K` = 12.9 (copper) or 21.2 (aluminum) ohm-cmil/ft at ~75 °C. `L` = one-way length in
feet. `CM` = circular mils of one conductor (divide the total by the number of
parallel sets).

Circular mils: 14→4110, 12→6530, 10→10380, 8→16510, 6→26240, 4→41740, 3→52620,
2→66360, 1→83690, 1/0→105600, 2/0→133100, 3/0→167800, 4/0→211600, and kcmil sizes are
their number × 1000.

Metric: `VD = (2 or √3) × ρ × L × I / A`, with ρ ≈ 0.0175 Ω·mm²/m (Cu), 0.0282 (Al),
L in metres one-way, A in mm².

**Targets**: 3% on a branch circuit, 5% total feeder + branch (NEC informational
notes — a design target, not an enforceable limit). PV DC circuits are often held to
1–2% because the loss is on the revenue side for the whole life of the plant.

The `K`-method ignores reactance, which is fine below ~200 A and short runs. For long
runs, large conductors, or low PF, use Table 9 effective impedance:
`VD = √3 × I × L/1000 × (R·cos φ + X·sin φ)`.

## 6. Transformers

**Sizing**: `kVA ≥ connected kVA × (1 + growth)`. Common practice is to load a
distribution transformer to 80% or less of nameplate continuously; oversize for
harmonic-rich loads (specify a K-rated transformer, K-4 to K-13, or a dedicated
harmonic-mitigating unit for datacenter/UPS service).

**Standard kVA ratings**: 15, 30, 45, 75, 112.5, 150, 225, 300, 500, 750, 1000, 1500,
2000, 2500, 3000.

**Full-load current**: `FLA = kVA × 1000 / (√3 × V_LL)` (3φ).

**Impedance** `%Z` is on the nameplate; typical 5.75% for 1000–2500 kVA dry-type,
4–6% for smaller units. Lower Z means lower voltage regulation drop but higher
secondary fault current.

**Voltage regulation** ≈ `%Z × load fraction × (R/Z·cos φ + X/Z·sin φ)`; for a quick
figure, a 5.75% Z transformer at full load and 0.9 PF drops roughly 2–3%.

**Primary/secondary protection (450.3)**: for transformers over 600 V primary with
secondary protection at ≤125% of secondary FLA, the primary device may be up to 250%
(300% in some configurations). Below 600 V, 125% of primary FLA with next-size-up
permitted, or 250% if secondary protection is provided per 450.3(B).

**Losses**: no-load (core) loss is constant whenever energized; load (copper) loss
scales with the square of loading. A 1500 kVA dry-type unit is roughly 3–4 kW no-load
and 12–18 kW at full load — material in an annual energy model.

## 7. Fault current

**Infinite-bus approximation** at a transformer secondary:

```
I_sc = FLA_secondary / (Z_pu)          Z_pu = %Z / 100
```

This is conservative (assumes an infinite source), which is what you want for
specifying AIC. Example: 1500 kVA, 480 V, 5.75% Z →
FLA = 1500000/(1.732×480) = 1804 A; I_sc = 1804/0.0575 = 31.4 kA.

**With utility source impedance**, combine per-unit impedances on a common base:
`Z_total,pu = Z_utility,pu + Z_transformer,pu`, then `I_sc = I_base / Z_total,pu`.
The utility provides its available fault current or source impedance on request —
ask for it rather than guessing.

**Conductor let-through / decay**: fault current falls with distance from the source
due to cable impedance. A point-to-point calculation (or SKM/ETAP study) is the right
tool for anything being built; the infinite-bus number is for feasibility.

**Arc flash** (NFPA 70E, IEEE 1584) depends on both available fault current and
clearing time — a *lower* fault current can produce a *higher* incident energy
because the device takes longer to trip. Never infer arc-flash category from fault
current alone.

## 8. Power factor correction

```
kVAr_required = kW × [ tan(arccos PF_existing) − tan(arccos PF_target) ]
```

Example: 800 kW at 0.82 PF corrected to 0.95 →
800 × (0.6979 − 0.3287) = 295 kVAr.

Correcting reduces current (`I ∝ 1/PF`), which frees up conductor and transformer
capacity and cuts I²R loss by `(PF₁/PF₂)²`. Utilities commonly bill a PF penalty
below 0.90–0.95.

**Caution**: capacitors plus non-linear load can create harmonic resonance. Where
VFDs, rectifiers, or UPS make up a large share of the load, specify detuned
(reactor-connected) capacitor banks or an active harmonic filter, and note that a
harmonic study is warranted.

## 9. Grounding and bonding

**Equipment grounding conductor, Table 250.122** (sized from the OCPD rating, Cu):

| OCPD (A) | EGC Cu |
|---|---|
| 15 | 14 AWG |
| 20 | 12 |
| 60 | 10 |
| 100 | 8 |
| 200 | 6 |
| 300 | 4 |
| 400 | 3 |
| 500 | 2 |
| 600 | 1 |
| 800 | 1/0 |
| 1000 | 2/0 |
| 1200 | 3/0 |
| 1600 | 4/0 |
| 2000 | 250 kcmil |

Where conductors are upsized for voltage drop, the EGC must be upsized in the same
proportion (250.122(B)) — a step that is very often missed.

**Grounding electrode conductor, Table 250.66** (sized from the largest ungrounded
service conductor): 2 AWG or smaller → 8 AWG; 1 or 1/0 → 6; 2/0 or 3/0 → 4;
over 3/0 through 350 kcmil → 2; over 350 through 600 → 1/0; over 600 through 1100 →
2/0; over 1100 → 3/0. A GEC to a ground rod alone never needs to exceed 6 AWG.

**PV-specific**: Article 690 Part V. Array grounding is typically via the racking's
listed bonding path (WEEB clips, integrated grounding mid-clamps); an equipment
grounding conductor still runs with the circuit conductors.

## 10. Motor circuits

Motor sizing uses table FLC values (430.248/430.250), **not** the nameplate FLA, for
conductor and OCPD sizing — the nameplate is used for overload protection.

- Branch conductors: 125% of table FLC (430.22)
- Overload protection: 115–125% of nameplate FLA (430.32)
- Short-circuit/ground-fault OCPD (430.52): inverse-time breaker 250% of FLC
  (may go to 400% if it won't start), non-time-delay fuse 300%, dual-element fuse 175%
- Feeder to several motors: 125% of the largest motor's FLC + sum of the others

Starting current is 6–8× FLA across the line; this drives generator and UPS sizing far
more than running load, and is the reason soft starters and VFDs get specified.

## 11. Common voltage systems

| System | Typical use |
|---|---|
| 120/240 V 1φ 3-wire | US residential |
| 208Y/120 V 3φ 4-wire | US commercial receptacle/lighting |
| 480Y/277 V 3φ 4-wire | US commercial/industrial power and lighting |
| 400Y/230 V 3φ 4-wire | IEC standard low voltage |
| 600Y/347 V | Canada |
| 4.16 / 13.8 / 34.5 kV | Medium-voltage distribution, campus and utility-scale PV collection |
| 1500 V DC | Utility-scale PV array (1000 V DC for commercial rooftop) |

Above 600 V (or 1000 V in recent editions) the equipment, clearances, and worker
qualification requirements change substantially — flag the transition rather than
scaling a low-voltage design up.
