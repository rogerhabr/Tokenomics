"""AI Factory financial & engineering model generator (v2, fully formula-driven).

Generates AI_Factory_32x_Rubin_AbuDhabi.xlsx with 7 sheets:
  1. Dashboard              - headline KPIs, all formula-linked
  2. Control Panel & Inputs - every assumption in one labeled cell (blue = input)
  3. Thermal Hydraulics & MLC - ASHRAE 90.4 engine + energy/water/carbon
  4. Unit Economics & KPIs  - GPU-hour and token-level unit economics
  5. 5Yr Pro Forma Financials - leveraged model with GIDLR cap, IRR/NPV/MOIC/payback
  6. Sensitivity Engine     - 16 live scenarios (tariff x debt ratio), each with its
                              own debt schedule, GIDLR-capped tax and IRR formula
  7. Sensitivity Matrices   - IRR & DSCR grids linked to the engine (no hardcodes)

Every output cell traces back to 'Control Panel & Inputs' by formula, so changing
any input recalculates the whole workbook including both sensitivity matrices.
"""

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

FILE_NAME = "AI_Factory_32x_Rubin_AbuDhabi.xlsx"
FONT_FAMILY = "Calibri"

# Fonts (financial-model color convention: blue = hardcoded input,
# black = same-sheet formula, green = link to another sheet)
TITLE_FONT = Font(name=FONT_FAMILY, size=16, bold=True, color="1F4E78")
SUBTITLE_FONT = Font(name=FONT_FAMILY, size=11, italic=True, color="595959")
HEADER_FONT = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
SECTION_FONT = Font(name=FONT_FAMILY, size=12, bold=True, color="1F4E78")
BOLD_FONT = Font(name=FONT_FAMILY, size=11, bold=True)
REGULAR_FONT = Font(name=FONT_FAMILY, size=11)
INPUT_FONT = Font(name=FONT_FAMILY, size=11, color="0000FF")
FORMULA_FONT = Font(name=FONT_FAMILY, size=11)
LINK_FONT = Font(name=FONT_FAMILY, size=11, color="008000")
LINK_BOLD_FONT = Font(name=FONT_FAMILY, size=11, bold=True, color="008000")

NAVY_FILL = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
SECTION_FILL = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
HIGHLIGHT_FILL = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
INPUT_FILL = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

THIN = Side(border_style="thin", color="D9D9D9")
DOUBLE = Side(border_style="double", color="1F4E78")
BORDER_DATA = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
BORDER_TOTAL = Border(left=THIN, right=THIN, top=THIN, bottom=DOUBLE)

FMT_MONEY = "$#,##0"
FMT_MONEY_CT = "$#,##0.0000"
FMT_MONEY_2DP = "$#,##0.00"
FMT_PCT = "0.0%"
FMT_PCT_2DP = "0.00%"
FMT_X = '0.00"x"'
FMT_NUM = "#,##0"
FMT_NUM_1DP = "#,##0.0"
FMT_3DP = "0.000"
FMT_YEARS = '0.00" yrs"'

INPUTS_SHEET = "Control Panel & Inputs"
THERMAL_SHEET = "Thermal Hydraulics & MLC"
PROFORMA_SHEET = "5Yr Pro Forma Financials"
ENGINE_SHEET = "Sensitivity Engine"

TARIFFS = [0.04, 0.06, 0.08, 0.10]
DEBT_RATIOS = [0.50, 0.60, 0.70, 0.80]

# Row maps built as sheets are written; formulas are generated from these maps
# so cross-sheet references can never drift out of sync with the layout.
P = {}  # parameter name -> row on inputs sheet (value in col C)
T = {}  # thermal metric -> row on thermal sheet (value in col B)
F = {}  # pro forma line item -> row (Year 0..5 in cols B..G)
E = {}  # engine: scenario index -> row; also 'ebitda_grid_start'


def pref(name):
    return f"'{INPUTS_SHEET}'!$C${P[name]}"


def tref(name):
    return f"'{THERMAL_SHEET}'!$B${T[name]}"


def fref(item, col):
    return f"'{PROFORMA_SHEET}'!{col}${F[item]}"


def style_header_row(ws, row, headers):
    for col_num, h in enumerate(headers, 1):
        cell = ws.cell(row=row, column=col_num, value=h)
        cell.font = HEADER_FONT
        cell.fill = NAVY_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center")


def title_block(ws, title, subtitle):
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws["A2"] = subtitle
    ws["A2"].font = SUBTITLE_FONT


