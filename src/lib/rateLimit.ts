import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

const hasUpstash = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit = hasUpstash
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'ai-tokenomics-ratelimit',
    })
  : null;

let warned = false;

// Returns true if the request should be blocked. No-ops (never blocks) when
// Upstash isn't configured, logging once so the gap is visible rather than silent.
export async function isRateLimited(request: NextRequest): Promise<boolean> {
  if (!ratelimit) {
    if (!warned) {
      console.warn('[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting is disabled.');
      warned = true;
    }
    return false;
  }
  const identifier = request.ip ?? request.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await ratelimit.limit(identifier);
  return !success;
}
