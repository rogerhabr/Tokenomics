---
name: renewable-power-sizing
description: Electrical engineering and solar PV + battery storage sizing. Covers load calculations, conductor and overcurrent-device sizing, ampacity derating, voltage drop, transformer and switchgear selection, fault current, power factor correction and grounding — plus PV array sizing, string/MPPT configuration, inverter DC:AC ratio, tilt/azimuth/row spacing, energy yield and performance ratio, and battery bank autonomy and power sizing. Use this skill whenever the user mentions kW, kVA, amps, voltage drop, wire or cable size, breaker or fuse sizing, panelboard, switchgear, transformer, single-line diagram, PV, solar, modules, inverters, MPPT, string sizing, irradiance, peak sun hours, capacity factor, specific yield, BESS, battery autonomy, microgrid, off-grid, net metering, or datacenter/site electrical capacity — even when they never say "sizing" or "electrical engineering". Also use it when estimating on-site generation, backup power, or the electrical build-out behind an energy cost or tokenomics model.
---

# Renewable Power Sizing

Sizing work is where a hand-wave becomes a number someone spends money on. The goal
of this skill is to make that number **traceable**: every result should come with the
inputs it was derived from, the standard or rule of thumb behind it, and an honest
note about what would change it. A sizing answer without its assumptions is worse
than no answer, because it looks authoritative.

## The one thing to get right

**Never let a derived number lose its assumptions.** A "480 kW array" means nothing
until you say at what performance ratio, in what location, against what load. When
you report, put the assumption next to the number. This matters more than precision:
an engineer can correct an assumption they can see, but not one you buried.

## Workflow

Work in this order. Each step feeds the next, and skipping ahead is the usual cause
of a design that has to be redone.

### 1. Pin down the load

Ask for or establish: peak demand (kW), average demand (kW), annual or daily energy
(kWh), load factor, power factor, service voltage and phase, and whether the load is
*continuous* (runs ≥ 3 hours — it gets a 125% factor on conductors and OCPD).

If the user gives you only one of these, derive the rest and say you did:
- `load factor = average kW / peak kW`
- `annual kWh = average kW × 8760`
- Datacenter-style loads run at load factors of 0.7–0.9; office/commercial 0.2–0.4.

Flag when a load profile is missing entirely. For anything with storage or off-grid
operation, an 8760-hour profile (or at least a typical-day shape) changes the answer
by a lot, and a flat-average assumption should be stated as such.

### 2. Characterize the resource

For PV you need the plane-of-array solar resource, not the horizontal one. The usual
shorthand is **peak sun hours (PSH)** — kWh/m²/day at the array's tilt and azimuth,
numerically equal to the daily POA insolation.

If the user hasn't given a value, ask for the site (lat/long or city) and either use
a figure they supply from PVGIS/NSRDB/PVWatts or use a stated placeholder. Do not
invent a site-specific irradiance figure and present it as data — say "assumed 5.0
PSH, replace with a PVGIS pull for the actual site" instead.

### 3. Size the generation

See `references/pv-array-sizing.md` for the full treatment. The starting point:

```
kW_dc = annual_kWh_target / (365 × PSH × PR)
```

`PR` (performance ratio) bundles temperature, soiling, mismatch, wiring, inverter
efficiency and availability losses. Use 0.75–0.85 for a fixed-tilt system and say
which end you picked and why. Then:
- Choose module count: `n = ceil(kW_dc × 1000 / module_W_stc)`
- Configure strings against the inverter's MPPT window (§ string sizing below)
- Check DC:AC ratio (ILR) — 1.10–1.30 fixed tilt, 1.20–1.45 with storage or a
  flat production profile. Above ~1.3 you start clipping meaningfully.

### 4. Size the storage

See `references/battery-storage.md`. Storage is sized by **both** energy and power;
take the larger:

```
Energy:  kWh_nameplate = (daily_kWh × autonomy_days) / (DoD × η_roundtrip × η_inverter)
Power:   kW_inverter   = peak_kW_to_serve / η_inverter      (also check C-rate limit)
```

Li-ion NMC/LFP: DoD 0.80–0.95, η_roundtrip 0.88–0.95 DC-DC (~0.85–0.90 AC-AC).
Lead-acid: DoD 0.50 for cycle life, η_roundtrip 0.75–0.85.
Add capacity augmentation or oversize for degradation (~2–3%/yr for LFP cycling
daily) if the user cares about end-of-life performance, and say which you did.

### 5. Size conductors and protection

See `references/electrical-fundamentals.md`. The sequence that avoids mistakes:

1. Compute load current (see formulas below).
2. Apply 125% for continuous load → **minimum OCPD rating** and minimum conductor
   ampacity *before* derating.
3. Apply ampacity **corrections** for ambient temperature and **adjustments** for
   conduit fill; the corrected ampacity must still carry the load current.
4. Pick the conductor whose corrected ampacity ≥ required, respecting the
   termination temperature rating (usually 75 °C — you may only use the 90 °C column
   for derating math, not for final selection).
5. Round the OCPD to the next standard size; check it protects the conductor.

`scripts/sizing.py ampacity` does steps 2–5 with the NEC 310.16 tables built in.

### 6. Check voltage drop and fault duty

Voltage drop is a design criterion, not a code requirement in the US (NEC 210.19(A)
and 215.2(A) informational notes suggest 3% branch / 5% total). It usually governs
on long PV feeders, so check it before you commit to a conductor:

```
1φ:  VD = 2 × K × L × I / CM
3φ:  VD = √3 × K × L × I / CM
K = 12.9 (Cu), 21.2 (Al)   ohm-cmil/ft;  L = one-way ft;  CM = circular mils
```

Fault duty sets the interrupting rating (AIC) of breakers and the bracing of gear:

