'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, LineChart,
} from 'recharts';
import SectionHeader from '../SectionHeader';
import MetricCard from '../MetricCard';
import DataTable from '../DataTable';
import {
  GEOGRAPHIES, CHIPS, POWER_SOURCES, REVENUE_MODELS, CAPITAL_STACKS, CREDIT_SUPPORTS,
  buildInputs, runBusinessCase, generateBusinessPlan, byId,
  type BusinessCaseInputs, type ExitMethod, type RevenueModelId,
} from '@/lib/businessCase';

// Chart palette validated with the dataviz validator against #141b2d (dark card surface).
const C = { revenue: '#3b82f6', opex: '#d97706', debt: '#8b5cf6', cf: '#059669' };

const fmtUSD = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return 'n/a';
  const a = Math.abs(n), sign = n < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}k`;
  return `${sign}$${a.toFixed(0)}`;
};
const fmtPct = (n: number | null, d = 1) => n === null ? 'n/a' : `${n.toFixed(d)}%`;
const fmtX = (n: number | null) => n === null ? 'n/a' : `${n.toFixed(2)}×`;

// ─── Small controls ──────────────────────────────────────────────────────────

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-sa-muted font-semibold">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full text-sm bg-sa-card border border-sa-border text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-sa-accent"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-white number-cell">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))} className="w-full" style={{ accentColor: '#f97316' }} />
    </div>
  );
}

function Group({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="mb-3 group" open={open}>
      <summary className="cursor-pointer text-xs font-semibold text-sa-accent uppercase tracking-wider flex items-center gap-2 py-1 select-none">
        <span className="inline-block transition-transform group-open:rotate-90">▸</span>{title}
      </summary>
      <div className="space-y-3 mt-2 pl-1">{children}</div>
    </details>
  );
}

// Fields re-applied from a preset when a dropdown changes (user overrides elsewhere are kept).
const PRESET_FIELDS: Record<string, (keyof BusinessCaseInputs)[]> = {
  geographyId: ['geographyId', 'tariffPerKWh', 'capacityChargePerMWDay', 'gasPricePerMMBtu', 'landPerMW', 'laborCostPerFTE', 'corporateTaxPct', 'propertyTaxPctOfCapex', 'constructionCostIndex', 'powerLeadTimeMonths'],
  chipId: ['chipId', 'gpusPerUnit', 'unitKW', 'unitCostUSD', 'tokensPerGPUPerSec', 'cooling', 'contractedPricePerGpuHr', 'onDemandPricePerGpuHr', 'pue'],
  powerSourceId: ['powerSourceId', 'genCapexPerKW', 'heatRateBtuPerKWh', 'genOandMPerMWh', 'redundancyFactor', 'powerLeadTimeMonths', 'bridgeMonthsToGrid'],
  revenueModelId: ['revenueModelId', 'fteDensityPerMW', 'maintenancePctOfCapex', 'sgaPctOfRevenue', 'priceDeclinePctPerYear'],
  capitalStackId: ['capitalStackId', 'tranches', 'targetEquityIRRPct'],
  creditSupportId: ['creditSupportId', 'creditSupport'],
};

interface SavedCase { id: string; name: string; inputs: BusinessCaseInputs; updated_at: string }

export default function BusinessCase() {
  const [inputs, setInputs] = useState<BusinessCaseInputs>(() => buildInputs({ name: 'ERCOT 50 MW GB200 Neocloud' }));
  const [saved, setSaved] = useState<SavedCase[]>([]);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const out = useMemo(() => runBusinessCase(inputs), [inputs]);

  const set = useCallback(<K extends keyof BusinessCaseInputs>(k: K) => (v: BusinessCaseInputs[K]) =>
    setInputs(prev => ({ ...prev, [k]: v })), []);

  const applyPreset = (kind: keyof typeof PRESET_FIELDS, id: string) => {
    setInputs(prev => {
      const sel = {
        geographyId: prev.geographyId, chipId: prev.chipId, powerSourceId: prev.powerSourceId,
        revenueModelId: prev.revenueModelId, capitalStackId: prev.capitalStackId, creditSupportId: prev.creditSupportId,
        [kind]: id, name: prev.name, itCapacityMW: prev.itCapacityMW,
      } as Parameters<typeof buildInputs>[0];
      const fresh = buildInputs(sel);
      const next = { ...prev };
      for (const f of PRESET_FIELDS[kind]) (next as Record<string, unknown>)[f] = fresh[f];
      // A grid power source takes its lead time from the geography; keep that coupling when geography changes.
      if (kind === 'geographyId' && byId(POWER_SOURCES, prev.powerSourceId).kind !== 'grid') next.powerLeadTimeMonths = prev.powerLeadTimeMonths;
      return next;
    });
  };

  const setTranche = (i: number, k: 'ltcPct' | 'ratePct' | 'tenorYears', v: number) =>
    setInputs(prev => ({ ...prev, tranches: prev.tranches.map((t, j) => j === i ? { ...t, [k]: v } : t) }));
  const setCS = <K extends keyof BusinessCaseInputs['creditSupport']>(k: K, v: BusinessCaseInputs['creditSupport'][K]) =>
    setInputs(prev => ({ ...prev, creditSupport: { ...prev.creditSupport, [k]: v } }));
  const setStress = <K extends keyof BusinessCaseInputs['stress']>(k: K, v: number) =>
    setInputs(prev => ({ ...prev, stress: { ...prev.stress, [k]: v } }));

  // ── Persistence (RLS-scoped route; degrades to "sign in to save" when unauthenticated)
  useEffect(() => {
    fetch('/api/business-cases')
      .then(async r => { if (r.status === 401) { setAuthed(false); return []; } if (!r.ok) throw new Error(); setAuthed(true); return r.json(); })
      .then((rows: SavedCase[]) => setSaved(Array.isArray(rows) ? rows : []))
      .catch(() => setAuthed(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const r = await fetch('/api/business-cases', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentId ?? undefined, name: inputs.name, inputs }),
      });
      const row = await r.json();
      if (!r.ok) throw new Error(row.error ?? 'save failed');
      setCurrentId(row.id);
      setSaved(prev => [row, ...prev.filter(s => s.id !== row.id)]);
      setMsg(`Saved “${row.name}”`);
    } catch (e) { setMsg(`Save failed: ${(e as Error).message}`); }
    finally { setSaving(false); }
  };
  const load = (id: string) => {
    const row = saved.find(s => s.id === id);
    if (!row) { setCurrentId(null); return; }
    setInputs({ ...buildInputs({}), ...row.inputs }); setCurrentId(row.id); setMsg(`Loaded “${row.name}”`);
  };
  const remove = async () => {
    if (!currentId) return;
    await fetch(`/api/business-cases?id=${encodeURIComponent(currentId)}`, { method: 'DELETE' });
    setSaved(prev => prev.filter(s => s.id !== currentId)); setCurrentId(null); setMsg('Deleted');
  };

  const download = (filename: string, text: string, type = 'text/markdown') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
  const slug = inputs.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'business-case';

  const geo = byId(GEOGRAPHIES, inputs.geographyId);
  const chip = byId(CHIPS, inputs.chipId);
  const pwr = byId(POWER_SOURCES, inputs.powerSourceId);
  const cs = byId(CREDIT_SUPPORTS, inputs.creditSupportId);
  const isGrid = pwr.kind === 'grid';
  const blended = inputs.contractedSharePct / 100 * inputs.contractedPricePerGpuHr + (1 - inputs.contractedSharePct / 100) * inputs.onDemandPricePerGpuHr;

  const annualChart = out.annual.map(a => ({
    year: `Y${a.year}`, Revenue: a.revenue / 1e6, 'Cash opex': a.opex / 1e6, 'Debt service': a.debtService / 1e6, 'Levered CF': a.leveredCF / 1e6,
  }));
  const dscrChart = out.annual.filter(a => a.dscr !== null).map(a => ({ year: `Y${a.year}`, DSCR: a.dscr }));

  const q = (ok: boolean) => ok ? <span className="text-sa-green">Yes</span> : <span className="text-sa-red">No</span>;
  const debtPct = out.sourcesUses.totalDebt + out.sourcesUses.totalEquity > 0
    ? out.sourcesUses.totalDebt / (out.sourcesUses.totalDebt + out.sourcesUses.totalEquity) * 100 : 0;

  return (
    <div>
      <SectionHeader
        title="Business Case Agent"
        subtitle="Grid-to-chip-to-token project-finance model. Pick a geography, power source, chip, revenue model, capital stack and credit support from the dropdowns; every default is then an editable assumption. Outputs are what an Origin Partners-type lender underwrites: DSCR, leverage, equity IRR, and who takes the loss when power is late, construction overruns, or the customer stops paying."
        badge="Interactive"
        sources={[
          { type: 'derived', label: 'Engine cross-checked vs Python reference (1e-6)', url: 'https://github.com/rogerhabr/tokenomics' },
          { type: 'estimate', label: 'Origin Partners planning ranges', url: 'https://originpartners.io/blog' },
        ]}
      />

      {/* ── Dropdown wizard ─────────────────────────────────────────────── */}
      <div className="bg-sa-card rounded-xl border border-sa-border p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select label="1 · Geography" value={inputs.geographyId} onChange={v => applyPreset('geographyId', v)}
            options={GEOGRAPHIES.map(g => ({ value: g.id, label: g.label }))} />
          <Select label="2 · Power source" value={inputs.powerSourceId} onChange={v => applyPreset('powerSourceId', v)}
            options={POWER_SOURCES.map(p => ({ value: p.id, label: p.label }))} />
          <Select label="3 · Chip / rack" value={inputs.chipId} onChange={v => applyPreset('chipId', v)}
            options={CHIPS.map(c => ({ value: c.id, label: c.label }))} />
          <Select label="4 · Revenue model" value={inputs.revenueModelId} onChange={v => applyPreset('revenueModelId', v as RevenueModelId)}
            options={REVENUE_MODELS.map(r => ({ value: r.id, label: r.label }))} />
          <Select label="5 · Capital stack" value={inputs.capitalStackId} onChange={v => applyPreset('capitalStackId', v)}
            options={CAPITAL_STACKS.map(s => ({ value: s.id, label: s.label }))} />
          <Select label="6 · Credit support" value={inputs.creditSupportId} onChange={v => applyPreset('creditSupportId', v)}
            options={CREDIT_SUPPORTS.map(c => ({ value: c.id, label: c.label }))} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 items-end">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-sa-muted font-semibold">Case name</span>
            <input value={inputs.name} onChange={e => set('name')(e.target.value)} maxLength={120}
              className="mt-1 w-full text-sm bg-sa-surface border border-sa-border text-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-sa-accent" />
          </label>
          <Slider label="IT capacity (MW critical load)" value={inputs.itCapacityMW} min={5} max={500} step={5}
            onChange={set('itCapacityMW')} format={v => `${v} MW`} />
          <Select label="Exit method" value={inputs.exitMethod} onChange={v => set('exitMethod')(v as ExitMethod)}
            options={[
              { value: 'nbv', label: 'Net book value (conservative)' },
              { value: 'ebitdaMultiple', label: `${inputs.exitEbitdaMultiple}× trailing EBITDA` },
              { value: 'perMW', label: `${fmtUSD(inputs.exitPerMW)}/MW powered shell` },
            ]} />
        </div>
        <p className="text-xs text-sa-muted mt-3">
          {geo.label}: {geo.sourceNote} <span className="text-slate-500">(checked {geo.asOf})</span> · {pwr.sourceNote} · {chip.sourceNote}
        </p>
      </div>

      {/* ── Headline KPIs ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <MetricCard label="Equity IRR" value={fmtPct(out.equityIRRPct)} accent
          subtext={`target ${inputs.targetEquityIRRPct}% · ${inputs.horizonYears}-yr hold, ${inputs.exitMethod} exit`}
          change={out.equityIRRPct !== null ? (out.equityIRRPct >= inputs.targetEquityIRRPct ? 'meets target' : 'below target') : undefined}
          changePositive={out.equityIRRPct !== null && out.equityIRRPct >= inputs.targetEquityIRRPct} />
        <MetricCard label="Project IRR (unlevered)" value={fmtPct(out.projectIRRPct)} subtext={`NPV @ ${inputs.discountRatePct}%: ${fmtUSD(out.npv)}`} />
        <MetricCard label="Min / avg DSCR" value={`${fmtX(out.minDSCR)} / ${fmtX(out.avgDSCR)}`}
          subtext={out.minDSCR !== null && out.minDSCR < 1.3 ? 'below 1.30× lender floor' : '≥ 1.30× lender floor'}
          change={out.minDSCR !== null ? (out.minDSCR < 1.3 ? 'DSRA needed' : 'covered') : undefined} changePositive={out.minDSCR !== null && out.minDSCR >= 1.3} />
        <MetricCard label="Total capex" value={fmtUSD(out.capex.total)} subtext={`${fmtUSD(out.capexPerMW)}/MW IT · ${fmtUSD(out.capexPerGPU)}/GPU`} />
        <MetricCard label="Sponsor equity" value={fmtUSD(out.sourcesUses.totalEquity)} subtext={`${fmtPct(100 - debtPct, 0)} of sources · debt ${fmtUSD(out.sourcesUses.totalDebt)}`} />
        <MetricCard label="GPUs · COD" value={`${out.gpus.toLocaleString()} · M${out.codMonth}`} subtext={`${out.units} × ${chip.gpusPerUnit}-GPU units · ${out.facilityMW.toFixed(1)} MW at meter`} />
        <MetricCard label="Steady-state EBITDA" value={fmtUSD(out.steadyStateEBITDA)} subtext={`year-1 revenue ${fmtUSD(out.year1Revenue)}`} />
        <MetricCard
          label={inputs.revenueModelId === 'colocation' ? 'Breakeven $/kW-mo' : 'Breakeven $/GPU-hr'}
          value={out.breakevenPricePerGpuHr === null ? 'n/a' : inputs.revenueModelId === 'colocation' ? `$${out.breakevenPricePerGpuHr.toFixed(0)}` : `$${out.breakevenPricePerGpuHr.toFixed(2)}`}
          subtext={inputs.revenueModelId === 'neocloud' ? `vs blended $${blended.toFixed(2)} · energy $${out.energyCostPerGpuHr.toFixed(3)} · all-in $${out.allInCostPerGpuHr.toFixed(2)}`
            : out.equivalentTokenPricePerM !== null ? `≈ $${out.equivalentTokenPricePerM.toFixed(2)}/M tokens` : 'NPV = 0 at discount rate'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* ── Assumptions ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 bg-sa-card rounded-xl border border-sa-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Assumptions</h3>
            <button onClick={() => setInputs(buildInputs({ name: inputs.name, itCapacityMW: inputs.itCapacityMW }))}
              className="text-xs text-sa-muted hover:text-sa-accent transition-colors">Reset to presets</button>
          </div>

          <Group title="Sizing & schedule" open>
            <Slider label="PUE" value={inputs.pue} min={1.05} max={1.6} step={0.01} onChange={set('pue')} format={v => v.toFixed(2)} />
            <Slider label="Operating horizon (yrs)" value={inputs.horizonYears} min={5} max={15} step={1} onChange={set('horizonYears')} format={v => `${v} yr`} />
            <Slider label="Shell + MEP construction (mo)" value={inputs.constructionMonths} min={9} max={48} step={1} onChange={set('constructionMonths')} format={v => `${v} mo`} />
            <Slider label={isGrid ? 'Grid interconnect lead time (mo)' : 'Generation lead time (mo)'} value={inputs.powerLeadTimeMonths} min={0} max={84} step={1} onChange={set('powerLeadTimeMonths')} format={v => `${v} mo`} />
            <Slider label="Ramp to full utilisation (mo)" value={inputs.rampMonths} min={0} max={24} step={1} onChange={set('rampMonths')} format={v => `${v} mo`} />
          </Group>

          <Group title="Revenue">
            {inputs.revenueModelId !== 'colocation' && <Slider label="Sold utilisation (%)" value={inputs.utilizationPct} min={30} max={100} step={1} onChange={set('utilizationPct')} format={v => `${v}%`} />}
            {inputs.revenueModelId === 'neocloud' && <>
              <Slider label="Contracted share (%)" value={inputs.contractedSharePct} min={0} max={100} step={5} onChange={set('contractedSharePct')} format={v => `${v}%`} />
              <Slider label="Contracted $/GPU-hr" value={inputs.contractedPricePerGpuHr} min={0.5} max={20} step={0.05} onChange={set('contractedPricePerGpuHr')} format={v => `$${v.toFixed(2)}`} />
              <Slider label="On-demand $/GPU-hr" value={inputs.onDemandPricePerGpuHr} min={0.5} max={30} step={0.05} onChange={set('onDemandPricePerGpuHr')} format={v => `$${v.toFixed(2)}`} />
            </>}
            {inputs.revenueModelId === 'inference' && <>
              <Slider label="Blended $/M tokens" value={inputs.tokenPricePerM} min={0.05} max={10} step={0.05} onChange={set('tokenPricePerM')} format={v => `$${v.toFixed(2)}`} />
              <Slider label="Tokens/s per GPU" value={inputs.tokensPerGPUPerSec} min={50} max={5000} step={10} onChange={set('tokensPerGPUPerSec')} format={v => `${v}`} />
            </>}
            {inputs.revenueModelId === 'colocation' && <>
              <Slider label="Lease $/kW-month" value={inputs.colocationPerKWMonth} min={60} max={400} step={5} onChange={set('colocationPerKWMonth')} format={v => `$${v}`} />
              <Slider label="Occupancy (%)" value={inputs.colocationOccupancyPct} min={50} max={100} step={1} onChange={set('colocationOccupancyPct')} format={v => `${v}%`} />
            </>}
            <Slider label={inputs.revenueModelId === 'colocation' ? 'Lease escalator (−%/yr)' : 'Price decay with fleet age (%/yr)'} value={inputs.priceDeclinePctPerYear} min={-10} max={50} step={1} onChange={set('priceDeclinePctPerYear')} format={v => `${v}%`} />
          </Group>

          <Group title="Capex (per kW IT, before cost index)">
            <Slider label="Shell $/kW" value={inputs.shellPerKW} min={500} max={10000} step={100} onChange={set('shellPerKW')} format={v => `$${v.toLocaleString()}`} />
            <Slider label="MEP $/kW" value={inputs.mepPerKW} min={2000} max={20000} step={100} onChange={set('mepPerKW')} format={v => `$${v.toLocaleString()}`} />
            <Slider label="Liquid-cooling premium (%)" value={inputs.liquidCoolingPremiumPct} min={0} max={40} step={1} onChange={set('liquidCoolingPremiumPct')} format={v => `${v}%`} />
            <Slider label="Powered land $/MW" value={inputs.landPerMW} min={0} max={15e6} step={100000} onChange={set('landPerMW')} format={fmtUSD} />
            <Slider label="Construction cost index" value={inputs.constructionCostIndex} min={0.6} max={1.6} step={0.01} onChange={set('constructionCostIndex')} format={v => v.toFixed(2)} />
            <Slider label="Contingency (%)" value={inputs.contingencyPct} min={0} max={25} step={0.5} onChange={set('contingencyPct')} format={v => `${v}%`} />
            {inputs.revenueModelId !== 'colocation' && <>
              <Slider label={`Unit cost (${chip.gpusPerUnit} GPUs)`} value={inputs.unitCostUSD} min={100000} max={15e6} step={10000} onChange={set('unitCostUSD')} format={fmtUSD} />
              <Slider label="Network + storage (% of servers)" value={inputs.networkPctOfServer} min={0} max={40} step={1} onChange={set('networkPctOfServer')} format={v => `${v}%`} />
              <Slider label="GPU life / refresh cycle (yrs)" value={inputs.gpuDepreciationYears} min={2} max={6} step={0.5} onChange={set('gpuDepreciationYears')} format={v => `${v} yr`} />
              <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={inputs.gpuRefresh} onChange={e => set('gpuRefresh')(e.target.checked)} />Refresh fleet at end of life ({inputs.refreshCostPct}% of original)</label>
            </>}
          </Group>

          <Group title="Power & energy">
            <Slider label="Grid tariff $/kWh" value={inputs.tariffPerKWh} min={0.02} max={0.35} step={0.001} onChange={set('tariffPerKWh')} format={v => `$${v.toFixed(3)}`} />
            <Slider label="Capacity charge $/MW-day" value={inputs.capacityChargePerMWDay} min={0} max={1000} step={5} onChange={set('capacityChargePerMWDay')} format={v => `$${v.toFixed(0)}`} />
            {!isGrid && <>
              <Slider label="Delivered gas $/MMBtu" value={inputs.gasPricePerMMBtu} min={1} max={20} step={0.1} onChange={set('gasPricePerMMBtu')} format={v => `$${v.toFixed(2)}`} />
              <Slider label="Generation capex $/kW" value={inputs.genCapexPerKW} min={800} max={3000} step={25} onChange={set('genCapexPerKW')} format={v => `$${v.toLocaleString()}`} />
              <Slider label="Heat rate Btu/kWh (HHV)" value={inputs.heatRateBtuPerKWh} min={6000} max={11000} step={50} onChange={set('heatRateBtuPerKWh')} format={v => `${v.toLocaleString()}`} />
              <Slider label="Redundancy (nameplate ÷ peak)" value={inputs.redundancyFactor} min={1} max={1.5} step={0.01} onChange={set('redundancyFactor')} format={v => `${v.toFixed(2)}×`} />
              {pwr.kind === 'bridge' && <Slider label="Months on BTM before grid" value={inputs.bridgeMonthsToGrid} min={12} max={96} step={6} onChange={set('bridgeMonthsToGrid')} format={v => `${v} mo`} />}
            </>}
            <Slider label="Idle IT load (% of peak)" value={inputs.idleLoadPct} min={10} max={60} step={1} onChange={set('idleLoadPct')} format={v => `${v}%`} />
          </Group>

          <Group title="Opex & tax">
            <Slider label="Staffing (FTE per MW IT)" value={inputs.fteDensityPerMW} min={0.1} max={4} step={0.1} onChange={set('fteDensityPerMW')} format={v => v.toFixed(1)} />
            <Slider label="Labour $/FTE/yr" value={inputs.laborCostPerFTE} min={20000} max={250000} step={5000} onChange={set('laborCostPerFTE')} format={fmtUSD} />
            <Slider label="Maintenance (% capex/yr)" value={inputs.maintenancePctOfCapex} min={0} max={5} step={0.1} onChange={set('maintenancePctOfCapex')} format={v => `${v.toFixed(1)}%`} />
            <Slider label="SG&A (% revenue)" value={inputs.sgaPctOfRevenue} min={0} max={25} step={0.5} onChange={set('sgaPctOfRevenue')} format={v => `${v}%`} />
            <Slider label="Corporate tax (%)" value={inputs.corporateTaxPct} min={0} max={40} step={0.5} onChange={set('corporateTaxPct')} format={v => `${v}%`} />
            <Slider label="Property tax (% infra capex)" value={inputs.propertyTaxPctOfCapex} min={0} max={4} step={0.1} onChange={set('propertyTaxPctOfCapex')} format={v => `${v.toFixed(1)}%`} />
          </Group>

          <Group title="Capital structure">
            {inputs.tranches.length === 0 && <p className="text-xs text-sa-muted">All-equity. Pick a capital stack above to add debt.</p>}
            {inputs.tranches.map((t, i) => (
              <div key={t.id} className="rounded-lg border border-sa-border/60 p-2.5 space-y-2">
                <p className="text-xs font-semibold text-slate-300">{t.label} <span className="text-sa-muted font-normal">· on {t.basis}</span></p>
                <Slider label="Loan-to-cost (%)" value={t.ltcPct} min={0} max={90} step={1} onChange={v => setTranche(i, 'ltcPct', v)} format={v => `${v}%`} />
                <Slider label="All-in rate (%)" value={t.ratePct} min={3} max={20} step={0.25} onChange={v => setTranche(i, 'ratePct', v)} format={v => `${v.toFixed(2)}%`} />
                <Slider label="Tenor (yrs)" value={t.tenorYears} min={1} max={20} step={1} onChange={v => setTranche(i, 'tenorYears', v)} format={v => `${v} yr`} />
              </div>
            ))}
            <Slider label="Interest-only grace after COD (mo)" value={inputs.gracePeriodMonths} min={0} max={24} step={1} onChange={set('gracePeriodMonths')} format={v => `${v} mo`} />
            <Slider label="Target equity IRR (%)" value={inputs.targetEquityIRRPct} min={8} max={40} step={1} onChange={set('targetEquityIRRPct')} format={v => `${v}%`} />
            <Slider label="Discount rate for NPV (%)" value={inputs.discountRatePct} min={5} max={20} step={0.5} onChange={set('discountRatePct')} format={v => `${v}%`} />
            {inputs.exitMethod === 'ebitdaMultiple' && <Slider label="Exit EBITDA multiple" value={inputs.exitEbitdaMultiple} min={2} max={15} step={0.5} onChange={set('exitEbitdaMultiple')} format={v => `${v}×`} />}
            {inputs.exitMethod === 'perMW' && <Slider label="Exit $/MW IT" value={inputs.exitPerMW} min={2e6} max={20e6} step={250000} onChange={set('exitPerMW')} format={fmtUSD} />}
          </Group>

          <Group title="Credit support (trigger · amount · duration · claim)">
            <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={inputs.creditSupport.coversPowerDelay} onChange={e => setCS('coversPowerDelay', e.target.checked)} />Covers power / COD delay</label>
            <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={inputs.creditSupport.coversCostOverrun} onChange={e => setCS('coversCostOverrun', e.target.checked)} />Covers construction overrun</label>
            <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={inputs.creditSupport.coversOfftakerDefault} onChange={e => setCS('coversOfftakerDefault', e.target.checked)} />Covers off-taker non-payment</label>
            <Slider label="Amount (% of debt)" value={inputs.creditSupport.amountPctOfDebt} min={0} max={100} step={5} onChange={v => setCS('amountPctOfDebt', v)} format={v => `${v}%`} />
            <Slider label="Duration after planned COD (mo)" value={inputs.creditSupport.durationMonthsPostCOD} min={0} max={120} step={6} onChange={v => setCS('durationMonthsPostCOD', v)} format={v => `${v} mo`} />
            <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={inputs.creditSupport.directDraw} onChange={e => setCS('directDraw', e.target.checked)} />Lender can draw directly</label>
            {!inputs.creditSupport.directDraw && <Slider label="Recovery lag if pursuing projco (mo)" value={inputs.creditSupport.recoveryLagMonths} min={0} max={24} step={1} onChange={v => setCS('recoveryLagMonths', v)} format={v => `${v} mo`} />}
          </Group>

          <Group title="Stress cases">
            <Slider label="COD delay (mo)" value={inputs.stress.codDelayMonths} min={0} max={36} step={1} onChange={v => setStress('codDelayMonths', v)} format={v => `${v} mo`} />
            <Slider label="Capex overrun (%)" value={inputs.stress.capexOverrunPct} min={0} max={60} step={1} onChange={v => setStress('capexOverrunPct', v)} format={v => `${v}%`} />
            <Slider label="Non-payment starts (mo after COD)" value={inputs.stress.offtakerNonPayStartMonth} min={0} max={60} step={1} onChange={v => setStress('offtakerNonPayStartMonth', v)} format={v => `${v} mo`} />
            <Slider label="Non-payment length (mo)" value={inputs.stress.offtakerNonPayMonths} min={0} max={24} step={1} onChange={v => setStress('offtakerNonPayMonths', v)} format={v => `${v} mo`} />
            <Slider label="Price shock from year 2 (%)" value={inputs.stress.priceShockPct} min={-70} max={30} step={5} onChange={v => setStress('priceShockPct', v)} format={v => `${v}%`} />
          </Group>
        </div>

        {/* ── Results ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-sa-card rounded-xl border border-sa-border p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Annual cash flows ($M, years from financial close)</h3>
            <p className="text-xs text-sa-muted mb-3">Revenue vs cash opex and debt service; levered cash flow to equity includes capex draws, GPU refresh and exit value in the final year.</p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={annualChart} barGap={2} barCategoryGap="20%">
                <CartesianGrid stroke="#1e2a42" vertical={false} />
                <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}`} width={48} />
                <Tooltip contentStyle={{ background: '#0f1623', border: '1px solid #1e2a42', fontSize: 12 }} formatter={(v: number) => [`$${v.toFixed(1)}M`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Revenue" fill={C.revenue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Cash opex" fill={C.opex} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Debt service" fill={C.debt} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Levered CF" stroke={C.cf} strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-sa-card rounded-xl border border-sa-border p-4">
              <h3 className="text-sm font-semibold text-white mb-1">DSCR by year</h3>
              <p className="text-xs text-sa-muted mb-3">Cash flow available for debt service ÷ interest + principal. Lender floor 1.30×.</p>
              {dscrChart.length ? (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart data={dscrChart}>
                    <CartesianGrid stroke="#1e2a42" vertical={false} />
                    <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={36} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ background: '#0f1623', border: '1px solid #1e2a42', fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)}×`, 'DSCR']} />
                    <ReferenceLine y={1.3} stroke="#64748b" strokeDasharray="4 4" label={{ value: '1.30×', fill: '#64748b', fontSize: 10, position: 'right' }} />
                    <Line type="monotone" dataKey="DSCR" stroke={C.revenue} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-xs text-sa-muted py-8 text-center">No debt in this structure.</p>}
            </div>

            <DataTable
              title="Sources & uses at COD"
              compact
              columns={[
                { key: 'label', label: 'Item' },
                { key: 'amount', label: 'Amount', align: 'right', format: v => fmtUSD(v as number) },
                { key: 'pct', label: '%', align: 'right', format: v => `${(v as number).toFixed(1)}%` },
              ]}
              data={[
                ...out.sourcesUses.sources.map(s => ({ label: `↑ ${s.label}`, amount: s.amount, pct: s.pct })),
                ...(['land', 'shell', 'mep', 'utilityWorks', 'generation', 'servers', 'network', 'contingency', 'idc'] as const)
                  .filter(k => out.capex[k] > 0)
                  .map(k => ({ label: `↓ ${{ land: 'Land', shell: 'Shell', mep: 'MEP', utilityWorks: 'Utility works', generation: 'On-site generation', servers: 'Servers (GPUs)', network: 'Network + storage', contingency: 'Contingency', idc: 'Capitalised interest' }[k]}`, amount: out.capex[k], pct: out.capex[k] / out.capex.total * 100 })),
              ]}
            />
          </div>

          {/* ── Lender's four questions ───────────────────────────────── */}
          <div className="bg-sa-card rounded-xl border border-sa-border p-4">
            <h3 className="text-sm font-semibold text-white mb-1">Credit support — the lender&apos;s four questions</h3>
            <p className="text-xs text-sa-muted mb-3">
              &ldquo;Who takes the loss if the project is late or the cash flow does not arrive as planned?&rdquo; Structure: <span className="text-slate-300">{cs.label}</span>. {cs.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 text-xs">
              <div className="rounded-lg border border-sa-border/60 p-3"><p className="text-sa-muted uppercase tracking-wider text-[10px] mb-1">Trigger</p>
                <p className="text-slate-300">Power delay {q(inputs.creditSupport.coversPowerDelay)} · Overrun {q(inputs.creditSupport.coversCostOverrun)} · Off-taker {q(inputs.creditSupport.coversOfftakerDefault)}</p></div>
              <div className="rounded-lg border border-sa-border/60 p-3"><p className="text-sa-muted uppercase tracking-wider text-[10px] mb-1">Amount</p>
                <p className="text-slate-300 number-cell">{fmtUSD(out.sourcesUses.totalDebt * inputs.creditSupport.amountPctOfDebt / 100)} <span className="text-sa-muted">({inputs.creditSupport.amountPctOfDebt}% of debt)</span></p>
                <p className="text-sa-muted mt-1">largest shortfall {fmtUSD(Math.max(...out.stresses.map(s => s.shortfallTotal)))}</p></div>
              <div className="rounded-lg border border-sa-border/60 p-3"><p className="text-sa-muted uppercase tracking-wider text-[10px] mb-1">Duration</p>
                <p className="text-slate-300">Expires {inputs.creditSupport.durationMonthsPostCOD} mo after planned COD</p>
                <p className="text-sa-muted mt-1">ramp {inputs.rampMonths} mo · senior tenor {inputs.tranches[0]?.tenorYears ?? 0} yr</p></div>
              <div className="rounded-lg border border-sa-border/60 p-3"><p className="text-sa-muted uppercase tracking-wider text-[10px] mb-1">Claim</p>
                <p className="text-slate-300">{inputs.creditSupport.directDraw ? 'Direct draw by lender' : `Pursue projco first · ${inputs.creditSupport.recoveryLagMonths}-mo lag`}</p></div>
            </div>
            <DataTable
              compact
              columns={[
                { key: 'label', label: 'Case' },
                { key: 'equityIRRPct', label: 'Equity IRR', align: 'right', format: v => fmtPct(v as number | null) },
                { key: 'minDSCR', label: 'Min DSCR', align: 'right', format: v => fmtX(v as number | null) },
                { key: 'shortfallTotal', label: 'Shortfall', align: 'right', format: v => fmtUSD(v as number) },
                { key: 'supportCapped', label: 'Support pays', align: 'right', format: (v, row) => row.supportCovers ? fmtUSD(v as number) : '—' },
                { key: 'uncovered', label: 'Sponsor cure', align: 'right', highlight: true, format: v => fmtUSD(v as number) },
                { key: 'lagExposure', label: 'Claim-lag exposure', align: 'right', format: v => fmtUSD(v as number) },
              ]}
              data={out.stresses as unknown as Record<string, unknown>[]}
            />
            <p className="text-xs text-sa-muted mt-2">Shortfall = debt service not covered by cash flow (cash interest during a delay, ramp months below 1.0×, non-payment months) plus any construction overrun. {cs.sourceNote}</p>
          </div>

          {/* ── Save / export ─────────────────────────────────────────── */}
          <div className="bg-sa-card rounded-xl border border-sa-border p-4 flex flex-wrap items-center gap-3">
            <button onClick={() => download(`${slug}-business-plan.md`, generateBusinessPlan(inputs, out, new Date().toISOString().slice(0, 10)))}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-sa-accent text-white hover:bg-sa-accent-hover transition-colors">Download business plan (.md)</button>
            <button onClick={() => download(`${slug}-inputs.json`, JSON.stringify(inputs, null, 2), 'application/json')}
              className="text-xs font-semibold px-3 py-2 rounded-lg border border-sa-border text-slate-300 hover:border-sa-accent transition-colors">Export inputs (.json)</button>
            <div className="flex-1" />
            {authed === false && <span className="text-xs text-sa-muted">Sign in to save cases to your account.</span>}
            {authed && <>
              <select value={currentId ?? ''} onChange={e => load(e.target.value)}
                className="text-xs bg-sa-surface border border-sa-border text-slate-300 rounded px-2 py-1.5 focus:outline-none focus:border-sa-accent">
                <option value="">— saved cases ({saved.length}) —</option>
                {saved.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={save} disabled={saving} className="text-xs font-semibold px-3 py-1.5 rounded border border-sa-border text-slate-300 hover:border-sa-accent disabled:opacity-50">{currentId ? 'Update' : 'Save'}</button>
              {currentId && <button onClick={remove} className="text-xs px-3 py-1.5 rounded border border-sa-border text-sa-red hover:border-sa-red">Delete</button>}
            </>}
            {msg && <span className="text-xs text-sa-muted">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
