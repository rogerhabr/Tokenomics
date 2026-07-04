'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import SectionHeader from '../SectionHeader';
import MetricCard from '../MetricCard';
import {
  defaultDataCenterCostInputs, calcDataCenterCost, DC_COST_LABELS,
  type DataCenterCostInputs,
} from '@/lib/data';

const OPEX_COLORS: Record<string, string> = {
  energy: '#14b8a6', taxes: '#0ea5e9', maintenance: '#06b6d4', labor: '#22d3ee', water: '#67e8f9',
};
const CAPEX_COLORS: Record<string, string> = {
  servers: '#ec4899', facility: '#f43f5e', networkInfrastructure: '#f97316', utilityWorks: '#f59e0b', land: '#fbbf24',
};

function fmtUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtCapacity(mw: number): string {
  return mw >= 1000 ? `${(mw / 1000).toFixed(2)} GW` : `${mw.toFixed(0)} MW`;
}

function SliderInput({ label, value, min, max, step, onChange, format, required }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format: (v: number) => string; required?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-slate-400">
          {label}
          {required && <span className="text-sa-accent ml-1">*</span>}
        </label>
        <span className="text-xs font-bold text-white number-cell">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 pb-4 border-b border-sa-border last:border-b-0 last:mb-0 last:pb-0">
      <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export default function DataCenterCostBreakdown() {
  const [inputs, setInputs] = useState<DataCenterCostInputs>(defaultDataCenterCostInputs);

  const set = (key: keyof DataCenterCostInputs) => (v: number) =>
    setInputs(prev => ({ ...prev, [key]: v }));

  const result = calcDataCenterCost(inputs);

  const opexData = Object.entries(result.opex).map(([key, value]) => ({
    key, name: DC_COST_LABELS.opex[key as keyof typeof DC_COST_LABELS.opex], value, fill: OPEX_COLORS[key],
  }));
  const capexData = Object.entries(result.capex).map(([key, value]) => ({
    key, name: DC_COST_LABELS.capex[key as keyof typeof DC_COST_LABELS.capex], value, fill: CAPEX_COLORS[key],
  }));

  return (
    <div>
      <SectionHeader
        title="AI Data Center Costs"
        subtitle="Annualized OpEx vs CapEx cost model for a hyperscaler AI data center. Capacity and energy price are yours to set; every other line item is computed live from adjustable unit-cost assumptions — nothing is a fixed lookup total."
        badge="Interactive"
        sources={[
          { type: 'estimate', label: 'Formula-driven — unit costs are adjustable estimates', url: 'https://epoch.ai/' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Inputs */}
        <div className="lg:col-span-1 bg-sa-card rounded-xl border border-sa-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Inputs</h3>
            <button
              onClick={() => setInputs(defaultDataCenterCostInputs)}
              className="text-xs text-sa-muted hover:text-sa-accent transition-colors"
            >
              Reset to defaults
            </button>
          </div>

          <Group title="Required">
            <SliderInput
              required label="Data Center IT Capacity" value={inputs.capacityGW * 1000} min={10} max={1000} step={10}
              onChange={v => set('capacityGW')(v / 1000)} format={fmtCapacity}
            />
            <SliderInput
              required label="Energy Cost ($/kWh)" value={inputs.energyCostPerKWh} min={0.01} max={0.30} step={0.005}
              onChange={set('energyCostPerKWh')} format={v => `$${v.toFixed(3)}`}
            />
          </Group>

          <Group title="Efficiency">
            <SliderInput
              label="PUE (facility power / IT power)" value={inputs.pue} min={1.02} max={1.60} step={0.01}
              onChange={set('pue')} format={v => v.toFixed(2)}
            />
            <SliderInput
              label="Average IT Load Factor (%)" value={inputs.utilizationPct} min={40} max={100} step={1}
              onChange={set('utilizationPct')} format={v => `${v}%`}
            />
          </Group>

          <Group title="Servers (CapEx)">
            <SliderInput
              label="Build Cost ($/kW IT capacity)" value={inputs.serverCostPerKW} min={2_000} max={30_000} step={500}
              onChange={set('serverCostPerKW')} format={v => `$${(v / 1000).toFixed(1)}k`}
            />
            <SliderInput
              label="Server Amortization (yrs)" value={inputs.serverAmortYears} min={1} max={6} step={0.5}
              onChange={set('serverAmortYears')} format={v => `${v}yr`}
            />
          </Group>

          <Group title="Facility & Infrastructure (CapEx)">
            <SliderInput
              label="Facility Build Cost ($/kW)" value={inputs.facilityCostPerKW} min={2_000} max={40_000} step={500}
              onChange={set('facilityCostPerKW')} format={v => `$${(v / 1000).toFixed(1)}k`}
            />
            <SliderInput
              label="Network Infra Cost ($/kW)" value={inputs.networkCostPerKW} min={1_000} max={30_000} step={500}
              onChange={set('networkCostPerKW')} format={v => `$${(v / 1000).toFixed(1)}k`}
            />
            <SliderInput
              label="Utility Works Cost ($/kW)" value={inputs.utilityCostPerKW} min={0} max={2_000} step={10}
              onChange={set('utilityCostPerKW')} format={v => `$${v.toFixed(0)}`}
            />
            <SliderInput
              label="Land Cost ($/kW)" value={inputs.landCostPerKW} min={0} max={1_500} step={10}
              onChange={set('landCostPerKW')} format={v => `$${v.toFixed(0)}`}
            />
            <SliderInput
              label="Infrastructure Amortization (yrs)" value={inputs.infraAmortYears} min={5} max={30} step={1}
              onChange={set('infraAmortYears')} format={v => `${v}yr`}
            />
          </Group>

          <Group title="Recurring OpEx Rates">
            <SliderInput
              label="Property Tax (% of annual CapEx)" value={inputs.taxRatePctOfCapex} min={0} max={6} step={0.05}
              onChange={set('taxRatePctOfCapex')} format={v => `${v.toFixed(2)}%`}
            />
            <SliderInput
              label="Maintenance (% of annual CapEx)" value={inputs.maintenanceRatePctOfCapex} min={0} max={6} step={0.05}
              onChange={set('maintenanceRatePctOfCapex')} format={v => `${v.toFixed(2)}%`}
            />
            <SliderInput
              label="Labor Cost ($/FTE/yr)" value={inputs.laborCostPerFTE} min={50_000} max={300_000} step={5_000}
              onChange={set('laborCostPerFTE')} format={v => `$${(v / 1000).toFixed(0)}k`}
            />
            <SliderInput
              label="Staffing Density (FTE/GW)" value={inputs.fteDensityPerGW} min={50} max={800} step={5}
              onChange={set('fteDensityPerGW')} format={v => `${v.toFixed(0)}`}
            />
            <SliderInput
              label="Water Use Effectiveness (L/kWh)" value={inputs.waterUseEffectivenessLPerKWh} min={0} max={2} step={0.02}
              onChange={set('waterUseEffectivenessLPerKWh')} format={v => `${v.toFixed(2)}`}
            />
            <SliderInput
              label="Water Price ($/m³)" value={inputs.waterPricePerM3} min={0} max={8} step={0.1}
              onChange={set('waterPricePerM3')} format={v => `$${v.toFixed(2)}`}
            />
          </Group>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-xl border-2 border-sa-accent/60 bg-sa-surface mb-4">
            <p className="text-xs text-sa-muted uppercase tracking-wider">Total Annual Cost</p>
            <p className="text-4xl font-black number-cell text-sa-accent mt-1">{fmtUSD(result.totalAnnual)}</p>
            <p className="text-xs text-sa-muted mt-2">
              For every <span className="text-white font-semibold">$1</span> spent operating a{' '}
              <span className="text-white font-semibold">{fmtCapacity(inputs.capacityGW * 1000)}</span> AI data center,{' '}
              <span className="text-sa-accent font-semibold">${result.capexPerOpexDollar.toFixed(1)}</span> goes into CapEx
              — {result.serverShareOfTotal.toFixed(0)}% of total spend is servers alone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <MetricCard label="Total OpEx / yr" value={fmtUSD(result.totalOpex)} subtext="Energy, taxes, maintenance, labor, water" />
            <MetricCard label="Total CapEx / yr" value={fmtUSD(result.totalCapex)} subtext="Servers, facility, network, utility, land" accent />
            <MetricCard label="Annual Energy Use" value={`${(result.annualEnergyKWh / 1e9).toFixed(2)} TWh`} subtext={`${fmtCapacity(inputs.capacityGW * 1000)} × PUE ${inputs.pue.toFixed(2)} × ${inputs.utilizationPct}% load`} />
            <MetricCard label="Staffing" value={`${result.numFTEs.toFixed(0)} FTE`} subtext={`${inputs.fteDensityPerGW.toFixed(0)} FTE/GW`} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-sa-card rounded-xl border border-sa-border p-4">
              <h3 className="text-sm font-semibold text-white mb-1">OpEx Breakdown</h3>
              <p className="text-xs text-sa-muted mb-3">{fmtUSD(result.totalOpex)} total annual operating expenses</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={opexData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a42" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtUSD(v)} />
                  <Tooltip formatter={(v: number) => [fmtUSD(v), 'Annual cost']} contentStyle={{ background: '#141b2d', border: '1px solid #1e2a42', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {opexData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-sa-card rounded-xl border border-sa-border p-4">
              <h3 className="text-sm font-semibold text-white mb-1">CapEx Breakdown</h3>
              <p className="text-xs text-sa-muted mb-3">{fmtUSD(result.totalCapex)} total annual CapEx (annualized)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={capexData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2a42" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtUSD(v)} />
                  <Tooltip formatter={(v: number) => [fmtUSD(v), 'Annual cost']} contentStyle={{ background: '#141b2d', border: '1px solid #1e2a42', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {capexData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Full line-item table */}
      <div className="bg-sa-card rounded-xl border border-sa-border p-4">
        <h3 className="text-sm font-semibold text-white mb-3">All Line Items — {fmtCapacity(inputs.capacityGW * 1000)}</h3>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-sa-muted font-semibold">Category</th>
                <th className="px-3 py-2 text-left text-sa-muted font-semibold">Line Item</th>
                <th className="px-3 py-2 text-right text-sa-muted font-semibold">Annual Cost</th>
                <th className="px-3 py-2 text-right text-sa-muted font-semibold">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {[...opexData.map(d => ({ ...d, group: 'OpEx' })), ...capexData.map(d => ({ ...d, group: 'CapEx' }))].map(row => (
                <tr key={row.key} className="border-t border-sa-border/30">
                  <td className="px-3 py-2 text-slate-400">{row.group}</td>
                  <td className="px-3 py-2 text-white font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: row.fill }} />
                    {row.name}
                  </td>
                  <td className="px-3 py-2 text-right number-cell text-white font-semibold">{fmtUSD(row.value)}</td>
                  <td className="px-3 py-2 text-right number-cell text-sa-muted">{((row.value / result.totalAnnual) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              <tr className="border-t-2 border-sa-border">
                <td className="px-3 py-2 text-white font-bold" colSpan={2}>Total Annual Cost</td>
                <td className="px-3 py-2 text-right number-cell text-sa-accent font-bold">{fmtUSD(result.totalAnnual)}</td>
                <td className="px-3 py-2 text-right number-cell text-sa-muted">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-sa-muted mt-3">
          * Required inputs. All other values are adjustable estimates — see Data Sources for methodology.
        </p>
      </div>
    </div>
  );
}
