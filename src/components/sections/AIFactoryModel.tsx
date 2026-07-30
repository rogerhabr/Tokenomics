'use client';

/**
 * AI Factory Model — interactive port of AI_Factory_Model.xlsx.
 * Light-canvas design: white background, colored rubric headers, mono numerals.
 * Live pipeline: applies GPU rental & token retail pricing from
 * public/live-data.json (already refreshed by scripts/fetch-live-data.mjs).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import SectionHeader from '../SectionHeader';
import { useLiveData } from '@/hooks/useLiveData';
import {
  AIFactoryInputs, DEBT_RATIOS, DEFAULT_INPUTS, LOCATION_LIBRARY,
  RACK_LIBRARY, TARIFFS, computeModel, locationByName, rackByName,
} from '@/lib/aiFactory';

const STORAGE_KEY = 'ai-factory-app-v1';

// Rubric palette (white-canvas design system)
const RUBRICS = {
  architecture: { label: 'ARCHITECTURE', color: '#1F4E78' },
  site: { label: 'SITE & CLIMATE', color: '#0E7490' },
  thermal: { label: 'THERMAL & POWER', color: '#5B21B6' },
  finance: { label: 'FINANCE', color: '#166534' },
  revenue: { label: 'REVENUE & TOKENOMICS', color: '#C2410C' },
  expansion: { label: 'CAMPUS EXPANSION', color: '#0F766E' },
} as const;

const usd = (n: number, dp = 0) =>
  (n < 0 ? '-$' : '$') +
  Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: dp });
const usdM = (n: number, dp = 1) =>
  (n < 0 ? '-$' : '$') + Math.abs(n / 1e6).toFixed(dp) + 'M';
const usdB = (n: number, dp = 2) =>
  (n < 0 ? '-$' : '$') + Math.abs(n / 1e9).toFixed(dp) + 'B';
const pct = (n: number, dp = 1) => (n * 100).toFixed(dp) + '%';
const num = (n: number, dp = 0) =>
  n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: dp });

interface FieldSpec {
  key: keyof AIFactoryInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  step?: number;
  pct?: boolean;   // stored as fraction, edited as %
  hint: string;    // precise prompting: what the input means + sane range
}

function Rubric({ id, children }: { id: keyof typeof RUBRICS; children?: React.ReactNode }) {
  const r = RUBRICS[id];
  return (
    <div className="flex items-center justify-between rounded-t-lg px-3 py-1.5"
         style={{ background: r.color }}>
      <span className="text-[11px] font-bold tracking-widest text-white">{r.label}</span>
      {children}
    </div>
  );
}

export default function AIFactoryModel() {
  const [inputs, setInputs] = useState<AIFactoryInputs>(DEFAULT_INPUTS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { liveData: live, severity } = useLiveData();
  const [benchGpu, setBenchGpu] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setInputs({ ...DEFAULT_INPUTS, ...JSON.parse(raw) });
    } catch { /* corrupted storage -> defaults */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch { /* ignore */ }
  }, [inputs]);

  const r = useMemo(() => computeModel(inputs), [inputs]);
  const vr = rackByName(inputs.vrType);
  const loc = locationByName(inputs.location);

  const set = (key: keyof AIFactoryInputs, value: unknown) =>
    setInputs((s) => ({ ...s, [key]: value }));

  const setNum = (f: FieldSpec, raw: string) => {
    const v = parseFloat(raw);
    const scaled = f.pct ? v / 100 : v;
    if (raw === '' || Number.isNaN(v)) {
      setErrors((e) => ({ ...e, [f.key]: 'Enter a number' }));
      return;
    }
    const lo = f.pct ? f.min / 100 : f.min;
    const hi = f.pct ? f.max / 100 : f.max;
    if (scaled < lo || scaled > hi) {
      setErrors((e) => ({
        ...e,
        [f.key]: `Must be ${f.min}–${f.max}${f.pct ? '%' : ` ${f.unit}`}`,
      }));
      return;
    }
    setErrors((e) => { const { [f.key]: _drop, ...rest } = e; return rest; });
    set(f.key, scaled);
  };

  // ---- live-market pipeline (public data already fetched by the app) ----
  // gpuRentalPrices is the live matrix refreshed by scripts/fetch-live-data.mjs
  // (Lambda + Azure retail APIs); gpuCloud is a legacy H100-only field.
  const gpuRentals = useMemo(() => {
    const out: { gpu: string; rate: number; sources: string }[] = [];
    for (const [gpu, v] of Object.entries(live?.gpuRentalPrices ?? {})) {
      if (gpu.startsWith('_') || Array.isArray(v) || typeof v !== 'object') continue;
      const rate = v.lowestPerHour;
      if (typeof rate === 'number' && rate > 0) {
        out.push({ gpu, rate, sources: (v.sources ?? []).join(', ') });
      }
    }
    const legacy = [live?.gpuCloud?.lambdaH100PerHour, live?.gpuCloud?.azureH100PerHour]
      .filter((x): x is number => typeof x === 'number' && x > 0);
    if (legacy.length && !out.some((o) => o.gpu === 'H100')) {
      out.push({ gpu: 'H100', rate: Math.min(...legacy), sources: 'Lambda/Azure' });
    }
    return out.sort((a, b) => a.gpu.localeCompare(b.gpu));
  }, [live]);

  const selectedRental = useMemo(
    () => gpuRentals.find((g) => g.gpu === benchGpu) ?? gpuRentals[0] ?? null,
    [gpuRentals, benchGpu],
  );
  const liveGpuHr = selectedRental?.rate ?? null;
  const liveTokenMedian = useMemo(() => {
    const blended = Object.values(live?.modelPricing ?? {})
      .map((mdl) => (mdl.inputPerM + mdl.outputPerM) / 2)
      .filter((x) => x > 0)
      .sort((a, b) => a - b);
    if (!blended.length) return null;
    const mid = Math.floor(blended.length / 2);
    return blended.length % 2 ? blended[mid] : (blended[mid - 1] + blended[mid]) / 2;
  }, [live]);

  const NumField = (f: FieldSpec) => {
    const value = inputs[f.key] as number;
    const shown = f.pct ? +(value * 100).toFixed(4) : value;
    return (
      <label className="block">
        <span className="text-[11px] font-semibold text-gray-600">{f.label}</span>
        <span className="flex items-center gap-1.5">
          <input
            type="number"
            defaultValue={shown}
            key={`${String(f.key)}:${shown}`}
            min={f.min} max={f.max} step={f.step ?? 'any'}
            onBlur={(e) => setNum(f, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setNum(f, (e.target as HTMLInputElement).value)}
            className={`w-full rounded border px-2 py-1 font-mono text-[13px] text-gray-900 bg-white
              ${errors[f.key] ? 'border-red-500' : 'border-gray-300'} focus:border-blue-600 focus:outline-none`}
            aria-label={f.label}
          />
          <span className="whitespace-nowrap text-[11px] text-gray-500">{f.pct ? '%' : f.unit}</span>
        </span>
        <span className={`block text-[10px] ${errors[f.key] ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
          {errors[f.key] ?? f.hint}
        </span>
      </label>
    );
  };

  const Select = ({ label, value, options, onChange, detail }: {
    label: string; value: string; options: string[];
    onChange: (v: string) => void; detail?: string;
  }) => (
    <label className="block">
      <span className="text-[11px] font-semibold text-gray-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-[13px] text-gray-900 focus:border-blue-600 focus:outline-none"
        aria-label={label}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {detail && <span className="block text-[10px] text-gray-400">{detail}</span>}
    </label>
  );

  const Tile = ({ label, value, sub, bad }: {
    label: string; value: string; sub?: string; bad?: boolean;
  }) => (
    <div className={`rounded-lg border bg-white p-3 ${bad ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`font-mono text-lg font-bold ${bad ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
    </div>
  );

  const fcfeChart = r.fcfe.map((v, i) => ({ year: `Y${i}`, fcfe: +(v / 1e6).toFixed(2) }));
  const fundChart = r.expansion.cumFunding.map((v, i) => ({
    year: `Y${i + 1}`, funding: +(v / 1e9).toFixed(3),
  }));
  const irrMax = Math.max(...r.sensitivity.map((c) => c.irr).filter((x) => !Number.isNaN(x)), 0.0001);

  return (
    <div className="space-y-4">
      <SectionHeader
        title="AI Factory Model"
        subtitle={`${inputs.vrCount}x ${inputs.vrType} · ${inputs.location} (zone ${r.zone}) — live port of AI_Factory_Model.xlsx; every output recalculates as you type`}
      />

      {/* Light canvas */}
      <div className="rounded-xl bg-white p-4 text-gray-900 shadow-lg space-y-4">

        {/* Live market pipeline */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span className="text-[11px] font-bold tracking-wide text-gray-600">LIVE MARKET DATA</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold
            ${severity === 'fresh' ? 'bg-green-100 text-green-700'
              : severity === 'aging' ? 'bg-amber-100 text-amber-700'
              : 'bg-gray-200 text-gray-500'}`}>
            {severity}
          </span>
          {gpuRentals.length > 0 ? (
            <select
              value={selectedRental?.gpu ?? ''}
              onChange={(e) => setBenchGpu(e.target.value)}
              className="rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[11px] text-gray-800"
              aria-label="Live GPU rental benchmark"
            >
              {gpuRentals.map((g) => (
                <option key={g.gpu} value={g.gpu}>
                  {g.gpu}: ${g.rate.toFixed(2)}/hr ({g.sources})
                </option>
              ))}
            </select>
          ) : (
            <span className="font-mono text-[11px] text-gray-500">GPU rentals: n/a</span>
          )}
          <span className="font-mono text-[11px] text-gray-600">
            token retail median: {liveTokenMedian ? `$${liveTokenMedian.toFixed(2)}/M` : 'n/a'}
          </span>
          <button
            disabled={!liveGpuHr}
            onClick={() => liveGpuHr && set('leasePerGpuHr', +liveGpuHr.toFixed(2))}
            className="rounded bg-[#166534] px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            Use as lease price
          </button>
          <button
            disabled={!liveTokenMedian}
            onClick={() => liveTokenMedian && set('tokenPricePerM', +liveTokenMedian.toFixed(2))}
            className="rounded bg-[#C2410C] px-2 py-0.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            Use live token price
          </button>
          <span className="text-[10px] text-gray-400">
            Rental rates are published list prices and may be per-instance, not per-GPU — verify
            before applying. Token median is retail; realized wholesale pricing is lower.
          </span>
          <button
            onClick={() => { setInputs(DEFAULT_INPUTS); setErrors({}); }}
            className="ml-auto rounded border border-gray-300 px-2 py-0.5 text-[10px] font-semibold text-gray-600 hover:bg-gray-100"
          >
            Reset defaults
          </button>
        </div>

        {/* Inputs: colored rubric groups */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200">
            <Rubric id="architecture" />
            <div className="space-y-2 p-3">
              <Select label="Compute rack type" value={inputs.vrType}
                options={RACK_LIBRARY.filter((x) => x.cls === 'Compute').map((x) => x.name)}
                onChange={(v) => set('vrType', v)}
                detail={`${vr.kw} kW · ${vr.gpus} GPUs @ ${vr.tdpW} W · ${vr.cooling} · $${vr.priceM}M/rack`} />
              {NumField({ key: 'vrCount', label: 'Compute racks', unit: 'racks', min: 1, max: 10000, step: 1, hint: 'Any whole number ≥ 1' })}
              <Select label="Network rack type" value={inputs.netType}
                options={RACK_LIBRARY.filter((x) => x.cls === 'Network').map((x) => x.name)}
                onChange={(v) => set('netType', v)} />
              {NumField({ key: 'netCount', label: 'Network racks', unit: 'racks', min: 0, max: 10000, step: 1, hint: 'Scale-out fabric racks' })}
              <Select label="Storage rack type" value={inputs.stoType}
                options={RACK_LIBRARY.filter((x) => x.cls === 'Storage').map((x) => x.name)}
                onChange={(v) => set('stoType', v)} />
              {NumField({ key: 'stoCount', label: 'Storage racks', unit: 'racks', min: 0, max: 10000, step: 1, hint: 'NVMe / object storage racks' })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200">
              <Rubric id="site" />
              <div className="space-y-2 p-3">
                <Select label="Location (ASHRAE library)" value={inputs.location}
                  options={LOCATION_LIBRARY.map((l) => l.name)}
                  onChange={(v) => set('location', v)}
                  detail={`Zone ${loc.zone} · 90.4 MLC limit ${loc.mlcLimit.toFixed(3)} · N=20yr ${loc.db20.toFixed(1)}°C DB / ${loc.wb20.toFixed(1)}°C WB`} />
                {NumField({ key: 'tariff', label: 'Power tariff', unit: '$/kWh', min: 0.01, max: 1, step: 0.005, hint: 'Industrial rate, Year 1 ($0.01–1.00)' })}
                {NumField({ key: 'utilization', label: 'Cluster utilization', unit: '', min: 10, max: 100, pct: true, hint: 'Sold/served share of capacity (10–100%)' })}
                {NumField({ key: 'pue', label: 'Annualized PUE', unit: '', min: 1.0, max: 2.0, step: 0.01, hint: 'Facility/IT energy ratio (1.00–2.00)' })}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200">
              <Rubric id="thermal" />
              <div className="grid grid-cols-2 gap-2 p-3">
                {NumField({ key: 'fws', label: 'Supply temp (FWS)', unit: '°C', min: 15, max: 55, hint: 'Facility water supply' })}
                {NumField({ key: 'fwr', label: 'Return temp (FWR)', unit: '°C', min: 20, max: 70, hint: 'Must exceed FWS' })}
                {NumField({ key: 'liqOverhead', label: 'Liquid cooling overhead', unit: '', min: 1, max: 30, pct: true, hint: 'kW cooling per kW liquid IT' })}
                {NumField({ key: 'airOverhead', label: 'Air cooling overhead', unit: '', min: 5, max: 60, pct: true, hint: 'kW cooling per kW air IT' })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200">
              <Rubric id="finance" />
              <div className="grid grid-cols-2 gap-2 p-3">
                {NumField({ key: 'facilityCapexPerMW', label: 'Facility CapEx', unit: '$/MW', min: 1e6, max: 3e7, step: 1e5, hint: 'Benchmark $9.9–12.2M/MW' })}
                {NumField({ key: 'debtRatio', label: 'Debt ratio', unit: '', min: 0, max: 90, pct: true, hint: 'Senior debt share (0–90%)' })}
                {NumField({ key: 'interestRate', label: 'Interest rate', unit: '', min: 1, max: 20, pct: true, hint: 'Senior facility rate' })}
                {NumField({ key: 'hurdleRate', label: 'Equity hurdle', unit: '', min: 5, max: 30, pct: true, hint: 'NPV discount rate' })}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200">
              <Rubric id="revenue" />
              <div className="grid grid-cols-2 gap-2 p-3">
                {NumField({ key: 'leasePerGpuHr', label: 'Lease price', unit: '$/GPU-hr', min: 0.1, max: 50, step: 0.01, hint: 'Market GB200-class: $8–11' })}
                {NumField({ key: 'tokenPricePerM', label: 'Token price', unit: '$/M tok', min: 0.01, max: 50, step: 0.01, hint: 'Realized blended $/M tokens' })}
                {NumField({ key: 'tokenFleetShare', label: 'Token fleet share', unit: '', min: 0, max: 100, pct: true, hint: 'Fleet serving the API market' })}
                {NumField({ key: 'tokenDecline', label: 'Token price decline', unit: '', min: 0, max: 60, pct: true, hint: 'Annual $/token deflation' })}
              </div>
            </div>
          </div>
        </div>

        {/* Compliance banner */}
        <div className={`rounded-lg px-3 py-2 text-[12px] font-semibold
          ${r.mlc <= r.mlcLimit ? 'bg-green-50 text-green-800 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-300'}`}>
          ASHRAE 90.4 — peak MLC {r.mlc.toFixed(3)} vs zone {r.zone} limit {r.mlcLimit.toFixed(3)}
          {' '}({pct(r.mlcMargin)} margin) · N=20yr {r.db20.toFixed(1)}°C DB · rejection approach +{r.approach.toFixed(1)} K
          {r.approach <= 0 && ' — WARNING: FWR below peak dry-bulb; dry rejection fails at peak'}
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
          <Tile label="IT load" value={`${(r.itKw / 1000).toFixed(3)} MW`} sub={`${num(r.gpus)} GPUs · ${num(r.liquidKw)} kW liquid`} />
          <Tile label="S45 flow" value={`${num(r.flowTotal)} LPM`} sub={`${num(r.flowPerRack, 1)} LPM per compute rack`} />
          <Tile label="CapEx" value={usdM(r.capex)} sub={`${usd(r.capexPerGpu)} per GPU`} />
          <Tile label="Year-1 EBITDA" value={usdM(r.ebitda[0])} sub={`revenue ${usdM(r.rev[0])}`} />
          <Tile label="Equity IRR" value={r.equityIrr === null ? 'n/a' : pct(r.equityIrr)}
                bad={(r.equityIrr ?? -1) < inputs.hurdleRate}
                sub={`unlevered ${r.projectIrr === null ? 'n/a' : pct(r.projectIrr)}`} />
          <Tile label="Min DSCR" value={`${r.minDscr.toFixed(2)}x`} bad={r.minDscr < 1}
                sub={r.minDscr < 1 ? 'debt service not covered' : `avg ${r.avgDscr.toFixed(2)}x`} />
          <Tile label="NPV @ hurdle" value={usdM(r.npv)} bad={r.npv < 0} />
          <Tile label="Payback" value={r.payback === null ? `>${inputs.horizon} yrs` : `${r.payback.toFixed(2)} yrs`}
                bad={r.payback === null} />
          <Tile label="Energy" value={`${num(r.energyMwh)} MWh/yr`} sub={`${pct(r.energyPctRev)} of revenue`} />
          <Tile label="Carbon / water" value={`${num(r.co2T)} t`} sub={`${num(r.waterM3)} m³ water`} />
          <Tile label="Cost / M tokens" value={`$${r.costPerMTok.toFixed(2)}`} sub={`capacity ${r.tokCapT.toFixed(1)}T tok/yr`} />
          <Tile label="Breakeven tariff" value={`$${r.breakevenTariff.toFixed(2)}/kWh`} sub={`vs $${inputs.tariff.toFixed(2)} input`} />
        </div>

        {/* Charts */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-1 text-[11px] font-bold text-gray-600">Leveraged FCFE by year ($M)</div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={fcfeChart}>
                <CartesianGrid stroke="#EEF1F5" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} width={52} />
                <Tooltip formatter={(v: number) => [`$${v}M`, 'FCFE']} />
                <ReferenceLine y={0} stroke="#9CA3AF" />
                <Bar dataKey="fcfe" fill="#1F4E78" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <div className="mb-1 text-[11px] font-bold text-gray-600">
              Campus expansion — cumulative funding ($B) · {r.expansion.cumBlocks.at(-1)} blocks → {num(r.expansion.finalMW, 1)} MW, peak {usdB(r.expansion.peakFunding)}
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={fundChart}>
                <CartesianGrid stroke="#EEF1F5" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} width={52} />
                <Tooltip formatter={(v: number) => [`$${v}B`, 'Cum. funding']} />
                <ReferenceLine y={0} stroke="#9CA3AF" />
                <Line dataKey="funding" stroke="#C2410C" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sensitivity heatmap */}
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 text-[11px] font-bold text-gray-600">
            Equity IRR — power tariff × debt ratio (red = below hurdle {pct(inputs.hurdleRate, 0)}; DSCR in small print)
          </div>
          <div className="grid gap-1" style={{ gridTemplateColumns: `90px repeat(${DEBT_RATIOS.length}, 1fr)` }}>
            <div />
            {DEBT_RATIOS.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-gray-500">{pct(d, 0)} debt</div>
            ))}
            {TARIFFS.map((tf) => (
              <FragmentRow key={tf} tf={tf} cells={r.sensitivity.filter((c) => c.tariff === tf)}
                irrMax={irrMax} hurdle={inputs.hurdleRate} />
            ))}
          </div>
        </div>

        <p className="text-[10px] text-gray-400">
          Engine is a verified port of AI_Factory_Model.xlsx (cross-checked by scripts/test-ai-factory-parity.mjs).
          Rack powers for GB200/GB300 are vendor figures; Vera Rubin, Kyber, network and storage racks carry
          estimates — edit the assumptions rather than trusting them. Live prices are public retail feeds:
          H100 rental is a proxy for GPU-class leases and token medians are retail, not realized.
        </p>
      </div>
    </div>
  );
}

function FragmentRow({ tf, cells, irrMax, hurdle }: {
  tf: number;
  cells: { debtRatio: number; irr: number; avgDscr: number }[];
  irrMax: number;
  hurdle: number;
}) {
  return (
    <>
      <div className="flex items-center font-mono text-[11px] text-gray-600">${tf.toFixed(2)}/kWh</div>
      {cells.map((c) => {
        const frac = Math.max(0, Math.min(1, c.irr / irrMax));
        const below = Number.isNaN(c.irr) || c.irr < hurdle;
        return (
          <div key={c.debtRatio}
               className="rounded px-1 py-1.5 text-center"
               style={{ background: `rgba(31,78,120,${0.06 + 0.5 * frac})` }}>
            <div className={`font-mono text-[12px] font-bold ${below ? 'text-red-600' : 'text-gray-900'}`}>
              {Number.isNaN(c.irr) ? 'n/a' : (c.irr * 100).toFixed(1) + '%'}
            </div>
            <div className={`font-mono text-[9px] ${c.avgDscr < 1 ? 'text-red-500' : 'text-gray-500'}`}>
              {c.avgDscr.toFixed(2)}x
            </div>
          </div>
        );
      })}
    </>
  );
}
