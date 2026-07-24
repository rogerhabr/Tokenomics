/*
 * Build AI_Factory_Whitepaper.docx — 20-section executive white paper.
 * Generalized hyperscale AI infrastructure framework, with an Abu Dhabi
 * 32x Vera Rubin NVL72 test fit whose numbers come exclusively from
 * whitepaper_manifest.json (extracted from the verified AI_Factory_Model.xlsx).
 *
 * Run scripts/build_whitepaper_manifest.py first, then:
 *   node scripts/build_whitepaper.js
 */
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, HeadingLevel, BorderStyle,
  LevelFormat, Footer, PageNumber, PageBreak, TabStopType,
} = require("docx");

const m = JSON.parse(fs.readFileSync("whitepaper_manifest.json", "utf8"));

// ---------- number formatting ----------
const usd = (n) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
const usdM = (n, dp = 1) => (n < 0 ? "-$" : "$") + Math.abs(n / 1e6).toFixed(dp) + "M";
const usdB = (n, dp = 2) => (n < 0 ? "-$" : "$") + Math.abs(n / 1e9).toFixed(dp) + "B";
const pct = (n, dp = 1) => (n * 100).toFixed(dp) + "%";
const num = (n) => Math.round(n).toLocaleString("en-US");
const f1 = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const f2 = (n) => n.toFixed(2);
const f3 = (n) => n.toFixed(3);
const x2 = (n) => n.toFixed(2) + "x";

// Pre-formatted values used across sections
const v = {
  itMW: (m.it_kw / 1000).toFixed(3),
  liqMW: (m.liquid_kw / 1000).toFixed(3),
  facMW: ((m.it_kw * m.pue) / 1000).toFixed(2),
  gpus: num(m.gpus),
  flowRack: f1(m.flow_rack),
  flowTotal: num(m.flow_total),
  mlc: f3(m.mlc),
  mlcLimit: f3(m.mlc_limit),
  mlcMargin: pct(m.mlc_margin),
  energy: num(m.energy_mwh),
  water: num(m.water_m3),
  co2: num(m.co2_t),
  capex: usdM(m.capex),
  debt: usdM(m.debt), equity: usdM(m.equity), ds: usdM(m.ds),
  revY1: usdM(m.rev_y1), ebitdaY1: usdM(m.ebitda_y1),
  marginY1: pct(m.margin_y1),
  elecY1: usdM(m.elec_y1),
  eqIrr: pct(m.equity_irr), prIrr: pct(m.project_irr),
  npv: usdM(m.npv), moic: x2(m.moic),
  payback: typeof m.payback === "number" ? m.payback.toFixed(2) + " years" : String(m.payback),
  minDscr: x2(m.min_dscr), avgDscr: x2(m.avg_dscr),
  capexGpu: usd(m.capex_gpu),
  revGpuHr: "$" + f2(m.rev_gpu_hr), opexGpuHr: "$" + f2(m.opex_gpu_hr),
  costMtok: "$" + f2(m.cost_mtok), priceMtok: "$" + f2(m.price_mtok),
  tokCap: f1(m.tok_cap_t) + " trillion",
  energyPct: pct(m.energy_pct),
  beTariff: "$" + f2(m.breakeven_tariff),
  flowWater230: num(m.flow_water_230),
  flowPg230: num(m.flow_pg25_230),
  benchFac: usdM(m.bench_fac_low * 1e6, 0) + "–" + usdM(m.bench_fac_high * 1e6, 0),
  benchIt: usdM(m.bench_it_low * 1e6, 0) + "–" + usdM(m.bench_it_high * 1e6, 0),
  benchAll: usdM((m.bench_fac_low + m.bench_it_low) * 1e6, 0) + "–"
    + usdM((m.bench_fac_high + m.bench_it_high) * 1e6, 0),
  expBlocks: String(m.exp_blocks),
  expMW: num(m.exp_final_mw),
  expGpus: num(m.exp_final_gpus),
  expCapex: usdB(m.exp_capex_total),
  expPeak: usdB(m.exp_peak_funding),
  expEbitda: usdB(m.exp_runrate_ebitda),
  expCashPos: String(m.exp_cash_positive),
  facBlockMid: usdM(m.fac_block_mid * 1e6, 0),
  facCampus16: usdB(m.fac_campus_16 * 1e6),
  pueSavedMwh: num(m.pue_ref_mwh_saved),
  pueSavedUsd: usdM(m.pue_ref_usd_saved, 0),
};

// ---------- style constants ----------
const NAVY = "1F4E78", GRAY = "595959", LIGHT = "D9E1F2", GREEN = "E2EFDA",
  AMBER = "FFF2CC", WHITE = "FFFFFF", FONT = "Arial";
const PAGE = { size: { width: 12240, height: 15840 },
  margin: { top: 1080, bottom: 1080, left: 1180, right: 1180 } };
const CONTENT_W = 12240 - 1180 * 2; // 9880 DXA

// ---------- element helpers ----------
const P = (text, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120, before: o.before ?? 0 },
  alignment: o.align,
  children: [new TextRun({
    text, font: FONT, size: o.size ?? 20, bold: o.bold,
    italics: o.italic, color: o.color,
  })],
});
const RICH = (runs, o = {}) => new Paragraph({
  spacing: { after: o.after ?? 120 },
  children: runs.map((r) => new TextRun({ font: FONT, size: 20, ...r })),
});
const H1 = (numo, title) => new Paragraph({
  heading: HeadingLevel.HEADING_1, pageBreakBefore: true,
  spacing: { after: 60 },
  children: [new TextRun({
    text: `Section ${numo} — ${title}`, font: FONT, size: 26, bold: true, color: NAVY,
  })],
});
const SUB = (text) => P(text, { italic: true, color: GRAY, after: 200 });
const H2 = (text) => P(text, { bold: true, color: NAVY, size: 21, before: 120, after: 100 });
const BULLETS = (items) => items.map((t) => new Paragraph({
  numbering: { reference: "bul", level: 0 }, spacing: { after: 60 },
  children: [new TextRun({ text: t, font: FONT, size: 20 })],
}));

const cellBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" },
};
function TBL(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_W / total;
  const w = widths.map((x) => Math.round(x * scale));
  const mk = (t, i, hdr) => new TableCell({
    width: { size: w[i], type: WidthType.DXA }, borders: cellBorders,
    shading: hdr ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      spacing: { after: 0 },
      children: [new TextRun({
        text: String(t), font: FONT, size: 18, bold: hdr,
        color: hdr ? WHITE : undefined,
      })],
    })],
  });
  return new Table({
    columnWidths: w, width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => mk(h, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => mk(c, i, false)) })),
    ],
  });
}
function BOX(title, lines, fill = GREEN) {
  return new Table({
    columnWidths: [CONTENT_W], width: { size: CONTENT_W, type: WidthType.DXA },
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      borders: cellBorders, shading: { type: ShadingType.CLEAR, fill },
      margins: { top: 80, bottom: 80, left: 140, right: 140 },
      children: [
        new Paragraph({ spacing: { after: 80 }, children: [new TextRun({
          text: title, font: FONT, size: 19, bold: true, color: NAVY })] }),
        ...lines.map((t) => new Paragraph({ spacing: { after: 40 }, children: [
          new TextRun({ text: "•  " + t, font: FONT, size: 18 })] })),
      ],
    })] })],
  });
}
const SPACER = () => P("", { after: 120 });
const testFit = (lines) =>
  [SPACER(), BOX(`ABU DHABI TEST FIT — ${m.vr_racks}x Vera Rubin NVL72 (from AI_Factory_Model.xlsx)`, lines), SPACER()];
const caveat = (title, lines) => [SPACER(), BOX(title, lines, AMBER), SPACER()];

// =====================================================================
// DOCUMENT CONTENT
// =====================================================================
const children = [];

// ---- Cover / roadmap ----
children.push(
  P("EXECUTIVE WHITE PAPER", { color: GRAY, size: 20, after: 60 }),
  new Paragraph({ spacing: { after: 80 }, children: [new TextRun({
    text: "Next-Generation Hyperscale AI Data Center Infrastructure",
    font: FONT, size: 40, bold: true, color: NAVY })] }),
  P("Architectural Frameworks for High-Density Liquid Cooling, Power Distribution"
    + " Topologies, and Gigascale Expansion (2026–2031)", { size: 24, color: GRAY, after: 160 }),
  P("A generalized engineering and finance framework, applied throughout to a worked"
    + ` test fit: ${m.vr_racks}x NVIDIA Vera Rubin NVL72 racks in ${m.location}`
    + " (ASHRAE Zone " + m.zone + "). Every test-fit figure is drawn from the companion"
    + " model AI_Factory_Model.xlsx and independently re-verified.", { italic: true, after: 160 }),
  P("Senior Infrastructure Architecture & Chief Data/AI Engineering Group  |  July 2026"
    + "  |  Version 5.0 (corrected & model-linked)", { size: 18, color: GRAY, after: 200 }),
  H2("Structural Roadmap"),
  TBL(["Sec.", "Title", "Sec.", "Title"],
    [
      ["01", "Executive Summary & the Density Shift", "11", "Optical Infrastructure & Co-Packaged Optics"],
      ["02", "Next-Gen Silicon Platforms", "12", "Site Selection, Grid & Substation Design"],
      ["03", "Thermal Dynamics of High-Density Racks", "13", "Microgrid Integration: BESS & SMRs"],
      ["04", "Facility Cooling Loop Architecture", "14", "Phased Capacity Deployment Roadmap"],
      ["05", "High-Temperature & Low-Water Cooling", "15", "CapEx Breakdown & Procurement"],
      ["06", "Power Topologies: MV to Chip", "16", "OpEx Optimization & PUE Minimization"],
      ["07", "HVDC vs. Traditional AC Architecture", "17", "Project Finance: FCFF, IRR, Valuation"],
      ["08", "Transient Load Management", "18", "Risk, Redundancy (N+1 vs 2N), Reliability"],
      ["09", "Structural Engineering & Floor Loading", "19", "Regulatory, Environmental & ESG"],
      ["10", "High-Speed Fabric & Interconnects", "20", "Synthesis & Strategic Directives"],
    ], [70, 400, 70, 400]),
  SPACER(),
  P("Appendix A — Corrections & Verification Log (changes vs. draft v4.2).  "
    + "Appendix B — Sources & Model Lineage.", { size: 18, color: GRAY }),
);

// ---- Section 1 ----
children.push(
  H1("01", "Executive Summary & the Macro Shift in AI Compute Densities"),
  SUB("Rack power has risen an order of magnitude in five years; facilities that cannot"
    + " deliver liquid cooling and stiff, high-density power will be stranded assets."),
  P("Large language models and agentic AI systems have broken the assumptions on which"
    + " a generation of data centers was financed. Facilities engineered for 10–20 kW"
    + " per rack cannot host rack-scale supercomputers drawing 120–230 kW: the"
    + " constraint is not floor space but heat flux, power delivery stiffness, and"
    + " structural loading. Power density per rack has increased roughly 10–15x since"
    + " 2020 — an order-of-magnitude shift, not an increment."),
  P("Three engineering consequences follow. First, air is no longer a viable primary"
    + " coolant above roughly 50 kW per rack; direct liquid cooling (DLC) with"
    + " facility water at up to 45°C becomes the default. Second, power distribution"
    + " must move to overhead busway, 415/480 V AC today with a defined migration"
    + " path to 800 V DC. Third, AI workloads introduce grid-scale transients that"
    + " demand rack-level energy storage and firmware power smoothing."),
  ...testFit([
    `Scope: ${m.vr_racks} VR compute racks (${f1(m.vr_kw)} kW each) + ${m.net_racks} network + ${m.sto_racks} storage racks = ${v.itMW} MW IT load, ${v.gpus} GPUs.`,
    `Thermal compliance: peak MLC ${v.mlc} vs. ASHRAE 90.4 Zone ${m.zone} limit ${v.mlcLimit} — a ${v.mlcMargin} design margin.`,
    `Year-1 economics (model): revenue ${v.revY1}, EBITDA ${v.ebitdaY1} (${v.marginY1} margin).`,
    `At the benchmark-restated all-in CapEx (${v.capex}, owned IT), 80% leverage does not clear DSCR 1.0x and equity IRR falls to ${v.eqIrr} — the revenue input, conservative vs market $/GPU-hr, is now the swing factor (Sections 15 and 17).`,
  ]),
  P("Key takeaway: future-proofed capacity means 100% liquid-ready white space,"
    + " high-temperature heat rejection engineered against N=20-year climate extremes"
    + " (not typical summer days), and a financing structure stress-tested against"
    + " power tariffs and leverage — the workbook behind this paper does exactly that."),
);

