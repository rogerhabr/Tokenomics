# Solar PV Array Sizing

## Contents
1. [The solar resource](#1-the-solar-resource)
2. [Orientation: tilt and azimuth](#2-orientation-tilt-and-azimuth)
3. [Array capacity from an energy target](#3-array-capacity-from-an-energy-target)
4. [The loss stack and performance ratio](#4-the-loss-stack-and-performance-ratio)
5. [Module electrical characteristics](#5-module-electrical-characteristics)
6. [String sizing and the MPPT window](#6-string-sizing-and-the-mppt-window)
7. [Inverter selection and DC:AC ratio](#7-inverter-selection-and-dcac-ratio)
8. [DC circuit sizing](#8-dc-circuit-sizing)
9. [Row spacing, GCR and shading](#9-row-spacing-gcr-and-shading)
10. [Trackers](#10-trackers)
11. [Degradation and lifetime yield](#11-degradation-and-lifetime-yield)
12. [Land, roof and structural constraints](#12-land-roof-and-structural-constraints)
13. [Sanity checks](#13-sanity-checks)

---

## 1. The solar resource

**Peak sun hours (PSH)** = daily plane-of-array insolation in kWh/m²/day. Numerically
the same as the number of hours at 1000 W/m². This is the single most important input
and it is site- and orientation-specific.

Get it from:
- **PVGIS** (re.jrc.ec.europa.eu) — global, free, gives POA by tilt/azimuth
- **NREL NSRDB / PVWatts** (pvwatts.nrel.gov) — Americas and much of the world
- **SolarAnywhere, Solargis, Meteonorm** — commercial, bankable TMY datasets

Rough annual GHI-to-PSH anchors (horizontal; tilted is typically 5–15% higher):

| Region | kWh/m²/day |
|---|---|
| Northern Europe, UK, Pacific NW | 2.5–3.2 |
| Central Europe, US Midwest/Northeast | 3.2–4.2 |
| Mediterranean, US Southeast | 4.2–5.2 |
| US Southwest, Australia, N. Africa | 5.5–6.5 |
| Atacama, Arabian Peninsula | 6.5–7.5 |

Use these to sanity-check a figure, never as a substitute for a site pull. If you
have to proceed without site data, state the assumed PSH explicitly as a placeholder.

**Bankability note**: financings use P50 (median) and P90 (90% exceedance) yields.
P90 is typically 8–12% below P50 for a single year, less for a 10-year average.
If someone is making a financial decision, they need the P-value, not just a mean.

## 2. Orientation: tilt and azimuth

- **Annual energy maximum**: tilt ≈ latitude (a few degrees less at high latitude,
  where diffuse light dominates), azimuth due equator-facing (180° in N hemisphere).
- **Winter-biased** (off-grid, heating load): tilt ≈ latitude + 15°.
- **Summer-biased** (cooling load, irrigation): tilt ≈ latitude − 15°.
- **Utility-scale fixed tilt** often uses a *lower* tilt than optimal (15–25°) to cut
  row spacing, racking cost, and wind load — it trades a few percent of yield for
  significantly more DC per acre.
- **Flat roofs**: 5–10° tilt, often east-west back-to-back, which loses ~10–15% of
  annual yield but nearly doubles the kW per roof area and flattens the profile.

Sensitivity is forgiving. ±15° of azimuth or tilt from optimum typically costs less
than 3% of annual energy — worth knowing before redesigning a layout to chase it.

## 3. Array capacity from an energy target

```
kW_dc = annual_kWh_target / (365 × PSH × PR)
```

or from a daily figure: `kW_dc = daily_kWh / (PSH × PR)`.

Then `module_count = ceil(kW_dc × 1000 / module_W_STC)`, and re-derive the actual
`kW_dc` from the integer module count — that's the number to report.

For an **AC-limited** interconnection (the common utility-scale case) work backwards:
`kW_dc = kW_ac_limit × ILR`, and check that the resulting clipping loss is acceptable.

## 4. The loss stack and performance ratio

PR is the product of the loss terms below. Build it explicitly rather than quoting a
single number, because it shows which assumption is doing the work.

| Loss | Typical | Notes |
|---|---|---|
| Temperature | 4–10% | Highest in hot climates; see §5 |
| Soiling | 1–3% | Up to 8–15% in arid/dusty or agricultural sites without cleaning |
| Shading | 0–5% | Site-specific; near-shading needs a 3D model |
| Mismatch | 1–2% | Module-to-module tolerance and string mismatch |
| DC wiring | 1–2% | Design target; you control this |
| AC wiring + transformer | 0.5–2% | Longer at utility scale |
| Inverter efficiency | 2–3% | CEC/EU weighted efficiency ~97–98.5% |
| Clipping (ILR) | 0–5% | Rises sharply above ILR 1.3 |
| Availability | 0.5–2% | Grid + equipment downtime |
| LID/LeTID | 0.5–2% | First-year light-induced degradation |

Typical resulting PR:
- Rooftop residential/commercial: **0.75–0.82**
- Utility-scale fixed tilt: **0.78–0.84**
- Utility-scale tracking: **0.78–0.85**

Report the PR you used and which terms dominate it.

## 5. Module electrical characteristics

Datasheet values are at **STC**: 1000 W/m², 25 °C cell, AM1.5. Real operation is
hotter and dimmer; **NOCT/NMOT** (800 W/m², 20 °C ambient, 1 m/s wind) is closer to
reality — typically 43–45 °C.

Temperature coefficients (crystalline silicon, per °C):

| Parameter | Typical | Effect |
|---|---|---|
| β(V_oc) | −0.25 to −0.30 %/°C | Voltage **rises** as it gets colder — sets max string length |
| β(V_mp) | −0.30 to −0.40 %/°C | Sets min string length at max cell temp |
| α(I_sc) | +0.04 to +0.05 %/°C | Small; matters for conductor sizing |
| γ(P_max) | −0.29 to −0.40 %/°C | Drives the temperature loss term |

Cell temperature estimate:

```
T_cell ≈ T_ambient + (NOCT − 20) × G / 800
```

with G in W/m². At 35 °C ambient, 1000 W/m², NOCT 45 °C: T_cell ≈ 66 °C, so a module
with γ = −0.35%/°C loses (66−25) × 0.35 = **14%** of its STC power at that instant.
The annual-average temperature loss is much smaller (4–10%) because most energy comes
at lower irradiance and temperature.

**Bifacial modules** add 5–15% (ground-mount over high-albedo surface) via rear-side
gain. Bifacial gain depends on albedo, height, GCR and tracker type — don't assume a
number without a model; quote it as a range and say what it depends on.

## 6. String sizing and the MPPT window

This is a hard constraint, not an optimization: a string that exceeds the inverter's
maximum input voltage on the coldest morning destroys the inverter and voids listing.

**Maximum modules per string** — governed by V_oc at record low temperature
(NEC 690.7; use the ASHRAE Extreme Annual Mean Minimum Design Dry Bulb for the site):

```
V_oc,max = V_oc,STC × [ 1 + β_Voc/100 × (T_min − 25) ]
n_max    = floor( V_inverter,max / V_oc,max )
```

Example: V_oc 49.5 V, β = −0.27 %/°C, T_min = −10 °C, 1500 V inverter →
V_oc,max = 49.5 × [1 + (−0.0027)(−35)] = 49.5 × 1.0945 = 54.2 V →
n_max = floor(1500/54.2) = **27 modules**.

**Minimum modules per string** — governed by V_mp at maximum cell temperature, which
must stay above the MPPT tracking window's lower bound (otherwise the inverter drops
out of tracking and the array under-produces on the hottest, sunniest afternoons):

```
V_mp,min = V_mp,STC × [ 1 + β_Vmp/100 × (T_cell,max − 25) ]
n_min    = ceil( V_mppt,min / V_mp,min )
```

Use T_cell,max of 65–75 °C for ground-mount, up to 80 °C for close-roof-mounted.

Design toward the **upper** end of the permitted range: longer strings mean fewer
strings, less combiner hardware, lower current and therefore lower I²R loss and
smaller conductors. Just leave margin below n_max.

NEC 690.7 also permits using a manufacturer's or an engineer-supplied
temperature-corrected calculation instead of the table; 690.7(A)(3) allows an
industry-standard method for systems ≥100 kW under engineering supervision.

## 7. Inverter selection and DC:AC ratio

**ILR (inverter loading ratio) = kW_dc / kW_ac**.

| Situation | Typical ILR |
|---|---|
| Residential rooftop | 1.05–1.20 |
| Commercial rooftop | 1.10–1.25 |
| Utility fixed tilt | 1.20–1.35 |
| Utility tracking | 1.15–1.30 |
| PV + storage / AC-capacity-limited | 1.30–1.50 |

Higher ILR raises capacity factor and flattens the production curve (good for a
PPA or a load that runs all day) at the cost of clipping. Clipping loss is roughly
0–1% at ILR 1.15, 2–4% at 1.30, 6–10% at 1.45 — but it depends heavily on the
resource shape, so model it rather than quoting a fixed penalty.

**Inverter types**:
- *String inverters* (3–350 kW): rooftop and distributed C&I; module-level MPPT
  granularity per string; easy to swap.
- *Central inverters* (1–5 MW): utility-scale; lowest $/W; a failure takes a large
  block offline.
- *Microinverters / DC optimizers*: per-module MPPT, best where shading is
  unavoidable or the roof has many orientations; higher $/W.

Check: max DC input current per MPPT, max short-circuit current per MPPT, number of
MPPTs, max input voltage, MPPT voltage window, nominal AC voltage and whether a
step-up transformer is included.

## 8. DC circuit sizing

**Maximum circuit current (690.8(A))**: `1.25 × I_sc` (the 125% accounts for
irradiance above 1000 W/m²).

**Conductor ampacity (690.8(B))**: that value again × 125% for continuous duty →
**1.56 × I_sc** before temperature and fill derating. Then apply the derating in
§3 of the electrical-fundamentals reference. PV conductors run hot: rooftop raceways
and free-air PV wire both see high ambient, so the correction factor bites.

**PV wire / USE-2** is used for exposed array wiring (90 °C wet, sunlight-resistant).

**Series fuses**: needed when three or more strings are paralleled on a combiner
(with two strings, neither can source enough back-feed to damage the other). Fuse
rating ≥ 1.56 × I_sc, and ≤ the module's series fuse rating from the datasheet.

**Rapid shutdown (690.12)**: required for buildings — conductors more than 1 ft from
the array must drop to ≤30 V within 30 s, and inside the array boundary to ≤80 V.
This drives module-level electronics on rooftop systems.

**Ground-fault and arc-fault protection**: 690.11 (DC arc-fault) and 690.41(B)
(ground-fault) are inverter-integrated on modern equipment; confirm on the datasheet.

## 9. Row spacing, GCR and shading

**Ground coverage ratio** `GCR = module row width / row pitch`. Typical: 0.30–0.45
fixed tilt, 0.28–0.40 single-axis tracking.

**Minimum row pitch** to avoid inter-row shading at a design time (conventionally
9 a.m.–3 p.m. on the winter solstice):

```
shadow_length = collector_height × cos(azimuth_correction) / tan(solar_altitude)
row_pitch     = collector_width × cos(tilt) + shadow_length
collector_height = collector_width × sin(tilt)
```

Solar altitude at solar noon on the winter solstice: `α = 90° − latitude − 23.45°`.
At 9 a.m./3 p.m. it is much lower, which is why that hour is used.

Modern practice often accepts *some* winter shading, because the energy lost in
December is worth less than the land and racking saved. That's an economic
optimization, not a rule — say which criterion you applied.

**Near shading** (chimneys, parapets, trees, adjacent buildings) needs a 3D model
(HelioScope, PVsyst, Aurora). A rule of thumb for a point obstruction: keep the array
outside a distance of `obstruction_height / tan(α_winter_9am)` to the equator side.

## 10. Trackers

Single-axis horizontal trackers (N-S axis, tracking E-W) gain **15–25%** annual
energy over fixed tilt at low-to-mid latitudes, less at high latitude and in
high-diffuse climates. They add cost, O&M, and terrain constraints (slope tolerance
typically ≤10–15% N-S).

**Backtracking** rotates the modules back toward horizontal at low sun angles to
avoid row-to-row shading; it's standard and should be assumed enabled.

Dual-axis tracking adds only a few more percent over single-axis and is rarely
economic outside CPV or research.

## 11. Degradation and lifetime yield

- Year 1: **1.5–2.5%** (includes LID)
- Years 2+: **0.4–0.6%/yr** for mono PERC/TOPCon; warranties typically guarantee
  ≥87–92% at year 25 (linear) or ≥80% at year 30.

Lifetime energy with a constant rate `d`:

```
E_total = E_year1 × [ 1 − (1−d)^N ] / d
```

For a 25-year life at 0.5%/yr this is about **23.5 × E_year1**, i.e. roughly a 6%
haircut versus assuming no degradation.

## 12. Land, roof and structural constraints

**Area per MW_dc** (all-in, including roads and setbacks):
- Fixed tilt ground mount: 4–6 acres/MW_dc (1.6–2.4 ha)
- Single-axis tracking: 5–8 acres/MW_dc (2.0–3.2 ha)
- Rooftop: roughly 100 W/m² of *array area*; usable roof is typically 50–70% of gross

**Roof load**: ballasted flat-roof racking adds 3–6 lb/ft² (15–30 kg/m²) dead load,
more at the perimeter and corners where wind uplift concentrates. Any roof mount
needs a structural review — say so; don't produce a roof design without one.

**Wind and snow**: ASCE 7 (US) governs; module and racking listings state their
design load (commonly 2400 Pa downward / 1600 Pa uplift, and up to 5400 Pa for
high-snow variants).

## 13. Sanity checks

Before reporting, check these. If one is off, an input is wrong.

| Metric | Expected |
|---|---|
| Specific yield (kWh/kWp/yr) | 900–1,300 temperate; 1,400–1,800 sunny; >2,000 is suspect |
| AC capacity factor | 15–22% fixed tilt; 22–30% single-axis tracking |
| Modules per string | 8–14 (600 V), 14–22 (1000 V), 22–30 (1500 V) |
| Installed cost | $0.70–1.10/W_dc utility; $1.20–2.00 C&I; $2.50–3.50 residential (US, before incentives; verify current market) |
| Area | 4–8 acres per MW_dc ground mount |
