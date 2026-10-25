'use client';

import { useEffect, useState } from 'react';
import type { ComputePricesResponse } from '@/lib/ornn';

// Licensed Ornn prices for owner/internal users; everyone else (and any
// failure) gets `unavailable`, and sections fall back to list prices.
export function useComputePrices() {
  const [data, setData] = useState<ComputePricesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/compute-prices', { cache: 'no-store' })
      .then(r => r.json() as Promise<ComputePricesResponse>)
      .catch((): ComputePricesResponse => ({ source: 'unavailable', reason: 'upstream-error' }))
      .then(d => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  return { computePrices: data?.source === 'ornn' ? data : null, computePricesLoaded: data !== null };
}