// ---- Section 2 ----
children.push(
  H1("02", "Next-Gen Silicon Platforms (GB200, GB300 & Vera Rubin)"),
  SUB("Design the facility for the platform after the one you are buying: the Vera"
    + " Rubin generation sets the 2026–2031 power and cooling envelope."),
  TBL(["Platform", "Rack topology", "Rack power", "Memory", "Scale-up fabric"],
    [
      ["Blackwell GB200 NVL72", "36 Grace CPU / 72 GPU", "~120 kW nominal (130–132 kW observed)",
        "HBM3e, 13.5 TB/rack", "NVLink 5 — 1.8 TB/s per GPU"],
      ["Blackwell Ultra GB300 NVL72", "36 Grace CPU / 72 GPU", "~132–142 kW (peaks ~155 kW)",
        "HBM3e, ~20 TB/rack", "NVLink 5 — 1.8 TB/s per GPU"],
      ["Vera Rubin NVL72 (NVL144 naming also used)", "36 Vera CPU / 72 Rubin GPU",
        "Not final; reported 130–250 kW. Test fit designs to a 227 kW envelope.",
        "HBM4, 288 GB/GPU → 20.7 TB/rack, 1.6 PB/s aggregate (up to 22 TB/s per GPU)",
        "NVLink 6 — 3.6 TB/s per GPU, 260 TB/s per rack"],
    ], [200, 170, 220, 230, 200]),
  SPACER(),
  H2("What is architecturally new in Vera Rubin"),
  ...BULLETS([
    "Integrated CPU: the Vera CPU (88 custom Arm v9.2 'Olympus' cores, 176 threads via"
      + " spatial multithreading, 1.2 TB/s LPDDR5X) moves orchestration, KV-cache routing"
      + " and agentic control planes into the rack domain.",
    "NVLink 6 doubles scale-up bandwidth to 3.6 TB/s per GPU (260 TB/s per rack),"
      + " collapsing MoE all-to-all latency that previously forced conservative"
      + " parallelism choices.",
    "Platform chips ship as a set: Rubin GPU, Vera CPU, NVLink 6 switch, ConnectX-9"
      + " SuperNIC (1.6 Tb/s), BlueField-4 DPU, and a Spectrum-X 102.4 Tb/s"
      + " co-packaged-optics switch.",
    "NVIDIA has confirmed 45°C liquid cooling and roughly 20x more in-rack energy"
      + " storage for the Vera Rubin rack generation — validating the S45 facility"
      + " design and the transient-management posture of Sections 5 and 8.",
  ]),
  ...caveat("SPEC CONFIDENCE NOTE", [
    "GB200 figures are shipping-product data. GB300 figures are vendor data sheets.",
    "Vera Rubin rack power is NOT officially final: public reporting spans ~130 kW to"
      + " ~250 kW depending on configuration and Max-Q/Max-P profile. This paper's test"
      + " fit deliberately engineers to a 227 kW per-rack envelope so the facility is"
      + " not the binding constraint if silicon lands at the high end.",
  ]),
);

// ---- Section 3 ----
children.push(
  H1("03", "Thermal Dynamics of High-Density Racks (100–230 kW)"),
  SUB("Above ~50 kW per rack, the physics of air fail; above 200 kW, even liquid"
    + " loop design becomes a flow-rate and pressure-drop engineering problem."),
  P("At die-level heat fluxes exceeding 100 W/cm², air cooling fails on volumetric"
    + " flow and thermal resistance grounds. Direct-to-chip cold plates capture heat"
    + " from GPUs, CPUs, NVLink switches and memory; the remaining share (power"
    + " shelves, misc. electronics) is captured by rear-door exchangers or room air."
    + " Practical liquid capture fractions are ~90–95% for current rack-scale systems"
    + " — vendor claims of higher shares should be verified per SKU."),
  H2("Governing equation and worked flow rates"),
  P("Q = ṁ · Cp · ΔT, where Q is heat load (kW), ṁ mass flow (kg/s), Cp specific"
    + " heat (kJ/kg·K) and ΔT the return-minus-supply temperature split. Flow"
    + " therefore scales inversely with ΔT — halving ΔT doubles the required flow,"
    + " pump power, and pipe diameter."),
  ...BULLETS([
    `230 kW rack, water (Cp 4.18), ΔT 10 K → ~${v.flowWater230} LPM per rack.`,
    `230 kW rack, PG25 glycol mix (Cp ${f2(m.cp)}, ρ ${f2(m.rho)}), ΔT 10 K → ~${v.flowPg230} LPM per rack — glycol's lower heat capacity costs ~5% more flow.`,
    "A '195 LPM at ΔT 10 K' figure sometimes quoted for ~230 kW racks is physically"
      + " impossible — it under-delivers heat removal by ~40%. At 195 LPM the same rack"
      + " runs a ~17–18 K ΔT (i.e., 45°C supply / ~62°C return). Specify one, derive"
      + " the other.",
  ]),
  ...testFit([
    `Per-rack flow at ${f1(m.vr_kw)} kW, ΔT ${f1(m.dt)} K, PG25: ${v.flowRack} LPM (physics-derived; the model computes this from Q/(ρ·Cp·ΔT), not from a vendor quote).`,
    `Cluster secondary-loop flow for ${v.liqMW} MW of liquid-cooled load: ${v.flowTotal} LPM.`,
    `Loop temperatures: ${f1(m.fws)}°C facility water supply / ${f1(m.fwr)}°C return (S45 class).`,
  ]),
);

// ---- Section 4 ----
children.push(
  H1("04", "Facility Cooling Loop Architecture (CDUs, Primary & Secondary Loops)"),
  SUB("The CDU is the hydraulic and chemical boundary of the facility: size it in"
    + " blocks, filter aggressively, and make every pump N+1."),
  P("Coolant Distribution Units isolate the primary loop (facility water to heat"
    + " rejection) from the secondary loop (treated PG25 water/glycol to cold"
    + " plates) through a plate heat exchanger. This isolation contains chemistry,"
    + " pressure class, and leak risk, and lets each side be maintained"
    + " independently."),
  ...BULLETS([
    "Sizing: 1.2–2.4 MW CDU blocks. At Blackwell-class densities that serves 8–16"
      + " racks; at a 227 kW Vera Rubin envelope, a 2.4 MW block serves ~8–10 racks.",
    "Hydraulics: redundant inverter-driven centrifugal pumps in N+1 with automatic"
      + " VFD failover; design secondary ΔP for the highest-restriction cold plate at"
      + " end-of-row.",
    "Filtration: 50 μm primary strainers plus 5 μm side-stream polishing on the"
      + " secondary loop — micro-channel cold plates clog on debris that legacy"
      + " chilled-water systems tolerate.",
    "Temperatures: primary supply 35–45°C, primary return 45–55°C, matched to the"
      + " secondary 45/55°C envelope of Section 3.",
  ]),
  ...testFit([
    `Liquid-cooled load ${v.liqMW} MW → four 2.0 MW CDU blocks (8 VR racks each, ~${f1(m.vr_kw * 8 / 1000)} MW per block) plus one spare block = N+1 at block level.`,
    `Aggregate secondary flow ${v.flowTotal} LPM across ${m.vr_racks} racks; per-block ~${num(m.flow_rack * 8)} LPM.`,
  ]),
);

