"""Independent Python reference for src/lib/businessCase/engine.ts.

Recomputes the business case from the written spec (monthly schedule, N debt
tranches with IDC + grace + annuity, ramp, fleet-age price decay, GPU refresh,
NOL tax, NBV / multiple / per-MW exit, IRR, NPV, DSCR, breakeven price).
No code is shared with the TypeScript engine.

Usage:  python3 scripts/business-case/reference_model.py < inputs.json
Prints a JSON dict of headline metrics for the crosscheck.
"""
import json, sys, math

H_MONTH = 8760 / 12
D_MONTH = 365 / 12

def irr(cf):
    if not any(v > 0 for v in cf) or not any(v < 0 for v in cf):
        return None
    f = lambda r: sum(v / (1 + r) ** i for i, v in enumerate(cf))
    lo, hi = -0.5, 1.0
    flo, fhi = f(lo), f(hi)
    if flo * fhi > 0:
        hi = 10.0; fhi = f(hi)
        if flo * fhi > 0:
            return None
    for _ in range(200):
        mid = (lo + hi) / 2; fm = f(mid)
        if abs(fm) < 1e-6:
            lo = hi = mid; break
        if flo * fm < 0: hi, fhi = mid, fm
        else: lo, flo = mid, fm
    return ((1 + (lo + hi) / 2) ** 12 - 1) * 100

def npv(cf, rate_pct):
    r = (1 + rate_pct / 100) ** (1 / 12) - 1
    return sum(v / (1 + r) ** i for i, v in enumerate(cf))

def annuity(bal, r, n):
    if n <= 0: return bal
    if r == 0: return bal / n
    return bal * r / (1 - (1 + r) ** -n)