# ---------------------------------------------------------------------------
# Sheet: Control Panel & Inputs
# ---------------------------------------------------------------------------
def build_inputs(wb):
    ws = wb.active
    ws.title = INPUTS_SHEET
    title_block(
        ws,
        "NVIDIA Vera Rubin NVL72 AI Factory — Abu Dhabi",
        "Master Control Panel — edit only the yellow Value cells; every other"
        " sheet recalculates from them",
    )
    style_header_row(ws, 4, ["Category", "Parameter", "Value", "Unit", "Notes / Constraints"])

    rows = [
        # (category, param, value, unit, fmt, notes)
        ("Geographic & Climate", "Geo_Location", "Abu Dhabi, UAE", "", None,
         "ASHRAE Climate Zone 1A"),
        ("Geographic & Climate", "Peak_Ambient_DryBulb", 50.0, "°C", FMT_NUM_1DP,
         "Extreme peak dry-bulb temperature"),
        ("Geographic & Climate", "Coincident_WetBulb", 30.0, "°C", FMT_NUM_1DP,
         "Peak summer wet-bulb condition"),
        ("Geographic & Climate", "Grid_Carbon_Intensity", 0.39, "kgCO2/kWh", FMT_3DP,
         "Assumption: Abu Dhabi grid avg (Barakah nuclear + gas + solar mix)"),
        ("Geographic & Climate", "Water_Usage_Effectiveness", 0.15, "L/kWh", FMT_3DP,
         "Assumption: closed-loop dry coolers, minimal adiabatic assist"),
        ("Technical Specs", "Rack_Count", 32, "racks", FMT_NUM,
         "Vera Rubin NVL72 racks"),
        ("Technical Specs", "GPUs_Per_Rack", 72, "GPUs", FMT_NUM,
         "NVL72 = 72 Rubin GPUs per rack"),
        ("Technical Specs", "Peak_Power_Per_Rack", 227.0, "kW", FMT_NUM_1DP,
         "Compute & scale-up busbar load"),
        ("Technical Specs", "Air_Cooled_Load", 1000.0, "kW", FMT_NUM_1DP,
         "1.0 MW network & NVMe storage"),
        ("Technical Specs", "Liquid_Supply_Temp_FWS", 45.0, "°C", FMT_NUM_1DP,
         "S45 direct-to-chip loop"),
        ("Technical Specs", "Target_Annualized_PUE", 1.08, "", FMT_3DP,
         "Drives facility energy = IT energy x PUE"),
        ("Technical Specs", "Cluster_Utilization", 0.85, "%", FMT_PCT,
         "Assumption: avg power/capacity utilization of the fleet"),
        ("Technical Specs", "Uptime_Availability", 0.995, "%", FMT_PCT_2DP,
         "Assumption: contractual availability SLA"),
        ("Technical Specs", "Tokens_Per_GPU_Sec", 1800, "tok/s/GPU", FMT_NUM,
         "Assumption: blended inference throughput per Rubin GPU"),
        ("Technical Specs", "Token_Fleet_Share", 0.30, "%", FMT_PCT,
         "Share of fleet serving the API token market"),
        ("Financial & Fiscal", "Electricity_Tariff", 0.06, "$/kWh", "$#,##0.000",
         "Abu Dhabi industrial rate (Year 1)"),
        ("Financial & Fiscal", "Tariff_Escalation", 0.02, "%/yr", FMT_PCT,
         "Assumption: annual power price escalation"),
        ("Financial & Fiscal", "CapEx_Initial", 139500000, "USD", FMT_MONEY,
         "Total turnkey deployment"),
        ("Financial & Fiscal", "Residual_Value_Pct", 0.10, "%", FMT_PCT,
         "Assumption: pre-tax residual recovery of CapEx at end of Year 5"),
        ("Financial & Fiscal", "Debt_Ratio", 0.80, "%", FMT_PCT,
         "User adjustable (50% - 80%)"),
        ("Financial & Fiscal", "Interest_Rate", 0.065, "%", FMT_PCT,
         "Senior debt facility rate"),
        ("Financial & Fiscal", "Debt_Tenor", 5, "Years", FMT_NUM,
         "Annual amortization schedule"),
        ("Financial & Fiscal", "UAE_Corporate_Tax", 0.09, "%", FMT_PCT,
         "Statutory corporate tax rate"),
        ("Financial & Fiscal", "GIDLR_EBITDA_Cap", 0.30, "%", FMT_PCT,
         "UAE interest deduction limit — applied via MIN() in the tax calc"),
        ("Financial & Fiscal", "Equity_Discount_Rate", 0.15, "%", FMT_PCT,
         "Assumption: hurdle rate for equity NPV"),
        ("Financial & Fiscal", "Fixed_OpEx_Annual", 10877000, "USD/yr", FMT_MONEY,
         "Staff, maintenance, insurance, connectivity (Year 1)"),
        ("Financial & Fiscal", "OpEx_Escalation", 0.03, "%/yr", FMT_PCT,
         "Assumption: annual fixed-OpEx inflation"),
        ("Revenue Strategy", "Lease_Revenue_70pct", 58800000, "USD/yr", FMT_MONEY,
         "70% bare-metal capacity leases (Year 1, pre-ramp)"),
        ("Revenue Strategy", "Token_Revenue_30pct", 25200000, "USD/yr", FMT_MONEY,
         "30% dynamic API token market (Year 1, pre-ramp)"),
        ("Revenue Strategy", "Year1_Ramp_Factor", 0.90, "%", FMT_PCT,
         "Assumption: Year 1 commissioning / fill-up ramp"),
        ("Revenue Strategy", "Lease_Price_Escalation", 0.00, "%/yr", FMT_PCT,
         "Assumption: lease repricing per year"),
        ("Revenue Strategy", "Token_Price_Decline", 0.15, "%/yr", FMT_PCT,
         "Core tokenomics: $/token deflation per year"),
        ("Revenue Strategy", "Token_Volume_Growth", 0.25, "%/yr", FMT_PCT,
         "Token demand growth (partially offsets price decline)"),
    ]

    for i, (cat, name, val, unit, fmt, notes) in enumerate(rows):
        r = 5 + i
        P[name] = r
        for col, v in ((1, cat), (2, name), (3, val), (4, unit), (5, notes)):
            cell = ws.cell(row=r, column=col, value=v)
            cell.font = REGULAR_FONT
            cell.border = BORDER_DATA
        vcell = ws.cell(row=r, column=3)
        vcell.font = INPUT_FONT
        vcell.fill = INPUT_FILL
        if fmt:
            vcell.number_format = fmt

    legend_row = 5 + len(rows) + 1
    ws.cell(row=legend_row, column=1,
            value="Legend: yellow cells with blue text are the editable inputs;"
                  " all other cells in this workbook are formulas.").font = SUBTITLE_FONT
    ws.cell(row=legend_row + 1, column=1,
            value="Rows marked 'Assumption' are user-supplied estimates, not"
                  " sourced market data — revisit before investment use.").font = SUBTITLE_FONT
    return ws