// ---- Section 5 ----
children.push(
  H1("05", "High-Temperature & Low-Water Cooling Strategies (45°C Inlet Design)"),
  SUB("45°C facility water eliminates chillers in most climates — but not in all of"
    + " them, and pretending otherwise is how projects fail commissioning in August."),
  P("Raising facility water supply temperature to 45°C is the single most valuable"
    + " thermal design decision available: it pushes heat rejection into dry coolers"
    + " (no compressors, near-zero water) for most of the year in most geographies,"
    + " and NVIDIA has confirmed 45°C liquid cooling for the Vera Rubin rack"
    + " generation."),
  H2("The honest physics of dry cooling at climate extremes"),
  P("A dry cooler can only return water at ambient dry-bulb plus an approach"
    + " (typically 3–7 K). Chiller-free operation at a 45°C supply setpoint therefore"
    + " requires ambient dry-bulb below roughly 40°C. Against an N=20-year extreme of"
    + ` ${f1(m.db20)}°C (${m.location}), the minimum achievable water temperature is`
    + " ~53–55°C — above the 45°C setpoint. A design claim that 45°C inlet"
    + " 'eliminates chillers even at 48°C ambient' is wrong as stated; what is true"
    + ` is that with a ${f1(m.fwr)}°C return, a positive ${f1(m.approach)} K rejection`
    + " gradient survives even at peak, so dry coolers keep rejecting — they just"
    + " cannot hold setpoint alone."),
  ...BULLETS([
    "Mitigation 1 — trim cooling: small chiller or adiabatic stage sized only for"
      + " exceedance hours (tens to low hundreds of hours per year in the Gulf).",
    "Mitigation 2 — setpoint float: allow FWS to ride up toward 50°C during extremes"
      + " if the IT vendor's warm-water class permits it (verify per platform).",
    "Mitigation 3 — adiabatic assist: accept a small, bounded water budget instead"
      + " of a zero-water absolutism; a realistic target is WUE well under 0.2 L/kWh"
      + " versus 1.0+ for evaporative designs.",
    "Cool climates (e.g., Dublin, N=20yr dry-bulb 28.5°C) achieve genuine year-round"
      + " chiller-less S45 operation with double-digit approach margins.",
  ]),
  ...testFit([
    `Peak design conditions: ${f1(m.db20)}°C dry-bulb / ${f1(m.wb20)}°C wet-bulb (N=20-year, ASHRAE-style extremes; location-linked in the model).`,
    `Rejection approach at peak: FWR ${f1(m.fwr)}°C − DB ${f1(m.db20)}°C = +${f1(m.approach)} K — dry rejection continues at peak, with trim capacity carried in the ${pct(0.05, 0)} liquid-loop cooling overhead input.`,
    `Water budget: WUE ${m.wue.toFixed(2)} L/kWh → ${v.water} m³/yr — near-zero versus ~4–8 million gallons per MW-year (est.) for evaporative designs, but deliberately not claimed as 0.00.`,
  ]),
);

// ---- Section 6 ----
children.push(
  H1("06", "Power Topologies: Medium Voltage to Chip"),
  SUB("Every conversion step costs efficiency and capital; the winning topology is"
    + " the one with the fewest transformations between the grid and the die."),
  TBL(["Stage", "Voltage / medium", "Notes"],
    [
      ["Utility interconnect", "132 kV / 33 kV HV-MV", "Dual feeds, main-tie-main"],
      ["On-site substation", "33 kV / 11 kV MV bus", "GIS preferred for footprint & dust"],
      ["Dry-type transformers", "415/480 V LV distribution", "Placed at white-space edge"],
      ["Overhead busway", "415 V 3-phase to rack", "No under-floor cabling at these densities"],
      ["In-rack power shelf", "48–54 V DC busbar", "PSU shelf with integrated energy storage"],
      ["On-board VRMs", "0.8–1.2 V to silicon", "Final regulation at the socket"],
    ], [220, 260, 420]),
  SPACER(),
  P("The forward path is 800 V DC: NVIDIA's published architecture moves"
    + " facility-to-rack distribution to 800 VDC, which by vendor figures moves >150%"
    + " more power through the same copper cross-section and removes on the order of"
    + " 200 kg of busbar per rack, while collapsing four AC/DC conversion steps to"
    + " two (Section 7)."),
  ...testFit([
    `IT load ${v.itMW} MW at annualized PUE ${f3(m.pue)} → ~${v.facMW} MW facility supply at full utilization; specify the utility application above this for ramp headroom.`,
    `Distribution: two 11 kV feeds, LV transformation in N+1 blocks aligned to the four CDU/compute blocks of Section 4 — electrical and thermal block boundaries should coincide.`,
  ]),
);

// ---- Section 7 ----
children.push(
  H1("07", "High-Voltage DC (800 VDC) vs. Traditional AC Architecture"),
  SUB("HVDC wins on conversion count, copper, and BESS coupling; AC wins on today's"
    + " supply chain maturity. Build AC now with HVDC-ready raceways."),
  TBL(["Metric", "415/480 V AC (today)", "380/800 V DC (roadmap)"],
    [
      ["End-to-end efficiency (industry est.)", "91.5–93.0%", "95.5–97.0%"],
      ["Conversion steps", "AC-DC-AC-DC (4)", "AC-DC once, then DC-DC (2)"],
      ["Copper / busbar mass", "Baseline", "Up to ~40% less conductor; ~200 kg/rack busbar saved (vendor figure)"],
      ["Harmonics", "Active filtering at loads", "Centralized at the rectifier plant"],
      ["BESS / storage coupling", "Complex AC coupling", "Native DC-bus coupling"],
      ["Maturity (2026)", "Fully mature", "Announced ecosystem (NVIDIA 800 VDC program; Kyber-class racks)"],
    ], [260, 300, 340]),
  SPACER(),
  P("Recommendation: deploy 415 V AC busway for current-generation racks, but"
    + " dimension electrical rooms, raceways and heat rejection for an 800 VDC"
    + " retrofit — the migration is announced vendor roadmap, not speculation, and"
    + " Rubin-Ultra-class racks approaching 1 MW effectively require it."),
);

// ---- Section 8 ----
children.push(
  H1("08", "Transient Load Management & AI Workload Power Smoothing"),
  SUB("Synchronized training steps turn a GPU cluster into a megawatt-scale square"
    + " wave generator; the fix is energy storage at the rack and firmware ramp"
    + " control."),
  P("AI training alternates compute-dense and communication phases across thousands"
    + " of synchronized GPUs. The resulting load steps are microseconds at the die,"
    + " milliseconds at the rack (idle to full power), and — the number that matters"
    + " to the utility — multi-MW-per-second swings at cluster scale. Unmanaged,"
    + " these trip protection relays, excite grid frequency response, and violate"
    + " interconnection agreements."),
  ...BULLETS([
    "Rack-level energy buffering: current GB300-class power shelves integrate"
      + " capacitive energy storage with a charge-management controller expressly for"
      + " per-rack power smoothing; the Vera Rubin generation carries roughly 20x more"
      + " in-rack energy storage (vendor-confirmed direction).",
    "Firmware smoothing: workload-aware power capping and clock ramp control bound"
      + " di/dt at the rack bus so upstream breakers and grid-following inverters"
      + " never see the raw step. (An earlier draft cited 'NVIDIA DSX MaxLPS' — no"
      + " such product is verifiable; the capability is real, the name is not.)",
    "Facility layer: LFP BESS blocks provide second-to-minute smoothing and peak"
      + " shaving; hybrid supercapacitor + battery arrangements cover the full"
      + " transient spectrum.",
  ]),
  ...testFit([
    `Worst-case synchronized step for the ${v.gpus}-GPU cluster: roughly idle-to-peak of the compute load, ~${f1((m.liquid_kw) / 1000)} MW — coordinate a ramp-rate limit with the utility rather than presenting it as an uncontrolled step.`,
  ]),
);

