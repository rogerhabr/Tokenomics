import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter


def create_ai_factory_model():
    wb = openpyxl.Workbook()

    # Define Theme Styles (Professional Corporate / Engineering Palette)
    FONT_FAMILY = "Calibri"

    # Fonts
    title_font = Font(name=FONT_FAMILY, size=16, bold=True, color="1F4E78")
    subtitle_font = Font(
        name=FONT_FAMILY, size=11, italic=True, color="595959"
    )
    header_font = Font(name=FONT_FAMILY, size=11, bold=True, color="FFFFFF")
    section_font = Font(name=FONT_FAMILY, size=12, bold=True, color="1F4E78")
    bold_font = Font(name=FONT_FAMILY, size=11, bold=True)
    regular_font = Font(name=FONT_FAMILY, size=11)

    # Fills
    navy_fill = PatternFill(
        start_color="1F4E78", end_color="1F4E78", fill_type="solid"
    )
    section_fill = PatternFill(
        start_color="D9E1F2", end_color="D9E1F2", fill_type="solid"
    )
    zebra_fill = PatternFill(
        start_color="F2F2F2", end_color="F2F2F2", fill_type="solid"
    )
    highlight_fill = PatternFill(
        start_color="E2EFDA", end_color="E2EFDA", fill_type="solid"
    )

    # Borders
    thin_side = Side(border_style="thin", color="D9D9D9")
    thick_bottom = Side(border_style="medium", color="1F4E78")
    double_bottom = Side(border_style="double", color="1F4E78")

    border_data = Border(
        left=thin_side, right=thin_side, top=thin_side, bottom=thin_side
    )
    border_total = Border(
        top=thin_side, bottom=double_bottom, left=thin_side, right=thin_side
    )
    border_section = Border(bottom=thick_bottom)

    # ---------------------------------------------------------
    # SHEET 1: Control Panel & Inputs
    # ---------------------------------------------------------
    ws1 = wb.active
    ws1.title = "Control Panel & Inputs"
    ws1.views.sheetView[0].showGridLines = True

    ws1["A1"] = "NVIDIA Vera Rubin NVL72 AI Factory — Abu Dhabi"
    ws1["A1"].font = title_font
    ws1["A2"] = "Master Operational, Environmental & Financial Baseline"
    ws1["A2"].font = subtitle_font

    headers1 = [
        "Category",
        "Parameter",
        "Value",
        "Unit",
        "Notes / Constraints",
    ]
    for col_num, h in enumerate(headers1, 1):
        cell = ws1.cell(row=4, column=col_num, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    data1 = [
        # Category, Parameter, Value, Unit, Notes
        (
            "Geographic & Climate",
            "Geo_Location",
            "Abu Dhabi, UAE",
            "",
            "ASHRAE Climate Zone 1A",
        ),
        (
            "Geographic & Climate",
            "Peak_Ambient_DryBulb",
            50.0,
            "°C",
            "Extreme peak dry-bulb temperature",
        ),
        (
            "Geographic & Climate",
            "Coincident_WetBulb",
            30.0,
            "°C",
            "Peak summer wet-bulb condition",
        ),
        (
            "Technical Specs",
            "Rack_Count",
            32,
            "racks",
            "Vera Rubin NVL72 Racks",
        ),
        (
            "Technical Specs",
            "Peak_Power_Per_Rack",
            227.0,
            "kW",
            "Compute & scale-up busbar load",
        ),
        (
            "Technical Specs",
            "Air_Cooled_Load",
            1000.0,
            "kW",
            "1.0 MW Network & NVMe Storage",
        ),
        (
            "Technical Specs",
            "Liquid_Supply_Temp_FWS",
            45.0,
            "°C",
            "S45 Direct-to-Chip Loop",
        ),
        (
            "Technical Specs",
            "Target_Annualized_PUE",
            1.08,
            "",
            "High-temp free cooling baseline",
        ),
        (
            "Technical Specs",
            "Target_Peak_MLC",
            0.078,
            "",
            "ASHRAE 90.4 Limit = 0.260",
        ),
        (
            "Financial & Fiscal",
            "Electricity_Tariff",
            0.06,
            "$/kWh",
            "Abu Dhabi industrial rate",
        ),
        (
            "Financial & Fiscal",
            "CapEx_Initial",
            139500000,
            "USD",
            "Total turnkey deployment",
        ),
        (
            "Financial & Fiscal",
            "Debt_Ratio",
            0.80,
            "%",
            "User adjustable (50% - 80%)",
        ),
        (
            "Financial & Fiscal",
            "Interest_Rate",
            0.065,
            "%",
            "Senior debt facility rate",
        ),
        (
            "Financial & Fiscal",
            "Debt_Tenor",
            5,
            "Years",
            "Amortization schedule",
        ),
        (
            "Financial & Fiscal",
            "UAE_Corporate_Tax",
            0.09,
            "%",
            "Statutory corporate tax rate",
        ),
        (
            "Financial & Fiscal",
            "GIDLR_EBITDA_Cap",
            0.30,
            "%",
            "UAE interest deduction limit",
        ),
        (
            "Revenue Strategy",
            "Lease_Revenue_70pct",
            58800000,
            "USD/yr",
            "70% Bare-metal capacity leases",
        ),
        (
            "Revenue Strategy",
            "Token_Revenue_30pct",
            25200000,
            "USD/yr",
            "30% Dynamic API token market",
        ),
    ]

    for row_idx, row_data in enumerate(data1, start=5):
        for col_idx, val in enumerate(row_data, start=1):
            cell = ws1.cell(row=row_idx, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = border_data

            # Apply specific number formatting
            if col_idx == 3:
                if row_data[1] == "CapEx_Initial":
                    cell.number_format = "$#,##0"
                elif row_data[1] in [
                    "Lease_Revenue_70pct",
                    "Token_Revenue_30pct",
                ]:
                    cell.number_format = "$#,##0"
                elif row_data[1] == "Electricity_Tariff":
                    cell.number_format = "$#,##0.000"
                elif "%" in row_data[3]:
                    cell.number_format = "0.0%"
                elif isinstance(val, float):
                    cell.number_format = "#,##0.0" if val % 1 != 0 else "#,##0"
                elif isinstance(val, int):
                    cell.number_format = "#,##0"

    # ---------------------------------------------------------
    # SHEET 2: Thermal Hydraulics & MLC
    # ---------------------------------------------------------
    ws2 = wb.create_sheet(title="Thermal Hydraulics & MLC")
    ws2.views.sheetView[0].showGridLines = True

    ws2["A1"] = "Thermal Hydraulics & ASHRAE 90.4 Compliance Engine"
    ws2["A1"].font = title_font
    ws2["A2"] = (
        "S45 Closed-Loop Fluid Dynamics & 3-Stage Trim Cooling Metrics"
    )
    ws2["A2"].font = subtitle_font

    headers2 = ["Metric / Calculation Step", "Formula / Link", "Unit", "Notes"]
    for col_num, h in enumerate(headers2, 1):
        cell = ws2.cell(row=4, column=col_num, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    calc_rows2 = [
        (
            "Compute IT Load",
            "='Control Panel & Inputs'!C8*'Control Panel & Inputs'!C9",
            "kW",
            "32 racks * 227 kW",
        ),
        (
            "Network & Storage Air Load",
            "='Control Panel & Inputs'!C10",
            "kW",
            "1.0 MW continuous air load",
        ),
        (
            "Total Combined IT Load",
            "=B5+B6",
            "kW",
            "Compute + Network/Storage",
        ),
        ("S45 Loop Supply Temperature", 45.0, "°C", "Facility Water Supply (FWS)"),
        ("S45 Loop Return Temperature", 55.0, "°C", "Facility Water Return (FWR)"),
        ("S45 Loop Delta T", "=B9-B8", "°C", "Hydraulic temperature split"),
        (
            "S45 Liquid Flow Rate per Rack",
            195.0,
            "LPM",
            "PG25 water/glycol mixture",
        ),
        (
            "Total S45 Cluster Flow Rate",
            "=B11*'Control Panel & Inputs'!C8",
            "LPM",
            "Primary CDU manifold demand",
        ),
        (
            "Peak Ambient Dry-Bulb",
            "='Control Panel & Inputs'!C6",
            "°C",
            "Abu Dhabi extreme condition",
        ),
        (
            "S45 Peak Rejection Approach",
            "=B9-B13",
            "K",
            "Positive 5K gradient at 50°C DB",
        ),
        (
            "S45 Dry Cooler / CDU Cooling Power",
            "=B5*0.05",
            "kW",
            "CDU pumps & EC fan power",
        ),
        (
            "Air Loop Chiller Cooling Power",
            "=B6*0.28",
            "kW",
            "High-ambient screw chillers",
        ),
        ("Total Cooling Peak Power", "=B15+B16", "kW", "Combined cooling power"),
        (
            "Peak Mechanical Load Component (MLC)",
            "=B17/B7",
            "",
            "Cooling Power / Total IT Load",
        ),
        (
            "ASHRAE 90.4 Zone 1A Limit",
            0.260,
            "",
            "Maximum allowable peak threshold",
        ),
        (
            "Safety Compliance Margin",
            "=(B19-B18)/B19",
            "%",
            "Operational margin under Zone 1A",
        ),
    ]

    for row_idx, (m, f, u, n) in enumerate(calc_rows2, start=5):
        ws2.cell(row=row_idx, column=1, value=m).font = regular_font
        c2 = ws2.cell(row=row_idx, column=2, value=f)
        c2.font = bold_font
        ws2.cell(row=row_idx, column=3, value=u).font = regular_font
        ws2.cell(row=row_idx, column=4, value=n).font = regular_font

        for c in range(1, 5):
            ws2.cell(row=row_idx, column=c).border = border_data

        if u == "kW" or u == "LPM":
            c2.number_format = "#,##0.0"
        elif u == "%":
            c2.number_format = "0.0%"
        elif isinstance(f, float) and u == "":
            c2.number_format = "0.000"

    # ---------------------------------------------------------
    # SHEET 3: 5Yr Pro Forma Financials
    # ---------------------------------------------------------
    ws3 = wb.create_sheet(title="5Yr Pro Forma Financials")
    ws3.views.sheetView[0].showGridLines = True

    ws3["A1"] = "5-Year Leveraged Financial Model & Debt Amortization"
    ws3["A1"].font = title_font
    ws3["A2"] = "Includes UAE Corporate Tax (9%) & GIDLR Interest Limits"
    ws3["A2"].font = subtitle_font

    headers3 = [
        "Line Item (USD)",
        "Year 0",
        "Year 1",
        "Year 2",
        "Year 3",
        "Year 4",
        "Year 5",
    ]
    for col_num, h in enumerate(headers3, 1):
        cell = ws3.cell(row=4, column=col_num, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    fin_items = [
        (
            "Gross Annual Revenue",
            0,
            "='Control Panel & Inputs'!C21+'Control Panel & Inputs'!C22",
            "=C5",
            "=D5",
            "=E5",
            "=F5",
        ),
        (
            "Electricity Cost ($0.06/kWh)",
            0,
            "=7750*8760*'Control Panel & Inputs'!C14",
            "=C6",
            "=D6",
            "=E6",
            "=F6",
        ),
        ("Fixed Non-Power OpEx", 0, 10877000, 10877000, 10877000, 10877000, 10877000),
        ("Total Operational Expense (OpEx)", 0, "=C6+C7", "=D6+D7", "=E6+E7", "=F6+F7", "=G6+G7"),
        ("EBITDA", 0, "=C5-C8", "=D5-D8", "=E5-E8", "=F5-F8", "=G5-G8"),
        ("EBITDA Margin", 0, "=C9/C5", "=D9/D5", "=E9/E5", "=F9/F5", "=G9/G5"),
        (
            "CapEx Initial Outlay",
            "='Control Panel & Inputs'!C15",
            0,
            0,
            0,
            0,
            0,
        ),
        ("Debt Financed Amount (80%)", "=B11*'Control Panel & Inputs'!C16", 0, 0, 0, 0, 0),
        ("Equity Outlay (20%)", "=B11-B12", 0, 0, 0, 0, 0),
        ("Annual Debt Service (P+I)", 0, "=PPMT('Control Panel & Inputs'!C17,1,'Control Panel & Inputs'!C18,-$B$12)+IPMT('Control Panel & Inputs'!C17,1,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,2,'Control Panel & Inputs'!C18,-$B$12)+IPMT('Control Panel & Inputs'!C17,2,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,3,'Control Panel & Inputs'!C18,-$B$12)+IPMT('Control Panel & Inputs'!C17,3,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,4,'Control Panel & Inputs'!C18,-$B$12)+IPMT('Control Panel & Inputs'!C17,4,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,5,'Control Panel & Inputs'!C18,-$B$12)+IPMT('Control Panel & Inputs'!C17,5,'Control Panel & Inputs'!C18,-$B$12)"),
        ("Debt Principal Payment", 0, "=PPMT('Control Panel & Inputs'!C17,1,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,2,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,3,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,4,'Control Panel & Inputs'!C18,-$B$12)", "=PPMT('Control Panel & Inputs'!C17,5,'Control Panel & Inputs'!C18,-$B$12)"),
        ("Interest Expense", 0, "=IPMT('Control Panel & Inputs'!C17,1,'Control Panel & Inputs'!C18,-$B$12)", "=IPMT('Control Panel & Inputs'!C17,2,'Control Panel & Inputs'!C18,-$B$12)", "=IPMT('Control Panel & Inputs'!C17,3,'Control Panel & Inputs'!C18,-$B$12)", "=IPMT('Control Panel & Inputs'!C17,4,'Control Panel & Inputs'!C18,-$B$12)", "=IPMT('Control Panel & Inputs'!C17,5,'Control Panel & Inputs'!C18,-$B$12)"),
        ("Depreciation (5-Yr Straight Line)", 0, "=$B$11/5", "=$B$11/5", "=$B$11/5", "=$B$11/5", "=$B$11/5"),
        ("Taxable Income (EBITDA - Depr - Int)", 0, "=C9-C17-C16", "=D9-D17-D16", "=E9-E17-E16", "=F9-F17-F16", "=G9-G17-G16"),
        ("UAE Corporate Tax (9%)", 0, "=C18*'Control Panel & Inputs'!C19", "=D18*'Control Panel & Inputs'!C19", "=E18*'Control Panel & Inputs'!C19", "=F18*'Control Panel & Inputs'!C19", "=G18*'Control Panel & Inputs'!C19"),
        ("Leveraged Free Cash Flow (FCFE)", "=-B13", "=C9-C14-C19", "=D9-D14-D19", "=E9-E14-E19", "=F9-F14-F19", "=G9-G14-G19"),
        ("Debt Service Coverage Ratio (DSCR)", 0, "=C9/C14", "=D9/D14", "=E9/E14", "=F9/F14", "=G9/G14"),
    ]

    for row_idx, row_vals in enumerate(fin_items, start=5):
        ws3.cell(row=row_idx, column=1, value=row_vals[0]).font = (
            bold_font if "Margin" not in row_vals[0] else regular_font
        )

        for col_idx in range(2, 8):
            val = row_vals[col_idx - 1]
            cell = ws3.cell(row=row_idx, column=col_idx, value=val)
            cell.font = regular_font
            cell.border = border_data

            if "Margin" in row_vals[0]:
                cell.number_format = "0.0%"
            elif "DSCR" in row_vals[0]:
                cell.number_format = "0.00'x'"
            else:
                cell.number_format = "$#,##0"

    # Highlight Leveraged FCF Row
    for col in range(1, 8):
        ws3.cell(row=20, column=col).fill = highlight_fill
        ws3.cell(row=20, column=col).font = bold_font
        ws3.cell(row=20, column=col).border = border_total

    # ---------------------------------------------------------
    # SHEET 4: Sensitivity Matrices
    # ---------------------------------------------------------
    ws4 = wb.create_sheet(title="Sensitivity Matrices")
    ws4.views.sheetView[0].showGridLines = True

    ws4["A1"] = "5-Year Leveraged Sensitivity Matrices"
    ws4["A1"].font = title_font
    ws4["A2"] = (
        "Power Tariff ($0.04 - $0.10/kWh) vs. Debt Ratio (50% - 80%) Impact"
    )
    ws4["A2"].font = subtitle_font

    # Matrix 1: IRR
    ws4["A4"] = "Matrix 1: Leveraged 5-Year IRR (%)"
    ws4["A4"].font = section_font

    irr_headers = [
        "Power Tariff ($/kWh)",
        "50% Debt",
        "60% Debt",
        "70% Debt",
        "80% Debt",
    ]
    for col_num, h in enumerate(irr_headers, 1):
        cell = ws4.cell(row=5, column=col_num, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    irr_data = [
        ("$0.04 / kWh", 0.486, 0.614, 0.821, 1.418),
        ("$0.06 / kWh", 0.471, 0.597, 0.800, 1.382),
        ("$0.08 / kWh", 0.456, 0.579, 0.778, 1.345),
        ("$0.10 / kWh", 0.442, 0.562, 0.756, 1.308),
    ]

    for r_i, row in enumerate(irr_data, start=6):
        for c_i, val in enumerate(row, start=1):
            cell = ws4.cell(row=r_i, column=c_i, value=val)
            cell.font = regular_font
            cell.border = border_data
            if c_i > 1:
                cell.number_format = "0.0%"
                cell.alignment = Alignment(horizontal="right")

    # Matrix 2: DSCR
    ws4["A12"] = "Matrix 2: Average Debt Service Coverage Ratio (DSCR)"
    ws4["A12"].font = section_font

    dscr_headers = [
        "Power Tariff ($/kWh)",
        "50% Debt ($16.8M DS)",
        "60% Debt ($20.1M DS)",
        "70% Debt ($23.5M DS)",
        "80% Debt ($26.8M DS)",
    ]
    for col_num, h in enumerate(dscr_headers, 1):
        cell = ws4.cell(row=13, column=col_num, value=h)
        cell.font = header_font
        cell.fill = navy_fill
        cell.alignment = Alignment(horizontal="center", vertical="center")

    dscr_data = [
        ("$0.04 / kWh", 4.20, 3.50, 3.00, 2.62),
        ("$0.06 / kWh", 4.12, 3.43, 2.94, 2.58),
        ("$0.08 / kWh", 4.04, 3.36, 2.88, 2.52),
        ("$0.10 / kWh", 3.96, 3.30, 2.83, 2.47),
    ]

    for r_i, row in enumerate(dscr_data, start=14):
        for c_i, val in enumerate(row, start=1):
            cell = ws4.cell(row=r_i, column=c_i, value=val)
            cell.font = regular_font
            cell.border = border_data
            if c_i > 1:
                cell.number_format = "0.00'x'"
                cell.alignment = Alignment(horizontal="right")

    # Auto-adjust column widths across all sheets
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                if cell.value is not None:
                    # Ignore titles when calculating width
                    if cell.row in [1, 2]:
                        continue
                    cell_len = len(str(cell.value))
                    if cell_len > max_len:
                        max_len = cell_len
            ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    # Save workbook
    file_name = "AI_Factory_32x_Rubin_AbuDhabi.xlsx"
    wb.save(file_name)
    print(
        f"Successfully generated financial & engineering model: {file_name}"
    )


if __name__ == "__main__":
    create_ai_factory_model()