# ---------------------------------------------------------------------------
# Sheet: Thermal Hydraulics & MLC
# ---------------------------------------------------------------------------
def build_thermal(wb):
    ws = wb.create_sheet(title=THERMAL_SHEET)
    title_block(
        ws,
        "Thermal Hydraulics & ASHRAE 90.4 Compliance Engine",
        "S45 closed-loop fluid dynamics, 3-stage trim cooling, and annual"
        " energy / water / carbon footprint",
    )
    style_header_row(ws, 4, ["Metric / Calculation Step", "Value", "Unit", "Notes"])

    def rows():
        # (metric, formula_or_value, unit, fmt, notes)
        yield ("Compute IT Load",
               f"={pref('Rack_Count')}*{pref('Peak_Power_Per_Rack')}",
               "kW", FMT_NUM_1DP, "Racks x kW/rack")
        yield ("Network & Storage Air Load",
               f"={pref('Air_Cooled_Load')}",
               "kW", FMT_NUM_1DP, "Continuous air-cooled load")
        yield ("Total Combined IT Load", None, "kW", FMT_NUM_1DP,
               "Compute + network/storage")
        yield ("S45 Loop Supply Temperature",
               f"={pref('Liquid_Supply_Temp_FWS')}",
               "°C", FMT_NUM_1DP, "Facility Water Supply (FWS)")
        yield ("S45 Loop Return Temperature", 55.0, "°C", FMT_NUM_1DP,
               "Facility Water Return (FWR) — assumption")
        yield ("S45 Loop Delta T", None, "°C", FMT_NUM_1DP,
               "Hydraulic temperature split")
        yield ("S45 Liquid Flow Rate per Rack", 195.0, "LPM", FMT_NUM_1DP,
               "PG25 water/glycol mixture — vendor spec")
        yield ("Total S45 Cluster Flow Rate", None, "LPM", FMT_NUM_1DP,
               "Primary CDU manifold demand")
        yield ("Peak Ambient Dry-Bulb",
               f"={pref('Peak_Ambient_DryBulb')}",
               "°C", FMT_NUM_1DP, "Abu Dhabi extreme condition")
        yield ("S45 Peak Rejection Approach", None, "K", FMT_NUM_1DP,
               "FWR minus peak dry-bulb (positive = dry cooling viable)")
        yield ("S45 Dry Cooler / CDU Cooling Power", None, "kW", FMT_NUM_1DP,
               "5% of liquid-cooled load — CDU pumps & EC fans (assumption)")
        yield ("Air Loop Chiller Cooling Power", None, "kW", FMT_NUM_1DP,
               "28% of air-cooled load — high-ambient screw chillers (assumption)")
        yield ("Total Cooling Peak Power", None, "kW", FMT_NUM_1DP,
               "Combined cooling power")
        yield ("Peak Mechanical Load Component (MLC)", None, "", FMT_3DP,
               "Cooling power / total IT load")
        yield ("ASHRAE 90.4 Zone 1A Limit", 0.260, "", FMT_3DP,
               "Maximum allowable peak MLC threshold")
        yield ("Safety Compliance Margin", None, "%", FMT_PCT,
               "Operational margin under the Zone 1A limit")
        yield ("Average Utilized IT Power", None, "kW", FMT_NUM_1DP,
               "Total IT x utilization x uptime")
        yield ("Annualized PUE",
               f"={pref('Target_Annualized_PUE')}",
               "", FMT_3DP, "Facility energy multiplier on IT energy")
        yield ("Annual Facility Energy", None, "MWh/yr", FMT_NUM,
               "Avg IT power x 8760h x PUE")
        yield ("Annual Water Consumption", None, "m³/yr", FMT_NUM,
               "Facility kWh x WUE")
        yield ("Annual Carbon Emissions", None, "tCO2/yr", FMT_NUM,
               "Facility kWh x grid intensity")

    items = list(rows())
    for i, (metric, _f, unit, fmt, notes) in enumerate(items):
        T[metric] = 5 + i

    # Formulas that need T populated first
    formulas = {
        "Total Combined IT Load":
            f"=B{T['Compute IT Load']}+B{T['Network & Storage Air Load']}",
        "S45 Loop Delta T":
            f"=B{T['S45 Loop Return Temperature']}-B{T['S45 Loop Supply Temperature']}",
        "Total S45 Cluster Flow Rate":
            f"=B{T['S45 Liquid Flow Rate per Rack']}*{pref('Rack_Count')}",
        "S45 Peak Rejection Approach":
            f"=B{T['S45 Loop Return Temperature']}-B{T['Peak Ambient Dry-Bulb']}",
        "S45 Dry Cooler / CDU Cooling Power":
            f"=B{T['Compute IT Load']}*0.05",
        "Air Loop Chiller Cooling Power":
            f"=B{T['Network & Storage Air Load']}*0.28",
        "Total Cooling Peak Power":
            f"=B{T['S45 Dry Cooler / CDU Cooling Power']}"
            f"+B{T['Air Loop Chiller Cooling Power']}",
        "Peak Mechanical Load Component (MLC)":
            f"=B{T['Total Cooling Peak Power']}/B{T['Total Combined IT Load']}",
        "Safety Compliance Margin":
            f"=(B{T['ASHRAE 90.4 Zone 1A Limit']}"
            f"-B{T['Peak Mechanical Load Component (MLC)']})"
            f"/B{T['ASHRAE 90.4 Zone 1A Limit']}",
        "Average Utilized IT Power":
            f"=B{T['Total Combined IT Load']}*{pref('Cluster_Utilization')}"
            f"*{pref('Uptime_Availability')}",
        "Annual Facility Energy":
            f"=B{T['Average Utilized IT Power']}*8760"
            f"*B{T['Annualized PUE']}/1000",
        "Annual Water Consumption":
            f"=B{T['Annual Facility Energy']}"
            f"*{pref('Water_Usage_Effectiveness')}",
        "Annual Carbon Emissions":
            f"=B{T['Annual Facility Energy']}"
            f"*{pref('Grid_Carbon_Intensity')}",
    }

    for metric, f, unit, fmt, notes in items:
        r = T[metric]
        val = formulas.get(metric, f)
        ws.cell(row=r, column=1, value=metric).font = REGULAR_FONT
        vcell = ws.cell(row=r, column=2, value=val)
        vcell.font = BOLD_FONT if isinstance(val, str) else INPUT_FONT
        if isinstance(val, (int, float)):
            vcell.fill = INPUT_FILL
        vcell.number_format = fmt
        ws.cell(row=r, column=3, value=unit).font = REGULAR_FONT
        ws.cell(row=r, column=4, value=notes).font = REGULAR_FONT
        for c in range(1, 5):
            ws.cell(row=r, column=c).border = BORDER_DATA
    return ws


# ---------------------------------------------------------------------------
# Sheet: 5Yr Pro Forma Financials
# ---------------------------------------------------------------------------
YEAR_COLS = ["B", "C", "D", "E", "F", "G"]  # Year 0..5