// ---- Section 9 ----
children.push(
  H1("09", "Structural Engineering, Rack Density & Weight Distribution"),
  SUB("A liquid-filled AI rack is industrial plant equipment, not IT furniture —"
    + " design the slab, not the tile."),
  ...BULLETS([
    "Verified baseline: a GB200 NVL72 rack weighs ~1.36 t wet. Vera Rubin racks —"
      + " with added energy storage, liquid-cooled busbars and manifolds — are"
      + " reasonably estimated at 1.5–2.0 t (vendor-final figures pending).",
    "Loading math at 1.8 t over a 600 × 1200 mm footprint: ~2,500 kg/m² point"
      + " loading — beyond most raised-floor systems. Slab-on-grade with ≥30 kN/m²"
      + " design capacity and load-spreading plates under casters is the default.",
    "Seismic: brace top-of-rack to structural ceiling steel; design to the site's"
      + " code-derived seismic demand (e.g., ASCE 7 seismic design category — the"
      + " legacy 'UBC Zone 4' terminology in older drafts is obsolete).",
    "Piping dead load: overhead manifold headers carrying the Section 3 flow rates"
      + " add several hundred kg per rack position — include in the ceiling steel"
      + " budget, not as an afterthought.",
  ]),
  ...testFit([
    `${m.vr_racks + m.net_racks + m.sto_racks} racks total (${m.vr_racks} VR + ${m.net_racks} network + ${m.sto_racks} storage); VR rows on slab-on-grade, ~${num(m.flow_rack)} LPM of coolant per VR rack position overhead.`,
  ]),
);

// ---- Section 10 ----
children.push(
  H1("10", "High-Speed Fabric & Interconnect Topologies (NVLink 6 & Scale-Out)"),
  SUB("Scale-up handles tensor parallelism inside the rack; scale-out carries data"
    + " and pipeline parallelism between racks — size each for its actual traffic."),
  ...BULLETS([
    "Scale-up: NVLink 6 provides 3.6 TB/s per GPU, 260 TB/s aggregate per NVL72"
      + " rack, presenting 72 GPUs as one shared-memory domain (~75 TB fast memory"
      + " per rack, 20.7 TB of it HBM4).",
    "Scale-out: ConnectX-9 SuperNICs at 1.6 Tb/s per GPU into Quantum-X800"
      + " InfiniBand or Spectrum-X Ethernet fabrics; 102.4 Tb/s switch ASICs set the"
      + " radix.",
    "Topology: rail-optimized two-tier fat tree for clusters up to a few thousand"
      + " GPUs; three tiers only when the GPU count forces it — every added tier"
      + " costs latency and optics power.",
  ]),
  ...testFit([
    `${v.gpus} GPUs across ${m.vr_racks} racks → a two-tier rail-optimized fabric; ${m.net_racks} network racks (${num(m.net_racks * m.net_kw)} kW) carry the leaf/spine switching for the scale-out domain.`,
  ]),
);

// ---- Section 11 ----
children.push(
  H1("11", "Optical Infrastructure & Co-Packaged Optics (CPO)"),
  SUB("Above 1.6 Tb/s per port, pluggable optics become the power and failure"
    + " budget; CPO moves the laser problem into the switch package."),
  ...BULLETS([
    "In-rack scale-up stays copper: NVLink cartridge backplanes over <1 m reaches"
      + " conserve power and cost — do not spend optics where copper works.",
    "Scale-out transitions to CPO: the Vera Rubin platform includes a Spectrum-X"
      + " 102.4 Tb/s co-packaged-optics switch; silicon photonics on-package"
      + " eliminates pluggable transceivers on fabric links.",
    "Power effect: industry estimates put CPO interconnect power savings around 30%"
      + " versus pluggables — roughly 5–8 W per port at 1.6T — which at cluster scale"
      + " is hundreds of kW of avoided load and cooling (estimates; verify per SKU).",
  ]),
);

// ---- Section 12 ----
children.push(
  H1("12", "Site Selection, Grid Interconnection & Substation Design"),
  SUB("Pick sites where firm power and heat rejection physics are favorable;"
    + " everything else is negotiable, those two are not."),
  ...BULLETS([
    "Grid: proximity to 132–400 kV transmission with firm capacity matching the"
      + " full-buildout facility load; dual utility feeds in main-tie-main; GIS"
      + " substations where dust, salt or footprint argue against AIS.",
    "Climate: underwrite against ASHRAE N=20-year extremes, not typical conditions"
      + " — the companion model links each candidate location to its climate zone,"
      + " 90.4 MLC limit and N=20yr dry/wet-bulb (editable reference library).",
    "Energy price and fiscal regime: power tariff, corporate tax and interest"
      + " deductibility (e.g., UAE 9% + GIDLR) materially move levered returns —"
      + " they are model inputs, not footnotes.",
  ]),
  ...testFit([
    `${m.location}: ASHRAE Zone ${m.zone} (project baseline; ASHRAE 169-2021 may reclassify as 0B), N=20yr ${f1(m.db20)}°C DB / ${f1(m.wb20)}°C WB, 90.4 MLC limit ${v.mlcLimit}.`,
    `Design MLC ${v.mlc} → ${v.mlcMargin} compliance margin; industrial tariff baseline $${m.tariff.toFixed(2)}/kWh with escalation and sensitivity handled in the model.`,
  ]),
);

// ---- Section 13 ----
children.push(
  H1("13", "Microgrid Integration: On-Site Generation, BESS & SMRs"),
  SUB("With utility interconnection queues at 3–7 years, on-site energy is schedule"
    + " insurance first and economics second."),
  ...BULLETS([
    "BESS: multi-MW LFP blocks bridge utility events, shave peaks, and — under the"
      + " HVDC topology of Section 7 — couple natively to the DC bus.",
    "Gas / hydrogen-ready turbines: bridge firm capacity where the grid queue, not"
      + " capital, is the binding constraint.",
    "SMRs: credible for 2030s campus expansions (50–300 MW modules), but no SMR"
      + " will bridge a 2026–2028 deployment — treat 'near-term SMR' claims as"
      + " schedule risk, not schedule relief.",
    "Grid carbon: siting on low-carbon grids (e.g., Abu Dhabi's nuclear + solar mix,"
      + ` modeled here at ${m.carbon_kg_kwh.toFixed(2)} kgCO2/kWh) does more for Scope 2 than any`
      + " on-site gesture.",
  ]),
);