def simulate(I, price_scale=1.0, buys_servers=True, energy_pass=False):
    it_mw = I['itCapacityMW']; it_kw = it_mw * 1000
    units = math.floor(it_kw / I['unitKW']); gpus = units * I['gpusPerUnit']
    fac_mw = it_mw * I['pue']
    btm = I['genCapexPerKW'] > 0
    gen_mw = fac_mw * I['redundancyFactor'] if btm else 0

    idx = I['constructionCostIndex']
    land = I['landPerMW'] * it_mw
    shell = I['shellPerKW'] * it_kw * idx
    mep = I['mepPerKW'] * it_kw * idx * ((1 + I['liquidCoolingPremiumPct'] / 100) if I['cooling'] == 'liquid' else 1)
    util_w = I['utilityWorksPerKW'] * it_kw * idx
    gen = I['genCapexPerKW'] * gen_mw * 1000 * idx
    cont = I['contingencyPct'] / 100 * (shell + mep + util_w + gen)
    servers = units * I['unitCostUSD'] if buys_servers else 0
    network = servers * I['networkPctOfServer'] / 100
    infra = land + shell + mep + util_w + gen + cont
    srv = servers + network

    build = max(I['constructionMonths'], I['powerLeadTimeMonths'])
    cod = build
    T = cod + I['horizonYears'] * 12
    cap_infra = [infra / build if m < build else 0 for m in range(T)]
    sm = min(3, cod)
    cap_srv = [srv / sm if cod - sm <= m < cod else 0 for m in range(T)]
    cap_ref = [0.0] * T
    life = max(12, round(I['gpuDepreciationYears'] * 12))
    if I['gpuRefresh'] and buys_servers:
        t = life
        while t + 12 <= I['horizonYears'] * 12:
            cap_ref[cod + t] = srv * I['refreshCostPct'] / 100; t += life

    basis = lambda b: srv if b == 'servers' else infra if b == 'infra' else infra + srv
    tr = []
    for k in I['tranches']:
        tr.append(dict(k, commit=basis(k['basis']) * k['ltcPct'] / 100, drawn=0.0, bal=0.0,
                       r=k['ratePct'] / 100 / 12, n=k['tenorYears'] * 12, pmt=0.0))
    grace = max(0, min(I['gracePeriodMonths'], 60))

    infra_book = srv_book = 0.0; nolL = nolU = 0.0; idc_total = 0.0; debt_cod = 0.0
    ucf, lcf, rows = [], [], []
    cs = I['contractedSharePct'] / 100
    p0 = cs * I['contractedPricePerGpuHr'] + (1 - cs) * I['onDemandPricePerGpuHr']
    refreshed = False
    for m in range(T):
        in_build = m < cod; t = m - cod
        capex = cap_infra[m] + cap_srv[m] + cap_ref[m]
        draw = 0.0
        if in_build:
            for k in tr:
                spend = cap_srv[m] if k['basis'] == 'servers' else cap_infra[m] if k['basis'] == 'infra' else cap_srv[m] + cap_infra[m]
                share = k['commit'] / basis(k['basis']) if basis(k['basis']) > 0 else 0
                d = min(k['commit'] - k['drawn'], spend * share)
                k['drawn'] += d; k['bal'] += d; draw += d
        interest = principal = idc_cap = idc_cash = 0.0
        for k in tr:
            if in_build:
                i = k['bal'] * k['r']
                if k['idcCapitalized'] and m < build: k['bal'] += i; idc_cap += i
                else: idc_cash += i
                interest += i
            else:
                if t == 0: debt_cod += k['bal']
                if t == grace: k['pmt'] = annuity(k['bal'], k['r'], k['n'] - grace)
                if t < k['n'] and k['bal'] > 1e-9:
                    i = k['bal'] * k['r']
                    p = 0.0 if t < grace else min(k['bal'], k['pmt'] - i)
                    k['bal'] -= p; interest += i; principal += p
        idc_total += idc_cap

        revenue = energy_cost = opex = ebitda = taxL = taxU = 0.0
        if not in_build:
            if t == 0: infra_book = infra + idc_total; srv_book = srv
            if cap_ref[m] > 0: srv_book += cap_ref[m]; refreshed = True
            ramp = min(1, (t + 1) / I['rampMonths']) if I['rampMonths'] > 0 else 1
            util = I['utilizationPct'] / 100 * ramp
            age = ((t % life) if (I['gpuRefresh'] and buys_servers) else t) // 12
            pf = (1 - I['priceDeclinePctPerYear'] / 100) ** age * price_scale
            if I['revenueModelId'] == 'neocloud':
                revenue = gpus * H_MONTH * util * p0 * pf
            elif I['revenueModelId'] == 'inference':
                revenue = gpus * I['tokensPerGPUPerSec'] * 3600 * H_MONTH * util / 1e6 * I['tokenPricePerM'] * pf
            else:
                revenue = it_kw * I['colocationPerKWMonth'] * I['colocationOccupancyPct'] / 100 * ramp * pf
            lf = I['idleLoadPct'] / 100 + (1 - I['idleLoadPct'] / 100) * util
            mwh = fac_mw * lf * H_MONTH
            on_grid = (not btm) or (I['bridgeMonthsToGrid'] > 0 and t >= I['bridgeMonthsToGrid'])
            if on_grid:
                energy = mwh * I['tariffPerKWh'] * 1000 + fac_mw * I['capacityChargePerMWDay'] * D_MONTH
            else:
                energy = mwh * (I['heatRateBtuPerKWh'] / 1e6 * I['gasPricePerMMBtu'] * 1000 + I['genOandMPerMWh'])
            energy_cost = 0.0 if energy_pass else energy
            labor = I['fteDensityPerMW'] * it_mw * I['laborCostPerFTE'] / 12
            maint = I['maintenancePctOfCapex'] / 100 * (infra + srv) / 12
            ins = I['insurancePctOfCapex'] / 100 * (infra + srv) / 12
            ptax = I['propertyTaxPctOfCapex'] / 100 * infra / 12
            sga = I['sgaPctOfRevenue'] / 100 * revenue
            opex = energy_cost + labor + maint + ins + ptax + sga
            ebitda = revenue - opex
            dep_i = min(infra_book, (infra + idc_total) / (I['infraDepreciationYears'] * 12))
            dep_s = min(srv_book, srv * (I['refreshCostPct'] / 100 if refreshed else 1) / (I['gpuDepreciationYears'] * 12))
            infra_book -= dep_i; srv_book -= dep_s
            rate = I['corporateTaxPct'] / 100
            tiL = ebitda - dep_i - dep_s - interest; tiU = ebitda - dep_i - dep_s
            if tiL < 0: nolL += -tiL
            else: u = min(nolL, tiL); nolL -= u; taxL = (tiL - u) * rate
            if tiU < 0: nolU += -tiU
            else: u = min(nolU, tiU); nolU -= u; taxU = (tiU - u) * rate
        cfads = 0.0 if in_build else ebitda - taxL
        ds = idc_cash if in_build else interest + principal
        eq = max(0.0, capex + idc_cash - draw) if in_build else 0.0
        ucf.append(-capex + ebitda - taxU)
        lcf.append(-eq if in_build else cfads - ds)
        rows.append(dict(phase='build' if in_build else 'op', rev=revenue, ebitda=ebitda, dscr=(cfads / ds if (not in_build and ds > 0) else None), eq=eq))
    last12 = sum(r['ebitda'] for r in rows[-12:])
    if I['exitMethod'] == 'nbv': tv = infra_book + srv_book
    elif I['exitMethod'] == 'perMW': tv = I['exitPerMW'] * it_mw
    else: tv = max(0, last12) * I['exitEbitdaMultiple']
    debt_left = sum(k['bal'] for k in tr)
    ucf[-1] += tv; lcf[-1] += tv - debt_left
    total = infra + srv + idc_total
    return dict(ucf=ucf, lcf=lcf, rows=rows, total=total, debt=debt_cod, equity=sum(r['eq'] for r in rows), tv=tv, gpus=gpus, cod=cod)

def main():
    I = json.load(sys.stdin)
    buys = I['revenueModelId'] != 'colocation'; passthru = I['revenueModelId'] == 'colocation'
    b = simulate(I, 1.0, buys, passthru)
    dscrs = [r['dscr'] for r in b['rows'] if r['dscr'] is not None]
    op = [r for r in b['rows'] if r['phase'] == 'op']
    f = lambda k: npv(simulate(I, k, buys, passthru)['ucf'], I['discountRatePct'])
    be = None
    lo, hi = 0.01, 10.0
    if f(lo) < 0 and f(hi) > 0:
        for _ in range(60):
            mid = (lo + hi) / 2
            if f(mid) < 0: lo = mid
            else: hi = mid
        be = (lo + hi) / 2
    out = dict(
        gpus=b['gpus'], codMonth=b['cod'], capexTotal=b['total'], totalDebt=b['debt'], totalEquity=b['equity'],
        projectIRRPct=irr(b['ucf']), equityIRRPct=irr(b['lcf']), npv=npv(b['ucf'], I['discountRatePct']),
        minDSCR=min(dscrs) if dscrs else None,
        year1Revenue=sum(r['rev'] for r in op[:12]),
        steadyStateEBITDA=sum(r['ebitda'] for r in op[I['rampMonths']:I['rampMonths'] + 12]),
        terminalValue=b['tv'], breakevenScale=be,
    )
    print(json.dumps(out))

if __name__ == '__main__':
    main()