def build_proforma(wb):
    ws = wb.create_sheet(title=PROFORMA_SHEET)
    title_block(
        ws,
        "5-Year Leveraged Financial Model & Debt Amortization",
        "UAE corporate tax (9%) with GIDLR 30%-of-EBITDA interest cap, revenue"
        " ramp & escalations, full debt schedule and equity returns",
    )
    style_header_row(
        ws, 4,
        ["Line Item (USD)", "Year 0", "Year 1", "Year 2", "Year 3", "Year 4", "Year 5"],
    )

    line_items = [
        "Revenue Ramp Factor",
        "Lease Revenue",
        "Token Revenue",
        "Gross Annual Revenue",
        "Effective Power Tariff",
        "Annual Facility Energy (kWh)",
        "Electricity Cost",
        "Fixed Non-Power OpEx",
        "Total Operational Expense (OpEx)",
        "EBITDA",
        "EBITDA Margin",
        "CapEx Initial Outlay",
        "Debt Financed Amount",
        "Equity Outlay",
        "Beginning Debt Balance",
        "Annual Debt Service (P+I)",
        "Interest Expense",
        "Debt Principal Payment",
        "Ending Debt Balance",
        "Depreciation (5-Yr Straight Line)",
        "GIDLR Deductible Interest",
        "Taxable Income",
        "UAE Corporate Tax",
        "Residual Value Recovery",
        "Leveraged Free Cash Flow (FCFE)",
        "Cumulative FCFE",
        "Debt Service Coverage Ratio (DSCR)",
        "Unlevered Tax (no interest shield)",
        "Unlevered Free Cash Flow (FCFF)",
    ]
    for i, item in enumerate(line_items):
        F[item] = 5 + i

    def cells(item, y0, per_year):
        """y0: Year-0 cell; per_year(t, col): formula for Year t (1-5)."""
        r = F[item]
        vals = [y0] + [per_year(t, YEAR_COLS[t]) for t in range(1, 6)]
        return r, vals

    R = F  # shorthand
    rows = []

    rows.append(cells(
        "Revenue Ramp Factor", 0,
        lambda t, c: f"={pref('Year1_Ramp_Factor')}" if t == 1 else 1,
    ))
    rows.append(cells(
        "Lease Revenue", 0,
        lambda t, c: f"={pref('Lease_Revenue_70pct')}"
                     f"*POWER(1+{pref('Lease_Price_Escalation')},{t - 1})"
                     f"*{c}{R['Revenue Ramp Factor']}",
    ))
    rows.append(cells(
        "Token Revenue", 0,
        lambda t, c: f"={pref('Token_Revenue_30pct')}"
                     f"*POWER((1+{pref('Token_Volume_Growth')})"
                     f"*(1-{pref('Token_Price_Decline')}),{t - 1})"
                     f"*{c}{R['Revenue Ramp Factor']}",
    ))
    rows.append(cells(
        "Gross Annual Revenue", 0,
        lambda t, c: f"={c}{R['Lease Revenue']}+{c}{R['Token Revenue']}",
    ))
    rows.append(cells(
        "Effective Power Tariff", 0,
        lambda t, c: f"={pref('Electricity_Tariff')}"
                     f"*POWER(1+{pref('Tariff_Escalation')},{t - 1})",
    ))
    rows.append(cells(
        "Annual Facility Energy (kWh)", 0,
        lambda t, c: f"={tref('Annual Facility Energy')}*1000",
    ))
    rows.append(cells(
        "Electricity Cost", 0,
        lambda t, c: f"={c}{R['Annual Facility Energy (kWh)']}"
                     f"*{c}{R['Effective Power Tariff']}",
    ))
    rows.append(cells(
        "Fixed Non-Power OpEx", 0,
        lambda t, c: f"={pref('Fixed_OpEx_Annual')}"
                     f"*POWER(1+{pref('OpEx_Escalation')},{t - 1})",
    ))
    rows.append(cells(
        "Total Operational Expense (OpEx)", 0,
        lambda t, c: f"={c}{R['Electricity Cost']}+{c}{R['Fixed Non-Power OpEx']}",
    ))
    rows.append(cells(
        "EBITDA", 0,
        lambda t, c: f"={c}{R['Gross Annual Revenue']}"
                     f"-{c}{R['Total Operational Expense (OpEx)']}",
    ))
    rows.append(cells(
        "EBITDA Margin", 0,
        lambda t, c: f"={c}{R['EBITDA']}/{c}{R['Gross Annual Revenue']}",
    ))
    rows.append((F["CapEx Initial Outlay"],
                 [f"={pref('CapEx_Initial')}", 0, 0, 0, 0, 0]))
    rows.append((F["Debt Financed Amount"],
                 [f"=B{R['CapEx Initial Outlay']}*{pref('Debt_Ratio')}",
                  0, 0, 0, 0, 0]))
    rows.append((F["Equity Outlay"],
                 [f"=B{R['CapEx Initial Outlay']}-B{R['Debt Financed Amount']}",
                  0, 0, 0, 0, 0]))
    rows.append(cells(
        "Beginning Debt Balance", 0,
        lambda t, c: (f"=B{R['Debt Financed Amount']}" if t == 1
                      else f"={YEAR_COLS[t - 1]}{R['Ending Debt Balance']}"),
    ))
    rows.append(cells(
        "Annual Debt Service (P+I)", 0,
        lambda t, c: f"=-PMT({pref('Interest_Rate')},{pref('Debt_Tenor')},"
                     f"B{R['Debt Financed Amount']})",
    ))
    rows.append(cells(
        "Interest Expense", 0,
        lambda t, c: f"={c}{R['Beginning Debt Balance']}*{pref('Interest_Rate')}",
    ))
    rows.append(cells(
        "Debt Principal Payment", 0,
        lambda t, c: f"={c}{R['Annual Debt Service (P+I)']}"
                     f"-{c}{R['Interest Expense']}",
    ))
    rows.append(cells(
        "Ending Debt Balance", 0,
        lambda t, c: f"={c}{R['Beginning Debt Balance']}"
                     f"-{c}{R['Debt Principal Payment']}",
    ))
    rows.append(cells(
        "Depreciation (5-Yr Straight Line)", 0,
        lambda t, c: f"=B{R['CapEx Initial Outlay']}/5",
    ))
    rows.append(cells(
        "GIDLR Deductible Interest", 0,
        lambda t, c: f"=MIN({c}{R['Interest Expense']},"
                     f"{pref('GIDLR_EBITDA_Cap')}*{c}{R['EBITDA']})",
    ))
    rows.append(cells(
        "Taxable Income", 0,
        lambda t, c: f"={c}{R['EBITDA']}"
                     f"-{c}{R['Depreciation (5-Yr Straight Line)']}"
                     f"-{c}{R['GIDLR Deductible Interest']}",
    ))
    rows.append(cells(
        "UAE Corporate Tax", 0,
        lambda t, c: f"=MAX(0,{c}{R['Taxable Income']})"
                     f"*{pref('UAE_Corporate_Tax')}",
    ))
    rows.append(cells(
        "Residual Value Recovery", 0,
        lambda t, c: (f"={pref('CapEx_Initial')}*{pref('Residual_Value_Pct')}"
                      if t == 5 else 0),
    ))
    rows.append(cells(
        "Leveraged Free Cash Flow (FCFE)",
        f"=-B{R['Equity Outlay']}",
        lambda t, c: f"={c}{R['EBITDA']}-{c}{R['Annual Debt Service (P+I)']}"
                     f"-{c}{R['UAE Corporate Tax']}"
                     f"+{c}{R['Residual Value Recovery']}",
    ))
    rows.append(cells(
        "Cumulative FCFE",
        f"=B{R['Leveraged Free Cash Flow (FCFE)']}",
        lambda t, c: f"={YEAR_COLS[t - 1]}{R['Cumulative FCFE']}"
                     f"+{c}{R['Leveraged Free Cash Flow (FCFE)']}",
    ))
    rows.append(cells(
        "Debt Service Coverage Ratio (DSCR)", 0,
        lambda t, c: f"={c}{R['EBITDA']}/{c}{R['Annual Debt Service (P+I)']}",
    ))
    rows.append(cells(
        "Unlevered Tax (no interest shield)", 0,
        lambda t, c: f"=MAX(0,{c}{R['EBITDA']}"
                     f"-{c}{R['Depreciation (5-Yr Straight Line)']})"
                     f"*{pref('UAE_Corporate_Tax')}",
    ))
    rows.append(cells(
        "Unlevered Free Cash Flow (FCFF)",
        f"=-B{R['CapEx Initial Outlay']}",
        lambda t, c: f"={c}{R['EBITDA']}"
                     f"-{c}{R['Unlevered Tax (no interest shield)']}"
                     f"+{c}{R['Residual Value Recovery']}",
    ))

    pct_rows = {"Revenue Ramp Factor", "EBITDA Margin"}
    for (r, vals), item in zip(rows, line_items):
        ws.cell(row=r, column=1, value=item).font = BOLD_FONT
        for col_idx, val in enumerate(vals, start=2):
            cell = ws.cell(row=r, column=col_idx, value=val)
            cell.font = REGULAR_FONT
            cell.border = BORDER_DATA
            if item in pct_rows:
                cell.number_format = FMT_PCT
            elif "DSCR" in item:
                cell.number_format = FMT_X
            elif item == "Effective Power Tariff":
                cell.number_format = "$#,##0.0000"
            elif item == "Annual Facility Energy (kWh)":
                cell.number_format = FMT_NUM
            else:
                cell.number_format = FMT_MONEY

    for col in range(1, 8):
        c = ws.cell(row=F["Leveraged Free Cash Flow (FCFE)"], column=col)
        c.fill = HIGHLIGHT_FILL
        c.font = BOLD_FONT
        c.border = BORDER_TOTAL

    # Returns summary block
    fcfe = F["Leveraged Free Cash Flow (FCFE)"]
    fcff = F["Unlevered Free Cash Flow (FCFF)"]
    cum = F["Cumulative FCFE"]
    dscr = F["Debt Service Coverage Ratio (DSCR)"]
    start = F["Unlevered Free Cash Flow (FCFF)"] + 2
    ws.cell(row=start, column=1, value="Equity Returns Summary").font = SECTION_FONT
    kpis = [
        ("Equity IRR (5-Yr, levered)",
         f"=IRR(B{fcfe}:G{fcfe})", FMT_PCT),
        ("Project IRR (5-Yr, unlevered)",
         f"=IRR(B{fcff}:G{fcff})", FMT_PCT),
        ("Equity NPV @ hurdle rate",
         f"=B{fcfe}+NPV({pref('Equity_Discount_Rate')},C{fcfe}:G{fcfe})",
         FMT_MONEY),
        ("MOIC (total distributions / equity)",
         f"=SUM(C{fcfe}:G{fcfe})/-B{fcfe}", FMT_X),
        ("Payback Period",
         f'=IFERROR(COUNTIF(B{cum}:G{cum},"<0")-1'
         f'+ABS(INDEX(B{cum}:G{cum},COUNTIF(B{cum}:G{cum},"<0")))'
         f'/INDEX(B{fcfe}:G{fcfe},COUNTIF(B{cum}:G{cum},"<0")+1),">5 yrs")',
         FMT_YEARS),
        ("Minimum DSCR", f"=MIN(C{dscr}:G{dscr})", FMT_X),
        ("Average DSCR", f"=AVERAGE(C{dscr}:G{dscr})", FMT_X),
    ]
    F["_returns_start"] = start + 1
    for i, (label, formula, fmt) in enumerate(kpis):
        r = start + 1 + i
        F[label] = r
        ws.cell(row=r, column=1, value=label).font = BOLD_FONT
        cell = ws.cell(row=r, column=2, value=formula)
        cell.font = BOLD_FONT
        cell.number_format = fmt
        cell.fill = HIGHLIGHT_FILL
        for c in range(1, 3):
            ws.cell(row=r, column=c).border = BORDER_DATA
    return ws


