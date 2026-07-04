import { useState, useEffect } from 'react';

export interface StockInfo {
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  marketCap: number | null;
}

export interface CapExInfo {
  value: number | null;    // $B, annual from most recent 10-K
  period: string | null;   // YYYY-MM-DD end date
  source: string | null;
}

export interface GPURentalInfo {
  lambdaPerHour: number | null;
  azurePerHour: number | null;
  lowestPerHour: number | null;
  sources: string[];
}

export interface ModelPricingEntry {
  inputPerM: number;
  outputPerM: number;
  provider: string;
  displayName: string;
  contextK?: number;
}

export interface NvdaFinancials {
  latestQuarterRevenue: number | null;   // $M
  prevQuarterRevenue: number | null;     // $M
  qoqGrowthPct: number | null;
  periodEnd: string | null;
  period: string | null;
}

export interface LiveData {
  lastUpdated: string | null;
  sources: Record<string, string>;
  stocks: Record<string, StockInfo | null>;
  gpuCloud: {
    azureH100PerHour: number | null;
    lambdaH100PerHour: number | null;
  };
  capex: Record<string, CapExInfo | null>;
  modelPricing: Record<string, ModelPricingEntry>;
  gpuRentalPrices: Record<string, GPURentalInfo | string[]>;
  nvdaFinancials: NvdaFinancials | null;
  corewaveFinancials: NvdaFinancials | null;
}

export type StalenessSeverity = 'fresh' | 'aging' | 'stale' | 'unknown';

const EMPTY: LiveData = {
  lastUpdated: null,
  sources: {},
  stocks: {},
  gpuCloud: { azureH100PerHour: null, lambdaH100PerHour: null },
  capex: {},
  modelPricing: {},
  gpuRentalPrices: {},
  nvdaFinancials: null,
  corewaveFinancials: null,
};

function hoursAgo(iso: string | null): number | null {
  if (!iso) return null;
  try {
    const ms = Date.now() - new Date(iso).getTime();
    return ms / (1000 * 60 * 60);
  } catch {
    return null;
  }
}

function staleness(iso: string | null): StalenessSeverity {
  const h = hoursAgo(iso);
  if (h === null) return 'unknown';
  if (h < 12) return 'fresh';
  if (h < 26) return 'aging';
  return 'stale';
}

export function useLiveData() {
  const [data, setData] = useState<LiveData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/live-data.json')
      .then(r => r.json())
      .then((d: LiveData) => { setData({ ...EMPTY, ...d }); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const ageHours = hoursAgo(data.lastUpdated);
  const severity = staleness(data.lastUpdated);

  return { liveData: data, liveLoaded: loaded, ageHours, severity };
}
