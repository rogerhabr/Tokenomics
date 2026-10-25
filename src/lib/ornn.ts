// Ornn Compute Price Index (OCPI) — settled GPU rental prices from executed
// trades, USD per GPU-hour. https://data.ornn.com · API docs: data.ornn.com/docs
//
// LICENSE: Ornn's terms forbid publishing or redistributing index values to
// third parties and require "Ornn" attribution wherever they are shown. So:
//   - never write these values to public/, live-data.json, or git;
//   - serve them only through /api/compute-prices, which is role-gated and
//     sent with `Cache-Control: private, no-store` (never CDN-cached).

export const ORNN_BASE_URL = 'https://api.ornnai.com';
export const ORNN_ATTRIBUTION = 'Ornn Compute Price Index (OCPI)';
// The index updates hourly at most; Ornn's public limiter is 60 req/min/IP.
export const ORNN_REVALIDATE_SECONDS = 3600;
// Roles allowed to see licensed Ornn data (profiles.role).
export const ORNN_ALLOWED_ROLES = ['owner', 'internal'] as const;

export interface OrnnIndexEntry { gpu: string; pricePerHour: number; date: string }

export interface OrnnPrices {
  source: 'ornn';
  asOf: string;
  prices: OrnnIndexEntry[];
  attribution: string;
}

export interface OrnnUnavailable {
  source: 'unavailable';
  reason: 'forbidden' | 'unauthenticated' | 'not-configured' | 'upstream-error';
}

export type ComputePricesResponse = OrnnPrices | OrnnUnavailable;

// Pure parser for GET /api/daily-index/all — rejects anything malformed rather
// than passing a bad number into the model.
export function parseOrnnDailyIndex(body: unknown): OrnnPrices | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as { success?: unknown; date?: unknown; data?: unknown };
  if (b.success !== true || !Array.isArray(b.data) || typeof b.date !== 'string') return null;
  const prices: OrnnIndexEntry[] = [];
  for (const row of b.data as Record<string, unknown>[]) {
    const gpu = row?.gpu_type;
    const price = row?.index_value;
    const date = row?.date;
    if (typeof gpu === 'string' && typeof price === 'number' && Number.isFinite(price) && price > 0 && typeof date === 'string') {
      prices.push({ gpu, pricePerHour: price, date });
    }
  }
  if (prices.length === 0) return null;
  return { source: 'ornn', asOf: b.date, prices, attribution: ORNN_ATTRIBUTION };
}

export function ornnPrice(p: OrnnPrices | null | undefined, gpu: string): number | null {
  return p?.prices.find(e => e.gpu === gpu)?.pricePerHour ?? null;
}