# ---------------------------------------------------------------------------
# Sheet: Unit Economics & KPIs
# ---------------------------------------------------------------------------
def build_unit_economics(wb):
    ws = wb.create_sheet(title="Unit Economics & KPIs")
    title_block(
        ws,
        "Unit Economics & Operational KPIs",
        "GPU-hour and token-level economics (steady-state Year 2, post-ramp)"
        " — all cells formula-driven",
    )
    style_header_row(ws, 4, ["KPI", "Value", "Unit", "Derivation"])

    U = {}

    def add(name, formula, unit, fmt, notes):
        U[name] = len(U) + 5

    kpis = [
        ("Total GPU Count",
         f"={pref('Rack_Count')}*{pref('GPUs_Per_Rack')}",
         "GPUs", FMT_NUM, "Racks x GPUs per rack"),
        ("Available GPU-hours / yr", None, "GPU-hrs", FMT_NUM,
         "GPUs x 8760h x uptime"),
        ("Sold GPU-hours / yr", None, "GPU-hrs", FMT_NUM,
         "Available x utilization"),
        ("Blended Revenue per Sold GPU-hour", None, "$/GPU-hr", FMT_MONEY_2DP,
         "Year 2 gross revenue / sold GPU-hours"),
        ("Cash OpEx per Sold GPU-hour", None, "$/GPU-hr", FMT_MONEY_2DP,
         "Year 2 total OpEx / sold GPU-hours"),
        ("EBITDA per Sold GPU-hour", None, "$/GPU-hr", FMT_MONEY_2DP,
         "Revenue minus cash OpEx per GPU-hour"),
        ("CapEx per GPU", None, "$/GPU", FMT_MONEY,
         "Total CapEx / GPU count"),
        ("CapEx per MW of IT Load", None, "$/MW", FMT_MONEY,
         "Total CapEx / total IT MW"),
        ("Revenue per MW of IT Load", None, "$/MW/yr", FMT_MONEY,
         "Year 2 revenue / total IT MW"),
        ("Annual Token Capacity (token fleet)", None, "T tokens/yr", FMT_NUM_1DP,
         "Token-fleet GPUs x tok/s x seconds x utilization x uptime"),
        ("Implied Realized Price per M Tokens", None, "$/M tok", FMT_MONEY_2DP,
         "Year 2 token revenue / token capacity"),
        ("Cash Cost per M Tokens", None, "$/M tok", FMT_MONEY_2DP,
         "Token-fleet share of Year 2 OpEx / token capacity"),
        ("Energy Cost as % of Revenue", None, "%", FMT_PCT,
         "Year 2 electricity / Year 2 revenue"),
        ("Breakeven Power Tariff (EBITDA = 0)", None, "$/kWh", "$#,##0.000",
         "(Year 2 revenue - fixed OpEx) / annual kWh"),
        ("Min Revenue for 1.00x DSCR", None, "USD/yr", FMT_MONEY,
         "Debt service + Year 2 OpEx"),
        ("Revenue Headroom above 1.00x DSCR", None, "%", FMT_PCT,
         "1 - min revenue / Year 2 revenue"),
    ]
    for i, (name, *_rest) in enumerate(kpis):
        U[name] = 5 + i

    d = {
        "Available GPU-hours / yr":
            f"=B{U['Total GPU Count']}*8760*{pref('Uptime_Availability')}",
        "Sold GPU-hours / yr":
            f"=B{U['Available GPU-hours / yr']}*{pref('Cluster_Utilization')}",
        "Blended Revenue per Sold GPU-hour":
            f"={fref('Gross Annual Revenue', 'D')}/B{U['Sold GPU-hours / yr']}",
        "Cash OpEx per Sold GPU-hour":
            f"={fref('Total Operational Expense (OpEx)', 'D')}"
            f"/B{U['Sold GPU-hours / yr']}",
        "EBITDA per Sold GPU-hour":
            f"=B{U['Blended Revenue per Sold GPU-hour']}"
            f"-B{U['Cash OpEx per Sold GPU-hour']}",
        "CapEx per GPU":
            f"={pref('CapEx_Initial')}/B{U['Total GPU Count']}",
        "CapEx per MW of IT Load":
            f"={pref('CapEx_Initial')}/({tref('Total Combined IT Load')}/1000)",
        "Revenue per MW of IT Load":
            f"={fref('Gross Annual Revenue', 'D')}"
            f"/({tref('Total Combined IT Load')}/1000)",
        "Annual Token Capacity (token fleet)":
            f"=B{U['Total GPU Count']}*{pref('Token_Fleet_Share')}"
            f"*{pref('Tokens_Per_GPU_Sec')}*3600*8760"
            f"*{pref('Cluster_Utilization')}*{pref('Uptime_Availability')}"
            f"/1000000000000",
        "Implied Realized Price per M Tokens":
            f"={fref('Token Revenue', 'D')}"
            f"/(B{U['Annual Token Capacity (token fleet)']}*1000000)",
        "Cash Cost per M Tokens":
            f"={fref('Total Operational Expense (OpEx)', 'D')}"
            f"*{pref('Token_Fleet_Share')}"
            f"/(B{U['Annual Token Capacity (token fleet)']}*1000000)",
        "Energy Cost as % of Revenue":
            f"={fref('Electricity Cost', 'D')}"
            f"/{fref('Gross Annual Revenue', 'D')}",
        "Breakeven Power Tariff (EBITDA = 0)":
            f"=({fref('Gross Annual Revenue', 'D')}"
            f"-{fref('Fixed Non-Power OpEx', 'D')})"
            f"/{fref('Annual Facility Energy (kWh)', 'D')}",
        "Min Revenue for 1.00x DSCR":
            f"={fref('Annual Debt Service (P+I)', 'D')}"
            f"+{fref('Total Operational Expense (OpEx)', 'D')}",
        "Revenue Headroom above 1.00x DSCR":
            f"=1-B{U['Min Revenue for 1.00x DSCR']}"
            f"/{fref('Gross Annual Revenue', 'D')}",
    }

    for name, formula, unit, fmt, notes in kpis:
        r = U[name]
        val = d.get(name, formula)
        ws.cell(row=r, column=1, value=name).font = REGULAR_FONT
        cell = ws.cell(row=r, column=2, value=val)
        cell.font = BOLD_FONT
        cell.number_format = fmt
        ws.cell(row=r, column=3, value=unit).font = REGULAR_FONT
        ws.cell(row=r, column=4, value=notes).font = REGULAR_FONT
        for c in range(1, 5):
            ws.cell(row=r, column=c).border = BORDER_DATA

    globals()["U"] = U
    return ws