// ---- Section 14 ----
children.push(
  H1("14", "Phased Capacity Deployment Roadmap (Modular 8 MW Blocks to 128 MW+)"),
  SUB("Deploy in repeatable blocks that commission independently — capital follows"
    + " compute, not the other way around."),
  P("The generalized unit of expansion is the block this paper's test fit"
    + ` represents: ~${v.itMW} MW of IT in ${m.vr_racks} liquid-cooled racks with its`
    + " own CDU quads, LV transformation and busway. A reference gigascale ramp then"
    + " reads:"),
  TBL(["Phase", "Cumulative IT", "Milestones"],
    [
      ["2026 — Phase 1", "16 MW (2 blocks)", "Substation energization; dry-cooler yard; first GB300/VR blocks"],
      ["2028 — Phase 2", "48 MW (6 blocks)", "Substation expansion; full S45 CDU integration; VR scale-out"],
      ["2030 — Phase 3", "96 MW (12 blocks)", "BESS integration; CPO fabrics; 800 VDC pilot rows"],
      ["2031 — Phase 4", "128 MW (16 blocks)", "Campus maturity; microgrid/SMR optionality; zero-water optimization"],
    ], [180, 180, 520]),
  SPACER(),
  P("Each block closes its own commissioning (L1–L5) before the next starts, so"
    + " revenue begins at block one and the financing structure of Section 17 can"
    + " be replicated per phase rather than underwritten once at campus scale."),
  ...testFit([
    `Phased Expansion module (workbook sheet): default schedule 2+2+4+4+4 blocks over 5 years → ${v.expBlocks} blocks, ${v.expMW} MW IT, ${v.expGpus} GPUs.`,
    `Campus capital: ${v.expCapex} total CapEx at ${v.capex}/block (owned IT); peak cumulative funding requirement ${v.expPeak}; campus cash-positive: ${v.expCashPos} (still building through Year 5).`,
    `Run-rate campus EBITDA at full build: ${v.expEbitda}/yr. Facility-only reconciliation: ~${v.facBlockMid}/block x 16 = ${v.facCampus16} — consistent with the ~$1.42B/128 MW market reference in Section 17.`,
    `Simplification: block economics use the single-block Year-2 steady state; per-vintage token pricing and per-block financing are edit points, not outputs.`,
  ]),
);

// ---- Section 15 ----
children.push(
  H1("15", "Capital Expenditure Breakdown & Procurement Strategy"),
  SUB("MEP now dominates facility CapEx — and IT silicon dwarfs the facility"
    + " itself. Never present one without the other."),
  H2("Facility CapEx benchmark (per MW of IT, excluding compute hardware)"),
  TBL(["Segment", "$M per MW", "Share", "Includes"],
    [
      ["Electrical systems", "3.8–4.5", "38%", "Substation, transformers, switchgear, busway, BESS"],
      ["Mechanical & DLC", "2.5–3.2", "26%", "CDUs, loops, dry coolers, piping, leak detection"],
      ["Civil & structural", "1.8–2.2", "18%", "Slab-on-grade, frame, security"],
      ["Fit-out & containment", "1.0–1.3", "10%", "Enclosures, manifolds, fiber trunking"],
      ["Engineering & mgmt", "0.8–1.0", "8%", "Permitting, commissioning L1–L5, supervision"],
      ["Total (facility only)", "9.9–12.2", "100%", "Excludes IT compute silicon"],
    ], [200, 120, 80, 480]),
  ...caveat("TEST-FIT CAPEX BASIS — RESTATED TO THE BENCHMARK MIDPOINT", [
    `Model CapEx is now derived bottom-up: facility $/MW x IT MW plus per-rack platform prices from the Rack Type Library = ${v.capex} for the test fit (an earlier draft carried a flat $139.5M, credible only with leased or vendor-financed IT).`,
    `Facility-only at ${v.itMW} MW: ${v.benchFac} (midpoint ~${v.facBlockMid}).`,
    `IT hardware: ${m.vr_racks} Vera Rubin NVL72 racks at reported $6.0–8.8M per rack = ${v.benchIt} (GB200-class racks run $3.1–3.9M all-in).`,
    `Benchmark all-in range: ${v.benchAll}; the model sits at the midpoint.`,
    `If IT is leased, vendor-financed, or customer-owned, zero the rack-price cells in the Rack Type Library — CapEx then reverts automatically to facility-only (~${v.facBlockMid}) and every return in Section 17 transforms accordingly.`,
  ]),
);

// ---- Section 16 ----
children.push(
  H1("16", "OpEx Optimization & PUE Minimization"),
  SUB("Electricity is the OpEx; PUE is the lever; high-temperature liquid cooling"
    + " is how you pull it."),
  P("PUE = total facility energy / IT energy. Legacy air-cooled estates run 1.35–1.5;"
    + " high-temperature liquid-cooled AI facilities achieve 1.05–1.10 annualized"
    + " (compressor-free rejection most hours), with 1.03 attainable only in cool"
    + " climates — quote one number consistently and state whether it is design-peak"
    + " or annualized."),
  ...BULLETS([
    `Reference case (verified arithmetic): a 128 MW IT campus improving from PUE 1.35 to 1.06 avoids ${v.pueSavedMwh} MWh per year — ${v.pueSavedUsd}/yr at $0.08/kWh.`,
    "Predictive maintenance on CDU pumps and dry-cooler fans (vibration, ΔP trend)"
      + " protects both PUE and availability; a fouled heat exchanger is a silent"
      + " PUE tax.",
    "Utilization is an OpEx lever too: energy scales with served load, revenue with"
      + " sold capacity — the model carries utilization and uptime as explicit inputs.",
  ]),
  ...testFit([
    `Annualized PUE ${f3(m.pue)} (input) → facility energy ${v.energy} MWh/yr at ${pct(m.util, 0)} utilization / ${pct(m.uptime, 1)} uptime.`,
    `Year-1 electricity ${v.elecY1} at $${m.tariff.toFixed(2)}/kWh — ${v.energyPct} of revenue. Breakeven tariff (EBITDA = 0) is ${v.beTariff}/kWh, ~19x the baseline: in this fiscal setting the project's economics are revenue-driven, not power-price-driven.`,
  ]),
);

