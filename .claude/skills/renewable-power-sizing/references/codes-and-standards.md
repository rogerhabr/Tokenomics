# Codes and Standards Quick Map

Which document governs, and what it actually constrains. Cite the edition — adoption
is jurisdiction-by-jurisdiction, and the AHJ's adopted edition is the one that counts.

## United States

### NEC (NFPA 70) — the wiring rules
Published every 3 years (2017 / 2020 / 2023 / 2026). States adopt on their own
schedule; some amend. Default to **NEC 2023** and say so.

| Article | Scope |
|---|---|
| 110 | General requirements; 110.9 interrupting rating, 110.14(C) termination temperature |
| 210 / 215 | Branch circuits / feeders, including the 125% continuous rule and voltage-drop notes |
| 220 | Load calculations and demand factors |
| 240 | Overcurrent protection; 240.4 conductor protection, 240.6 standard ratings |
| 250 | Grounding and bonding; 250.66 GEC, 250.122 EGC |
| 310 | Conductors; 310.16 ampacity tables, 310.15 correction and adjustment |
| 430 | Motors |
| 450 | Transformers |
| 480 | Stationary standby batteries |
| **690** | **Solar PV systems** — the core article |
| **705** | **Interconnected electric power production sources** |
| **706** | **Energy storage systems** |
| 710 | Stand-alone systems |
| 712 | DC microgrids |

**Article 690 clauses you will use most**:
- 690.7 — maximum voltage (temperature-corrected V_oc)
- 690.8 — circuit sizing and current (the 125% × 125% stack)
- 690.9 — overcurrent protection, series fuse requirements
- 690.11 — DC arc-fault circuit protection
- 690.12 — rapid shutdown for buildings
- 690.13 — PV system disconnecting means
- 690.31 — wiring methods, including PV wire and readily-accessible restrictions
- 690.41 — system grounding and ground-fault protection
- 690.56 — identification of power sources / plaques

**Article 705 clauses**:
- 705.11 — supply-side (line-side tap) connections
- 705.12 — load-side connections, including the **120% busbar rule**: for a busbar fed
  from opposite ends, `utility OCPD + inverter OCPD ≤ 120% × busbar rating`
- 705.13 — power control systems (an alternative to the 120% rule)
- 705.40 — loss of primary source

### Other US documents
- **NFPA 855** — stationary energy storage installation (see battery reference)
- **NFPA 70E** — electrical safety in the workplace; arc flash boundaries and PPE
- **IEEE 1547-2018** — DER interconnection and interoperability; ride-through
  categories, voltage regulation functions
- **IEEE 1584-2018** — arc-flash incident energy calculation
- **UL 1741 SA / SB** — inverter grid-support function certification (SB aligns to
  IEEE 1547-2018)
- **UL 9540 / 9540A** — ESS listing / fire propagation testing
- **UL 3703, UL 2703** — PV trackers / racking and module mounting, bonding
- **ASCE 7** — wind, snow, seismic loads
- **IBC / IFC** — structural and fire code; IFC 1207 covers ESS
- **ASHRAE Fundamentals** — extreme annual design temperatures used in 690.7

## International

- **IEC 60364** — low-voltage electrical installations (the IEC counterpart to the NEC)
  - Part 7-712: PV supply systems
  - Part 7-712 / **IEC 62548**: PV array design requirements — string voltage,
    protection, earthing
- **IEC 61730** — PV module safety qualification; **IEC 61215** — design qualification
  and type approval
- **IEC 62109** — safety of PV power converters
- **IEC 62446** — commissioning tests, documentation and inspection
- **IEC 61683** — inverter efficiency measurement
- **IEC 62933** — electrical energy storage systems
- **EN 50549 / VDE-AR-N 4105 / G99** — grid connection requirements (EU / Germany / UK)
- **AS/NZS 5033** — PV array installation (Australia/NZ); **AS/NZS 3000** wiring rules
- **CSA C22.1 (Canadian Electrical Code)** — Section 64 covers renewable energy systems

## Interconnection process (US, typical)

1. **Screens / fast track** — small systems (often ≤ 20 kW residential, or up to
   2–5 MW under FERC SGIP fast track) pass technical screens and get a quick approval.
2. **Supplemental review** — if a screen fails (e.g. penetration above 15% of line
   peak load), a limited engineering review.
3. **Full study** — feasibility → system impact → facilities study. Months to years,
   with network upgrade costs assigned. This is usually the schedule risk on any
   utility-scale project, and worth flagging early in a feasibility deliverable.

Net metering, net billing, and buy-all/sell-all tariffs differ by state and change
often; don't assert a compensation rate without checking the current tariff.

## How to cite in a deliverable

Write `NEC 2023 Article 690.8(A)` rather than `NEC 690.8` — the edition and the
subsection are both load-bearing. Where a value comes from a standard, put the clause
in the "Basis" column of the results table so a reviewer can check it directly.
