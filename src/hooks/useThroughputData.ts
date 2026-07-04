import { useState, useEffect } from 'react';

// Live tokens/sec-per-model-per-xPU data, produced by the throughput monitoring
// agent (scripts/monitor-throughput.mjs) and published as public/throughput-data.json.
// Owned exclusively by that agent so the daily live-data.json refresh never
// clobbers it. The UI prefers high-confidence live cells over the static matrix.

export type ThroughputConfidence = 'high' | 'medium';

export interface ThroughputCell {
  tokensPerSec: number;
  confidence: ThroughputConfidence;
  sources: string[];
  sampleCount: number;
  spreadPct: number;
}

export interface ThroughputData {
  asOf: string | null;
  collectorStats: Record<string, number>;
  // cells[hardware][model] = ThroughputCell
  cells: Record<string, Record<string, ThroughputCell>>;
}

const EMPTY: ThroughputData = { asOf: null, collectorStats: {}, cells: {} };

export function useThroughputData() {
  const [data, setData] = useState<ThroughputData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/throughput-data.json')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((d: ThroughputData) => { setData({ ...EMPTY, ...d }); setLoaded(true); })
      .catch(() => setLoaded(true)); // absent until the agent's first PR merges — fall back to static
  }, []);

  // Prefer a live cell only when present and high-confidence.
  function liveThroughput(hardware: string, model: string): ThroughputCell | null {
    const cell = data.cells?.[hardware]?.[model];
    if (cell && cell.confidence === 'high' && cell.tokensPerSec > 0) return cell;
    return null;
  }

  return { throughput: data, throughputLoaded: loaded, liveThroughput };
}