```
I_sc_transformer_secondary ≈ FLA_secondary / Z_pu      (infinite primary bus)
```

Never specify equipment with an AIC below the available fault current, and say when
a real study (with utility source impedance) is needed instead of the infinite-bus
approximation.

### 7. Report

Use the structure under "Output format" below.

## Core formulas

```
Single phase:   P(W)   = V × I × PF
Three phase:    P(W)   = √3 × V_LL × I × PF
Apparent power: S(kVA) = √3 × V_LL × I / 1000      (3φ)
Current:        I      = P / (√3 × V_LL × PF)      (3φ)

PF correction:  kVAr    = kW × (tan(acos PF₁) − tan(acos PF₂))

PV max system voltage (NEC 690.7):
    V_oc,max = V_oc,STC × [1 + β_Voc × (T_min − 25)]     β in %/°C, negative
    Max modules per string = floor(V_inverter,max / V_oc,max)
    Min modules per string = ceil(V_mppt,min / V_mp,at T_cell,max)

PV circuit current (NEC 690.8):  I_design = I_sc × 1.25 × 1.25 = 1.56 × I_sc

Specific yield (kWh/kWp/yr) = annual_kWh / kW_dc      — a sanity check:
    600–900 (N Europe), 1,100–1,500 (US Sun Belt, Mediterranean), 1,600–2,000 (Atacama, MENA)

Capacity factor = annual_kWh / (kW_ac × 8760)
    Fixed-tilt PV 15–22%; single-axis tracking 22–30%.
```

Run the numbers with `scripts/sizing.py` rather than by hand where a subcommand
exists — the tables and derating factors are already in it, and hand arithmetic on
ampacity tables is where errors creep in.

```bash
python3 scripts/sizing.py vdrop      --amps 120 --length 250 --voltage 480 --phase 3 --size "1/0"
python3 scripts/sizing.py ampacity   --load-kw 250 --voltage 480 --phase 3 --pf 0.95 --continuous --ambient 40 --conductors 6
python3 scripts/sizing.py array      --annual-kwh 1500000 --psh 5.2 --pr 0.80 --module-w 550
python3 scripts/sizing.py string     --voc 49.5 --vmp 41.2 --isc 13.9 --beta-voc -0.27 --tmin -10 --tmax-cell 70 --inv-vmax 1500 --inv-mppt-min 860
python3 scripts/sizing.py battery    --daily-kwh 4000 --autonomy 0.5 --peak-kw 900 --dod 0.9 --eta-rt 0.92
python3 scripts/sizing.py pf         --kw 800 --pf-now 0.82 --pf-target 0.95
python3 scripts/sizing.py transformer --load-kva 1500 --impedance 5.75 --secondary-v 480
```

Every subcommand prints its inputs alongside its outputs so the result can be pasted
into a report without losing traceability.

## Reference files

Read the one that matches the job; don't load all three.

| File | Read it when |
|---|---|
| `references/electrical-fundamentals.md` | Load calcs, ampacity tables and derating, OCPD, voltage drop, transformers, fault current, grounding/EGC, motor circuits, power factor |
| `references/pv-array-sizing.md` | Array sizing, module/string/MPPT configuration, tilt, azimuth, GCR and row spacing, shading, loss stack and performance ratio, tracking, degradation |
| `references/battery-storage.md` | Autonomy and power sizing, chemistry selection, C-rate, round-trip efficiency, cycle life and augmentation, peak shaving, off-grid and hybrid dispatch |
| `references/codes-and-standards.md` | Which code clause governs, NEC Article 690/705/706 specifics, IEC/IEEE equivalents, interconnection limits |

## Output format

Structure a sizing result like this. The "Assumptions" and "What would change this"
sections are the ones that make the work reusable — never drop them for brevity.

```markdown
## [System] sizing — [site/context]

### Inputs
| Parameter | Value | Source |
|---|---|---|
| ... | ... | given / assumed / derived |

### Results
| Item | Value | Basis |
|---|---|---|
| ... | ... | e.g. NEC 310.16, 75 °C Cu |

### Assumptions
- Explicit list. Mark each as given by the user, taken from a standard, or assumed.

### What would change this
- The two or three inputs the result is most sensitive to, and roughly how much.
```

Show the calculation for anything non-obvious — one line of arithmetic with the
numbers in it, so a reviewer can follow rather than re-derive.

## Guardrails

**Say what the numbers are for.** These are preliminary/feasibility-grade results.
A constructed installation needs a design stamped by a licensed engineer, coordinated
with the authority having jurisdiction (AHJ) and the interconnecting utility. State
this once in a deliverable — not as a disclaimer on every line, which just adds noise.

**Code editions differ.** NEC changes every three years and adoption is
state-by-state; IEC and local codes apply outside the US. When you cite a clause,
name the edition you're citing (default to NEC 2023 and say so) and note that the
governing edition is whatever the AHJ has adopted.

**Don't fabricate site data.** Irradiance, utility source impedance, soil resistivity,
and record low temperatures are site-specific measurements. Use a clearly-labeled
placeholder and name the source the user should pull from (PVGIS, NSRDB/PVWatts,
ASHRAE extreme annual mean minimum, the utility's system impedance letter).

**Round the way the industry rounds.** OCPD to standard sizes (NEC 240.6), conductors
to standard AWG/kcmil, transformers to standard kVA ratings (15/30/45/75/112.5/150/
225/300/500/750/1000/1500/2000/2500). A "347 A breaker" signals the work wasn't
checked.

**Keep DC and AC straight.** PV capacity is quoted in kW_dc (or MW_dc), inverter and
interconnection capacity in kW_ac. Mixing them silently is the most common error in
solar numbers, and a 1.3 ILR means the two differ by 30%.