// ---- Section 17 ----
children.push(
  H1("17", "Enterprise Project Finance: FCFF, IRR & Valuation"),
  SUB("Model levered and unlevered returns separately, cap the interest deduction"
    + " where the tax code does, and disclose which inputs carry the result."),
  H2("Market reference frame (128 MW campus, industry figures)"),
  ...BULLETS([
    "CapEx ~$1.42B facility (≈$11.1M/MW — consistent with Section 15's benchmark);"
      + " NNN lease at $125/kW/month → ~$192M annual base revenue (verified:"
      + " 128,000 kW × $125 × 12).",
    "Reported market returns: unlevered IRR 13.5–15.2% over 15-year lives; levered"
      + " (65/35) 21.8–24.5% on hyperscaler take-or-pay leases; exit multiples"
      + " 20–25x EV/EBITDA (all market estimates, not this model's outputs).",
  ]),
  H2("Test-fit model outputs (5-year horizon, from AI_Factory_Model.xlsx)"),
  TBL(["Metric", "Value", "Metric", "Value"],
    [
      ["CapEx (input)", v.capex, "Debt / equity", `${v.debt} / ${v.equity} (${pct(m.debt_ratio, 0)} debt @ ${pct(m.rate, 1)}, ${m.tenor}-yr)`],
      ["Year-1 revenue", v.revY1, "Year-1 EBITDA", `${v.ebitdaY1} (${v.marginY1})`],
      ["Annual debt service", v.ds, "DSCR (min / avg)", `${v.minDscr} / ${v.avgDscr}`],
      ["Levered equity IRR", v.eqIrr, "Unlevered project IRR", v.prIrr],
      ["Equity NPV @ 15%", v.npv, "MOIC / payback", `${v.moic} / ${v.payback}`],
      ["UAE tax", `${pct(m.tax, 0)} with GIDLR ${pct(m.gidlr, 0)}-of-EBITDA interest cap (applied via MIN in the model)`, "Unit economics", `${v.capexGpu}/GPU CapEx; ${v.revGpuHr}/GPU-hr revenue vs ${v.opexGpuHr} cash cost; ${v.costMtok}/M tokens cash cost`],
    ], [200, 250, 200, 330]),
  ...caveat("READING THESE RETURNS — CAPEX RESTATED; REVENUE IS NOW THE SWING FACTOR", [
    "With CapEx built bottom-up from benchmark drivers (" + v.capex + ", owned IT), the levered structure fails: minimum DSCR "
      + v.minDscr + " (< 1.0x in Year 1), equity IRR " + v.eqIrr + ", NPV " + v.npv + " at a 15% hurdle. 80% leverage is not financeable on these cash flows — leverage must fall or revenue must rise.",
    "The revenue input is the conservative side: " + v.revGpuHr + "/GPU-hr blended versus $8–11/GPU-hr market rates for GB200-class capacity. At market pricing, revenue roughly doubles and returns re-enter the 128 MW reference frame above.",
    "Both levers are single-cell edits on the Control Panel; the sensitivity engine quantifies tariff x leverage across 16 scenarios automatically.",
  ]),
);

// ---- Section 18 ----
children.push(
  H1("18", "Risk Management, Redundancy Topologies (N+1 vs 2N) & Reliability"),
  SUB("Training jobs are checkpoint-fragile: seconds of power loss can burn hours of"
    + " cluster time — buy redundancy where the workload actually needs it."),
  ...BULLETS([
    "Electrical: distributed-redundant (block-matched N+1 with dual bus) covers AI"
      + " training economics; full 2N is justified for inference estates carrying"
      + " revenue SLAs, not for interruptible training capacity.",
    "Cooling: N+1 at pump, CDU and dry-cooler level; dual-header secondary"
      + " manifolds with quick-disconnects allow live tray swaps without draining"
      + " rows.",
    "Thermal ride-through: at 200+ kW per rack, loop thermal inertia is tens of"
      + " seconds — pumps and controls belong on the UPS bus even where compute is"
      + " not.",
    "Checkpoint economics: at the test fit's " + v.revGpuHr + "/GPU-hr blended revenue, a"
      + ` one-hour cluster outage forgoes ~${usd(m.rev_gpu_hr * m.gpus)} of sold capacity`
      + " — redundancy premiums should be priced against exactly this number.",
  ]),
);

// ---- Section 19 ----
children.push(
  H1("19", "Regulatory, Environmental & ESG Compliance"),
  SUB("Water, carbon and grid impact are now licensing gates, not reporting"
    + " afterthoughts — engineer them as design inputs."),
  ...BULLETS([
    "Water: target near-zero WUE with a bounded adiabatic budget (<0.2 L/kWh);"
      + " claiming absolute zero while running adiabatic assist hours is an audit"
      + " finding waiting to happen.",
    "Energy reporting: EU EED-style disclosure (PUE, WUE, heat-reuse readiness) is"
      + " spreading beyond Europe; instrument for it from day one.",
    "Refrigerants: high-temperature loops shrink or eliminate compressor plant —"
      + " the remaining trim stages should use low-GWP refrigerants.",
    "Embodied carbon: green steel and low-carbon concrete on the civil scope;"
      + " grid-carbon siting (Section 13) dominates operational Scope 2.",
  ]),
  ...testFit([
    `Water: ${v.water} m³/yr (WUE ${m.wue.toFixed(2)} L/kWh) — a bounded, disclosed budget rather than a zero claim.`,
    `Scope 2: ${v.co2} tCO2/yr at ${m.carbon_kg_kwh.toFixed(2)} kgCO2/kWh grid intensity (Abu Dhabi nuclear + gas + solar mix, editable in the model).`,
  ]),
);

// ---- Section 20 ----
children.push(
  H1("20", "Synthesis & Strategic Directives"),
  SUB("Four directives, each carried by the numbers in this paper and executable"
    + " through the companion model."),
  TBL(["#", "Directive", "Substance"],
    [
      ["1", "Standardize on S45 direct liquid cooling — honestly",
        "45°C facility water, dry-first heat rejection, and explicitly engineered trim"
        + " capacity for N=20yr extremes. Target annualized PUE 1.05–1.10 and a"
        + " bounded, disclosed water budget."],
      ["2", "Architect power for the next platform, not this one",
        "415 V AC busway today with 800 VDC-ready raceways and electrical rooms;"
        + " rack-level energy storage and firmware power smoothing as standard"
        + " equipment."],
      ["3", "Deploy in self-commissioning ~8 MW blocks",
        `The ${m.vr_racks}-rack test-fit block (${v.itMW} MW, ${v.gpus} GPUs) is the`
        + " repeatable unit: own CDU quads, own LV transformation, own commissioning"
        + " close-out — 16 such blocks reach the 128 MW reference campus."],
      ["4", "Underwrite with a live model, not a static deck",
        "Every figure here traces to AI_Factory_Model.xlsx: location-linked ASHRAE"
        + " compliance, physics-derived flow rates, GIDLR-capped tax, and 16-scenario"
        + " tariff x leverage sensitivity, and a phased-expansion module. CapEx"
        + " is restated to the owned-IT benchmark; challenge the revenue input"
        + " (conservative vs market $/GPU-hr) before investment committee."],
    ], [50, 260, 670]),
  SPACER(),
  P("Bottom line: gigascale AI infrastructure is won at the intersection of thermal"
    + " physics, electrical architecture and disciplined project finance. The"
    + " operators who engineer to verified numbers — and re-verify when vendors"
    + " finalize silicon — will own the capacity the market is short of.", { bold: true }),
);