# ---------------------------------------------------------------------------
# Sheet: Sensitivity Engine (16 live scenarios)
# ---------------------------------------------------------------------------
def build_engine(wb):
    ws = wb.create_sheet(title=ENGINE_SHEET)
    title_block(
        ws,
        "Sensitivity Engine — 16 Live Scenarios",
        "Each row re-runs the full leveraged model (debt schedule, GIDLR tax"
        " cap, residual value) for one tariff x debt-ratio combination",
    )
    style_header_row(
        ws, 4,
        ["Scenario", "Tariff $/kWh", "Debt %", "Debt $", "Equity $",
         "Debt Service", "Y0 FCFE", "Y1 FCFE", "Y2 FCFE", "Y3 FCFE",
         "Y4 FCFE", "Y5 FCFE", "Equity IRR", "Avg DSCR"],
    )

    n = len(TARIFFS) * len(DEBT_RATIOS)
    grid_header = 4 + n + 2          # EBITDA grid header row
    grid_start = grid_header + 1     # first EBITDA grid data row
    E["grid_start"] = grid_start

    rate = pref("Interest_Rate")
    tenor = pref("Debt_Tenor")
    capex = pref("CapEx_Initial")
    cap = pref("GIDLR_EBITDA_Cap")
    tax = pref("UAE_Corporate_Tax")
    resid = f"{pref('CapEx_Initial')}*{pref('Residual_Value_Pct')}"
    depr = f"{pref('CapEx_Initial')}/5"
    grid_cols = ["B", "C", "D", "E", "F"]  # Y1..Y5 on the EBITDA grid

    idx = 0
    for tariff in TARIFFS:
        for dr in DEBT_RATIOS:
            r = 5 + idx
            g = grid_start + idx
            E[idx] = r
            label = f"${tariff:.2f}/kWh @ {int(dr * 100)}% debt"
            ws.cell(row=r, column=1, value=label).font = REGULAR_FONT
            b = ws.cell(row=r, column=2, value=tariff)
            b.font = INPUT_FONT
            b.number_format = "$#,##0.000"
            c = ws.cell(row=r, column=3, value=dr)
            c.font = INPUT_FONT
            c.number_format = "0%"
            ws.cell(row=r, column=4, value=f"={capex}*$C{r}").number_format = FMT_MONEY
            ws.cell(row=r, column=5, value=f"={capex}-$D{r}").number_format = FMT_MONEY
            ws.cell(row=r, column=6,
                    value=f"=-PMT({rate},{tenor},$D{r})").number_format = FMT_MONEY
            ws.cell(row=r, column=7, value=f"=-$E{r}").number_format = FMT_MONEY
            for t in range(1, 6):
                eb = f"{grid_cols[t - 1]}{g}"
                interest = f"-IPMT({rate},{t},{tenor},$D{r})"
                fcfe = (f"={eb}-$F{r}"
                        f"-MAX(0,{eb}-{depr}-MIN({interest},{cap}*{eb}))*{tax}")
                if t == 5:
                    fcfe += f"+{resid}"
                cell = ws.cell(row=r, column=7 + t, value=fcfe)
                cell.number_format = FMT_MONEY
            ws.cell(row=r, column=13,
                    value=f"=IRR(G{r}:L{r})").number_format = FMT_PCT
            ws.cell(row=r, column=14,
                    value=f"=AVERAGE(B{g}:F{g})/$F{r}").number_format = FMT_X
            for col in range(1, 15):
                cell = ws.cell(row=r, column=col)
                cell.border = BORDER_DATA
                if cell.font == Font():
                    cell.font = REGULAR_FONT
            idx += 1

    # EBITDA grid: scenario-specific EBITDA per year (tariff is the only
    # scenario-dependent OpEx driver; revenue & fixed OpEx come from the pro forma)
    ws.cell(row=grid_header - 1, column=1,
            value="Scenario EBITDA Grid (Year 1-5)").font = SECTION_FONT
    style_header_row(ws, grid_header,
                     ["Scenario", "Y1 EBITDA", "Y2 EBITDA", "Y3 EBITDA",
                      "Y4 EBITDA", "Y5 EBITDA"])
    kwh = fref("Annual Facility Energy (kWh)", "C")
    tesc = pref("Tariff_Escalation")
    for i in range(n):
        r = E[i]
        g = grid_start + i
        ws.cell(row=g, column=1, value=f"=A{r}").font = REGULAR_FONT
        for t in range(1, 6):
            col = fref("Gross Annual Revenue", YEAR_COLS[t])
            fixed = fref("Fixed Non-Power OpEx", YEAR_COLS[t])
            f = (f"={col}-{fixed}"
                 f"-{kwh}*$B{r}*POWER(1+{tesc},{t - 1})")
            cell = ws.cell(row=g, column=1 + t, value=f)
            cell.number_format = FMT_MONEY
            cell.border = BORDER_DATA
    return ws


