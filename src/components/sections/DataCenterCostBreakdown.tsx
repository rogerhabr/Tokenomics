'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import SectionHeader from '../SectionHeader';
import MetricCard from '../MetricCard';
import {
  defaultDataCenterCostInputs, calcDataCenterCost, DC_COST_LABELS,
} from '@/lib/data';

const OPEX_COLORS: Record<string, string> = {
  energy: '#14b8a6', taxes: '#0ea5e9', maintenance: '#06b6d4', labor: '#22d3ee', water: '#67e8f9',
};
const CAPEX_COLORS: Record<string, string> = {
  servers: '#ec4899', facility: '#f43f5e', networkInfrastructure: '#f97316', utilityWorks: '#f59e0b', land: '#fbbf24',
};

const MIN_GW = 0.1;
const MAX_GW = 20;

function fmtUSD(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export default function DataCenterCostBreakdown() {
  const [capacityGW, setCapacityGW] = useState(defaultDataCenterCostInputs.capacityGW);

  const result = calcDataCenterCost({ capacityGW });

  const opexData = Object.entries(result.opex).map(([key, value]) => ({
    key, name: DC_COST_LABELS.opex[key as keyof typeof DC_COST_LABELS.opex], value, fill: OPEX_COLORS[key],
  }));
  const capexData = Object.entries(result.capex).map(([key, value]) => ({
    key, name: DC_COST_LABELS.capex[key as keyof typeof DC_COST_LABELS.capex], value, fill: CAPEX_COLORS[key],
  }));

  return (
    <div>
      <SectionHeader
        title="Data Center Cost Breakdown"
        subtitle="Annualized OpEx vs CapEx cost structure for a hyperscaler AI data center. Enter a build size in gigawatts — every line item scales linearly from Epoch.ai's per-GW baseline."
        badge="Interactive"
        sources={[
          { type: 'derived', label: 'Scaled from Epoch.ai per-GW baseline', url: 'https://epoch.ai/' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        {/* Input — the only required input */}
        <div className="lg:col-span-1 bg-sa-card rounded-xl border border-sa-border p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Input</h3>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-slate-400">Data Center Capacity</label>
              <span className="text-xs font-bold text-white number-cell">{capacityGW.toFixed(1)} GW</span>
            </div>
            <input
              type="range" min={MIN_GW} max={MAX_GW} step={0.1} value={capacityGW}
              onChange={e => setCapacityGW(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-sa-muted mt-0.5">
              <span>{MIN_GW} GW</span><span>{MAX_GW} GW</span>
            </div>
            <input
              type="number" min={MIN_GW} max={100} step={0.1} value={capacityGW}
              onChange={e => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) setCapacityGW(v);
              }}
              className="w-full text-xs mt-3"
            />
          </div>
          <p className="text-xs text-sa-muted mt-4 leading-relaxed">
            That&rsquo;s the only knob — everything below (10 cost line items, totals, and ratios)
            is derived automatically from the 1 GW Epoch.ai baseline.
          </p>
        </div>

        {/* Results */}
        <div className="lg:col-span-2">
          <div className="p-4 rounded-xl border-2 border-sa-accent/60 bg-sa-surface mb-4">
            <p className="text-xs text-sa-muted uppercase tracking-wider">Total Annual Cost</p>
            <p className="text-4xl font-black number-cell text-sa-accent mt-1">{fmtUSD(result.totalAnnual)}</p>
            <p className="text-xs text-sa-muted mt-2">
              For every <span className="text-white font-semibold">$1</span> spent operating a{' '}
              <span className="text-white font-semibold">{capacityGW.toFixed(1)} GW</span> AI data center,{' '}
              <span className="text-sa-accent font-semibold">${result.capexPerOpexDollar.toFixed(1)}</span> goes into CapEx
              — {result.serverShareOfTotal.toFixed(0)}% of total spend is servers alone.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Total OpEx / yr" value={fmtUSD(result.totalOpex)} subtext="Energy, taxes, maintenance, labor, water" />
            <MetricCard label="Total CapEx / yr" value={fmtUSD(result.totalCapex)} subtext="Servers, facility, network, utility, land" accent />
            <MetricCard label="Cost of the OpEx Component" value={fmtUSD(result.opex.energy)} subtext="Energy — largest OpEx line item" />
            <MetricCard label="Cost of the CapEx Component" value={fmtUSD(result.capex.servers)} subtext={`Servers — ${result.serverShareOfCapex.toFixed(0)}% of CapEx`} accent />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="bg-sa-card rounded-xl border border-sa-border p-4">
          <h3 className="text-sm font-semibold text-white mb-1">OpEx Breakdown</h3>
          <p className="text-xs text-sa-muted mb-3">${result.totalOpex >= 1e9 ? (result.totalOpex/1e9).toFixed(2)+'B' : (result.totalOpex/1e6).toFixed(0)+'M'} total annual operating expenses</p>
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
          <p className="text-xs text-sa-muted mb-3">${(result.totalCapex/1e9).toFixed(2)}B total annual CapEx (annualized)</p>
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

      {/* Full line-item table, mirroring the source chart exactly */}
      <div className="bg-sa-card rounded-xl border border-sa-border p-4">
        <h3 className="text-sm font-semibold text-white mb-3">All Line Items — {capacityGW.toFixed(1)} GW</h3>
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
      </div>
    </div>
  );
}