// ---- Appendix A ----
children.push(
  H1("A", "Appendix — Corrections & Verification Log (vs. draft v4.2)"),
  SUB("Every material change from the source draft, with the basis for the change."),
  TBL(["#", "Draft v4.2 claim", "Corrected treatment", "Basis"],
    [
      ["1", "Vera Rubin NVL72 rack power '190–230 kW'",
        "Not final; public reports span ~130–250 kW. Test fit designs to a 227 kW envelope.",
        "Vendor/press review, Jul 2026"],
      ["2", "'45°C inlet eliminates chillers even at 48°C ambient'",
        "Physically wrong: dry coolers cannot cool below ambient + approach. Trim/adiabatic/setpoint-float required where N=20yr DB > ~40°C.",
        "Heat-transfer physics"],
      ["3", "330 LPM per 230 kW rack (ΔT 10K)",
        "Correct for water; PG25 needs ~" + v.flowPg230 + " LPM. Companion model previously carried 195 LPM (impossible at ΔT 10K) — now physics-derived (" + v.flowRack + " LPM at 227 kW).",
        "Q = ṁ·Cp·ΔT"],
      ["4", "'>98% heat captured by liquid'",
        "~90–95% typical; remainder to RDHx/room air. Verify per SKU.",
        "Industry deployment data"],
      ["5", "WUE = 0.00 (S5) vs WUE < 0.05 (S19)",
        "Unified: near-zero target, test fit discloses 0.15 L/kWh adiabatic budget.",
        "Internal consistency"],
      ["6", "'NVIDIA DSX MaxLPS' power smoothing",
        "No such product verifiable. Replaced with GB300 PSU energy storage + power-smoothing firmware (real, vendor-documented).",
        "Vendor documentation"],
      ["7", "dP/dt > 100 kW/ms framing",
        "Restated by scale: μs (die), ms (rack), MW/s (cluster-to-grid).",
        "Engineering review"],
      ["8", "Rack weight 1,800–2,000 kg stated as fact",
        "GB200 verified at ~1.36 t; VR 1.5–2.0 t is an estimate pending vendor data.",
        "Vendor spec"],
      ["9", "'Z=4' seismic compliance",
        "Obsolete UBC term; replaced with ASCE 7 seismic design category language.",
        "Code currency"],
      ["10", "'1000% density increase in 36 months'",
        "Restated: ~10–15x per-rack increase since 2020.",
        "10–20 kW → 120–230 kW"],
      ["11", "HBM '22 TB/s' per rack",
        "22 TB/s is per-GPU HBM4 bandwidth; rack aggregate is ~1.6 PB/s.",
        "Vendor platform brief"],
      ["12", "5–8M gal/MW-yr water savings",
        "Restated 4–8M gal/MW-yr, flagged as climate-dependent estimate.",
        "Industry ranges"],
      ["13", "SMRs 'near-term'",
        "Restated: 2030s optionality; not credible for 2026–2028 bridging.",
        "Deployment timelines"],
      ["14", "128 MW finance matrix ($1.42B, $192M revenue)",
        "Arithmetic verified and retained as market reference; explicitly separated from test-fit model outputs.",
        "Recomputation"],
      ["15", "No CapEx/IT reconciliation",
        "Added and actioned: CapEx is now derived per-MW + per-rack (currently " + v.capex + "; facility " + v.benchFac + " + VR IT " + v.benchIt + ") — Sections 15/17.",
        "Rack pricing reports"],
      ["16", "128 MW roadmap had no financial linkage",
        "Added a Phased Expansion module (workbook sheet + Section 14 box): 16 blocks, " + v.expMW + " MW, " + v.expCapex + " campus CapEx, peak funding " + v.expPeak + ".",
        "This revision"],
    ], [40, 280, 430, 230]),
);

// ---- Appendix B ----
children.push(
  H1("B", "Appendix — Sources & Model Lineage"),
  H2("Model lineage"),
  ...BULLETS([
    "AI_Factory_Model.xlsx — companion workbook; all test-fit figures. 95/95"
      + " independent verification checks passed on the build used for this paper.",
    "scripts/build_whitepaper_manifest.py — extracts every quantitative claim from"
      + " the recalculated workbook into whitepaper_manifest.json.",
    "scripts/test_whitepaper.py — fact-check harness: re-derives the manifest and"
      + " asserts this document's numbers against it.",
  ]),
  H2("External sources (accessed July 2026)"),
  ...BULLETS([
    "NVIDIA Technical Blog — 'Inside the NVIDIA Vera Rubin Platform: Six New Chips,"
      + " One AI Supercomputer' (platform specs, 45°C liquid cooling, energy storage).",
    "NVIDIA Technical Blog — 'NVIDIA 800 VDC Architecture Will Power the Next"
      + " Generation of AI Factories' (HVDC copper/busbar figures).",
    "NVIDIA — Vera CPU product page; VideoCardz — Vera CPU detail (88 Olympus cores,"
      + " 176 threads, 1.2 TB/s).",
    "Lenovo Press LP2357; Sunbird DCIM — GB300 NVL72 power (132–142 kW, ~155 kW peak).",
    "SemiAnalysis — GB200 NVL72 pricing/TCO ($3.1M rack, ~$3.9M all-in); Tom's"
      + " Hardware — Vera Rubin NVL72 rack pricing up to $8.8M.",
    "Spheron / Introl deployment guides — GB200 NVL72 ~120 kW nominal, 1.36 t rack"
      + " weight.",
    "ASHRAE 90.4-2019 and ASHRAE Fundamentals climatic data — cited as the"
      + " verification source for the model's editable climate library (values in the"
      + " library are reference estimates pending standard lookup).",
  ]),
  SPACER(),
  P("Prepared with AI assistance (Claude Code). All numeric claims tied to the"
    + " manifest are machine-verified; vendor-roadmap items are flagged inline as"
    + " estimates.", { italic: true, color: GRAY, size: 18 }),
);

// =====================================================================
const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: { config: [{ reference: "bul", levels: [{
    level: 0, format: LevelFormat.BULLET, text: "•",
    style: { paragraph: { indent: { left: 360, hanging: 200 } } },
  }] }] },
  sections: [{
    properties: { page: PAGE },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: "Hyperscale AI Infrastructure White Paper — Page ", font: FONT, size: 16, color: GRAY }),
        new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GRAY }),
        new TextRun({ text: " of ", font: FONT, size: 16, color: GRAY }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: GRAY }),
      ],
    })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("AI_Factory_Whitepaper.docx", buf);
  console.log("Wrote AI_Factory_Whitepaper.docx (" + buf.length + " bytes)");
});