# ---------------------------------------------------------------------------
# Sheet: Sensitivity Matrices (linked to engine)
# ---------------------------------------------------------------------------
def build_matrices(wb):
    ws = wb.create_sheet(title="Sensitivity Matrices")
    title_block(
        ws,
        "5-Year Leveraged Sensitivity Matrices",
        "Power tariff ($0.04 - $0.10/kWh) vs. debt ratio (50% - 80%) — every"
        " cell is a live link to the Sensitivity Engine",
    )

    ws["A4"] = "Matrix 1: Leveraged 5-Year Equity IRR (%)"
    ws["A4"].font = SECTION_FONT
    headers = ["Power Tariff ($/kWh)"] + [f"{int(d * 100)}% Debt" for d in DEBT_RATIOS]
    style_header_row(ws, 5, headers)
    for ti, tariff in enumerate(TARIFFS):
        r = 6 + ti
        ws.cell(row=r, column=1, value=f"${tariff:.2f} / kWh").font = REGULAR_FONT
        ws.cell(row=r, column=1).border = BORDER_DATA
        for di in range(len(DEBT_RATIOS)):
            src = E[ti * len(DEBT_RATIOS) + di]
            cell = ws.cell(row=r, column=2 + di,
                           value=f"='{ENGINE_SHEET}'!M{src}")
            cell.font = LINK_FONT
            cell.border = BORDER_DATA
            cell.number_format = FMT_PCT
            cell.alignment = Alignment(horizontal="right")

    ws["A12"] = "Matrix 2: Average Debt Service Coverage Ratio (DSCR)"
    ws["A12"].font = SECTION_FONT
    style_header_row(ws, 13, headers)
    for ti, tariff in enumerate(TARIFFS):
        r = 14 + ti
        ws.cell(row=r, column=1, value=f"${tariff:.2f} / kWh").font = REGULAR_FONT
        ws.cell(row=r, column=1).border = BORDER_DATA
        for di in range(len(DEBT_RATIOS)):
            src = E[ti * len(DEBT_RATIOS) + di]
            cell = ws.cell(row=r, column=2 + di,
                           value=f"='{ENGINE_SHEET}'!N{src}")
            cell.font = LINK_FONT
            cell.border = BORDER_DATA
            cell.number_format = FMT_X
            cell.alignment = Alignment(horizontal="right")
    return ws


