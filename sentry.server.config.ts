// Build/dev logs will show a benign webpack warning about
// @sentry/server-utils/orchestrion — that's @sentry/node's experimental
// auto-instrumentation module, which this app doesn't use (no `Sentry.init`
// integrations beyond basic error capture). It doesn't affect the build
// output or runtime behavior; tracked upstream in the Sentry JS SDK repo.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
} else {
  console.warn('[sentry] NEXT_PUBLIC_SENTRY_DSN not set — server-side error tracking is disabled.');
}