# ---------------------------------------------------------------------------
# Sheet: Dashboard
# ---------------------------------------------------------------------------
def build_dashboard(wb):
    ws = wb.create_sheet(title="Dashboard", index=0)
    title_block(
        ws,
        "AI Factory Dashboard — 32x Vera Rubin NVL72, Abu Dhabi",
        "Headline KPIs, all live-linked; edit assumptions on"
        " 'Control Panel & Inputs'",
    )
    style_header_row(ws, 4, ["KPI", "Value", "Unit", "Source Sheet"])

    U = globals()["U"]
    ue = "Unit Economics & KPIs"
    kpis = [
        ("Equity IRR (5-Yr, levered)",
         f"='{PROFORMA_SHEET}'!B{F['Equity IRR (5-Yr, levered)']}",
         "%", FMT_PCT, PROFORMA_SHEET),
        ("Project IRR (5-Yr, unlevered)",
         f"='{PROFORMA_SHEET}'!B{F['Project IRR (5-Yr, unlevered)']}",
         "%", FMT_PCT, PROFORMA_SHEET),
        ("Equity NPV @ hurdle rate",
         f"='{PROFORMA_SHEET}'!B{F['Equity NPV @ hurdle rate']}",
         "USD", FMT_MONEY, PROFORMA_SHEET),
        ("MOIC",
         f"='{PROFORMA_SHEET}'!B{F['MOIC (total distributions / equity)']}",
         "x", FMT_X, PROFORMA_SHEET),
        ("Payback Period",
         f"='{PROFORMA_SHEET}'!B{F['Payback Period']}",
         "years", FMT_YEARS, PROFORMA_SHEET),
        ("Year 1 Gross Revenue",
         f"={fref('Gross Annual Revenue', 'C')}",
         "USD", FMT_MONEY, PROFORMA_SHEET),
        ("Year 1 EBITDA",
         f"={fref('EBITDA', 'C')}",
         "USD", FMT_MONEY, PROFORMA_SHEET),
        ("Year 1 EBITDA Margin",
         f"={fref('EBITDA Margin', 'C')}",
         "%", FMT_PCT, PROFORMA_SHEET),
        ("Minimum DSCR",
         f"='{PROFORMA_SHEET}'!B{F['Minimum DSCR']}",
         "x", FMT_X, PROFORMA_SHEET),
        ("Peak MLC vs ASHRAE 90.4",
         f"={tref('Peak Mechanical Load Component (MLC)')}",
         "(limit 0.260)", FMT_3DP, THERMAL_SHEET),
        ("MLC Compliance Margin",
         f"={tref('Safety Compliance Margin')}",
         "%", FMT_PCT, THERMAL_SHEET),
        ("Annual Facility Energy",
         f"={tref('Annual Facility Energy')}",
         "MWh/yr", FMT_NUM, THERMAL_SHEET),
        ("Annual Carbon Emissions",
         f"={tref('Annual Carbon Emissions')}",
         "tCO2/yr", FMT_NUM, THERMAL_SHEET),
        ("Annual Water Consumption",
         f"={tref('Annual Water Consumption')}",
         "m³/yr", FMT_NUM, THERMAL_SHEET),
        ("Total GPU Count",
         f"='{ue}'!B{U['Total GPU Count']}",
         "GPUs", FMT_NUM, ue),
        ("CapEx per GPU",
         f"='{ue}'!B{U['CapEx per GPU']}",
         "$/GPU", FMT_MONEY, ue),
        ("Blended Revenue per Sold GPU-hour",
         f"='{ue}'!B{U['Blended Revenue per Sold GPU-hour']}",
         "$/GPU-hr", FMT_MONEY_2DP, ue),
        ("Cash Cost per M Tokens",
         f"='{ue}'!B{U['Cash Cost per M Tokens']}",
         "$/M tok", FMT_MONEY_2DP, ue),
        ("Energy Cost as % of Revenue",
         f"='{ue}'!B{U['Energy Cost as % of Revenue']}",
         "%", FMT_PCT, ue),
        ("Breakeven Power Tariff",
         f"='{ue}'!B{U['Breakeven Power Tariff (EBITDA = 0)']}",
         "$/kWh", "$#,##0.000", ue),
    ]
    for i, (name, formula, unit, fmt, src) in enumerate(kpis):
        r = 5 + i
        ws.cell(row=r, column=1, value=name).font = BOLD_FONT
        cell = ws.cell(row=r, column=2, value=formula)
        cell.font = LINK_BOLD_FONT
        cell.number_format = fmt
        cell.fill = HIGHLIGHT_FILL if i < 5 else PatternFill()
        ws.cell(row=r, column=3, value=unit).font = REGULAR_FONT
        ws.cell(row=r, column=4, value=src).font = SUBTITLE_FONT
        for c in range(1, 5):
            ws.cell(row=r, column=c).border = BORDER_DATA
    return ws


def autosize(wb):
    from openpyxl.utils import get_column_letter
    for ws in wb.worksheets:
        for col in ws.columns:
            col_letter = get_column_letter(col[0].column)
            max_len = 0
            for cell in col:
                if cell.value is None or cell.row in (1, 2):
                    continue
                v = str(cell.value)
                if v.startswith("="):  # formula text length is meaningless
                    v = "0" * 14
                max_len = max(max_len, len(v))
            ws.column_dimensions[col_letter].width = min(max(max_len + 4, 14), 44)


def build_workbook():
    P.clear(); T.clear(); F.clear(); E.clear()
    wb = openpyxl.Workbook()
    build_inputs(wb)
    build_thermal(wb)
    build_proforma(wb)
    build_unit_economics(wb)
    build_engine(wb)
    build_matrices(wb)
    build_dashboard(wb)
    autosize(wb)
    return wb, {"P": dict(P), "T": dict(T), "F": dict(F), "E": dict(E),
                "U": dict(globals()["U"])}


if __name__ == "__main__":
    wb, _maps = build_workbook()
    wb.save(FILE_NAME)
    print(f"Successfully generated financial & engineering model: {FILE_NAME}")
