# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Tokenomics Model

An interactive financial dashboard for AI tokenomics research. Built as a dynamic Next.js app with Supabase (Postgres + Auth) and deployed to Vercel.

## Full-Stack Development Policy

**Every new feature or change in this repo is built against the full 13-layer architecture below, by default — not bolted on as a frontend-only change.** Before starting new dev work, check which layers it touches and reuse the existing pattern for that layer rather than inventing a parallel one. If a layer genuinely doesn't apply to a given change, that's fine — just don't skip a layer silently when the change actually touches it (e.g. a new table with no RLS, a new API route with no auth check, a new external call with no graceful-degradation fallback).

Checklist for anything beyond a pure UI tweak:
- [ ] **New database table?** → add a migration in `supabase/migrations/`, enable RLS, add policies. Never ship a table without RLS.
- [ ] **New backend logic?** → a Route Handler in `src/app/api/*`, using `src/lib/supabase/server.ts` for any DB access so RLS is enforced (see `src/app/api/profile/route.ts` for the pattern).
- [ ] **Touches auth/permissions?** → extend `middleware.ts` / the `profiles.role` column rather than inventing a new gate.
- [ ] **New external API call?** → rate-limit it the way `src/lib/rateLimit.ts` does, and fail open (never crash) if it's unconfigured — see `src/middleware.ts`.
- [ ] **New env var?** → add it to `.env.example`, document it under Setup, and make the code degrade gracefully rather than crash if it's unset.
- [ ] **Changes what's deployed?** → `npm run build` + `npm run lint` clean before pushing. Vercel deploys automatically on merge to `master`; don't add a custom deploy Action.
- [ ] Go branch → PR → merge for every change, same as CI/CD layer below — no direct pushes to `master`. (The only exception is the automated daily `refresh-data.yml` workflow, which commits `public/live-data.json` straight to `master`.)

Full layer-by-layer status is in "Full-Stack Architecture Map" near the bottom of this file — update it as new layers get exercised or verified live (not just built).

## Tech Stack

- **Framework**: Next.js 14 (App Router, standard server build — no static export)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with a custom dark theme (`sa-*` color tokens)
- **Charts**: Recharts
- **Icons**: lucide-react
- **Auth & Database**: Supabase (Postgres with Row-Level Security, email/password auth)
- **Rate limiting**: Upstash Redis via `@upstash/ratelimit` (no-ops if unconfigured — see `src/lib/rateLimit.ts`)
- **Hosting**: Vercel (connect this repo via the Vercel dashboard; deploys on every push to `master`, no custom GitHub Action needed)

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run start    # Run the production build locally
npm run lint     # ESLint via next lint
```

There is no test suite — verification is `npm run lint` + `npm run build` (both must pass; CI runs exactly these two). The build works without real Supabase credentials (CI uses placeholders), so a missing `.env.local` never blocks lint/build.

`screenshot.js` (repo root) is a Playwright script that captures dashboard screenshots against a running `localhost:3000` — useful for visually verifying UI changes (Playwright is a devDependency; Chromium is pre-installed in remote sessions).

## Setup (new environment)

1. Create a [Supabase](https://supabase.com) project. In the SQL Editor, run `supabase/migrations/0001_init.sql`.
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API.
3. (Optional) Create an [Upstash](https://upstash.com) Redis database and add its REST URL/token to `.env.local` to enable API rate limiting.
4. (Optional) Create a [Sentry](https://sentry.io) project and add its DSN to `.env.local` as `NEXT_PUBLIC_SENTRY_DSN` to enable error tracking.
5. Connect this repo to a [Vercel](https://vercel.com) project and set the same env vars there (Project Settings → Environment Variables) for production/preview deploys.

## Architecture

### State Management
- `src/lib/params.ts` — Global parameter types and scenario presets (bear/base/bull)
- `src/contexts/ParamsContext.tsx` — React context that wraps the whole app; persists params to `localStorage` under `ai-tokenomics-params-v2`

### Data
- `src/lib/data.ts` — Static financial/hardware datasets
- `src/lib/sources.ts` — Data source references
- `src/hooks/useLiveData.ts` — Fetches `public/live-data.json` at runtime (stock prices, GPU rental rates, model pricing, NVDA financials); staleness thresholds: fresh < 12h, aging < 26h, stale otherwise
- `src/hooks/useThroughputData.ts` — Fetches `public/throughput-data.json` at runtime; falls back silently to the static `throughputMatrix` in `src/lib/data.ts` while the file doesn't exist yet, and only lets a live cell override the static matrix when its confidence is `high`
- `scripts/fetch-live-data.mjs` — Script to refresh `live-data.json` from external APIs
- `scripts/monitor-throughput.mjs` — Autonomous throughput monitoring agent; exclusively owns `public/throughput-data.json` (the daily live-data refresh rewrites `live-data.json` from scratch and must never clobber throughput data). Its hardware/model alias tables must stay in sync with the `throughputMatrix` rows/columns in `src/lib/data.ts`
- `AI_TOKENOMICS_RESEARCH.md` / `AI_TOKENOMICS_VALIDATION.md` — Research report and claims-validation report the model's assumptions are grounded in (source paper: arXiv:2606.24616)

### Auth & Backend
- `src/middleware.ts` — Runs on every request: refreshes the Supabase session, redirects unauthenticated requests to `/login`, and applies rate limiting to `/api/*`
- `src/lib/supabase/client.ts` — Browser Supabase client (Client Components)
- `src/lib/supabase/server.ts` — Server Supabase client bound to request cookies (Server Components, Route Handlers) — queries made with it are scoped by Postgres RLS
- `src/lib/rateLimit.ts` — Upstash-backed sliding-window rate limiter; no-ops (never blocks) if `UPSTASH_REDIS_REST_URL`/`_TOKEN` aren't set
- `src/app/login/page.tsx` — Email/password sign-in and sign-up
- `src/app/auth/callback/route.ts` — Exchanges a Supabase email-confirmation code for a session
- `src/app/api/health/route.ts`, `src/app/api/profile/route.ts` — Example Route Handlers; `profile` demonstrates a Postgres-RLS-scoped query against the signed-in user
- `supabase/migrations/0001_init.sql` — `profiles` table, RLS policies, and an `auth.users` insert trigger that provisions a profile row on signup

### Observability
- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` — Sentry init for each runtime; all no-op with a console warning if `NEXT_PUBLIC_SENTRY_DSN` isn't set
- `src/instrumentation.ts` — Next.js instrumentation hook that loads the right Sentry config per runtime and wires up `onRequestError` for Server Component/Route Handler errors
- `src/app/global-error.tsx` — Root error boundary; reports uncaught React render errors to Sentry
- `next.config.js` — Wrapped with `withSentryConfig` for source map upload; skipped automatically (not a build failure) unless `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` are set

### UI Structure
- `src/app/page.tsx` — Root page; renders sidebar + header + section content; sections are lazy-loaded with `next/dynamic`. Protected by `middleware.ts`, not a client-side gate.
- `src/components/Sidebar.tsx` — Navigation sidebar (16 sections grouped into Dashboard / Supply / Demand / Economics / Tokenomics / Methodology)
- `src/components/sections/` — One component per dashboard section
- `src/components/AssumptionsPanel.tsx` — Slide-in panel for tweaking global parameters
- `src/components/ScenarioBar.tsx` — Bear/Base/Bull scenario switcher

### Sections (in order)
| ID | Label |
|----|-------|
| overview | Overview |
| hardware-base | Hardware Installed Base |
| token-throughput | Token Throughput |
| supply-demand | Compute Supply & Demand |
| saas-disruption | SAAS Disruption |
| addressable-market | Addressable Market |
| token-pricing | Token Pricing Trends |
| lab-financials | Lab Financials |
| roic-calculator | ROIC Calculator |
| hardware-refresh | HW Refresh Sensitivity |
| hardware-demand | Hardware Demand Forecast |
| revenue-profit | Revenue & Profit |
| dc-cost-breakdown | AI Data Center Costs |
| token-cost | Token Cost Anatomy |
| workflow-allocation | Workflow Allocation |
| data-sources | Data Sources |

## Styling Conventions

Use the `sa-*` Tailwind tokens for all colors — do not use arbitrary hex values:
- `bg-sa-bg` / `bg-sa-surface` / `bg-sa-card` — dark backgrounds
- `text-sa-muted` — secondary text
- `border-sa-border` — dividers
- `text-sa-accent` — orange highlight (#f97316)
- `text-sa-green` / `text-sa-red` / `text-sa-blue` / `text-sa-purple` / `text-sa-yellow` — semantic colors
- Font: `font-mono` (JetBrains Mono) for numeric values

## Live Data & Automation

Two datasets in `public/` are committed to git and served statically, each with its own automated pipeline (`.github/workflows/`):

- **`public/live-data.json`** — regenerated by `node scripts/fetch-live-data.mjs`. The `refresh-data.yml` workflow runs it daily (06:00 UTC) and commits the result **directly to `master`** — the one sanctioned exception to the branch → PR → merge rule. Expect the git log to be dominated by these "Refresh live data" commits.
- **`public/throughput-data.json`** — owned exclusively by `scripts/monitor-throughput.mjs`, run weekly (Monday 07:00 UTC) by `monitor-throughput.yml`. This one is **PR-gated**: material changes open/update a PR on the `agent/throughput-update` branch with an evidence report for human review; nothing is written to `master` directly. The file does not exist until the agent's first PR merges — the UI falls back to the static matrix until then. Optional secrets (`AA_API_KEY`, `ANTHROPIC_API_KEY`, …) enable extra collectors; the agent degrades gracefully without them.

There is also `ci.yml` (lint + build on push/PR). Vercel deploys are handled by its native GitHub integration, not a workflow — don't add a custom deploy Action.

### Local utility scripts (not part of the app)
- `scripts/setup-github-token.mjs` — writes `GITHUB_TOKEN` to `.env.local` for the Claude Code remote session-start hook
- `scripts/set-claude-env-var.mjs` — Playwright agent that sets env vars on claude.ai/code projects from your local machine

## Full-Stack Architecture Map

| Layer | Status | Implementation |
|---|---|---|
| 1. Frontend foundations | ✅ Verified live | Next.js App Router, React, Tailwind — confirmed rendering correctly on Vercel |
| 2. APIs & backend logic | ✅ Built | Next.js Route Handlers (`src/app/api/*`); `/api/health` checked live, `/api/profile` not yet called directly (its data path is proven via the DB check below) |
| 3. Database & storage | ✅ Verified live | Supabase Postgres (`profiles` table) — confirmed a real row is created on signup; no object storage yet, add a Supabase Storage bucket if needed |
| 4. Auth, authz, permissions | ✅ Verified live | Supabase Auth (email/password), session cookies via `@supabase/ssr`, `middleware.ts` route protection — full sign-up → confirm → sign-in → logout cycle confirmed working. `profiles.role` column exists for future RBAC checks but nothing enforces roles yet. **Email confirmation is currently OFF** in the Supabase dashboard (Authentication → Providers → Email) to work around the default mailer's rate limit during testing — turn it back on (and/or configure custom SMTP) before real users sign up |
| 5/6. Hosting & compute | ✅ Verified live | Vercel serverless functions, auto-deploys on push to `master` — confirmed across multiple deployments |
| 7. CI/CD & version control | ✅ Working | `.github/workflows/ci.yml` lints+builds on push/PR; every change goes branch → PR → merge → Vercel auto-deploy (its native GitHub integration, not a custom Action). Two scheduled data workflows also run: `refresh-data.yml` (daily, commits to `master`) and `monitor-throughput.yml` (weekly, PR-gated) — see "Live Data & Automation" |
| 8. Security & row-level security | ✅ Verified live | Postgres RLS policies in `supabase/migrations/0001_init.sql` — confirmed 2 active policies on `profiles` in the Supabase Table Editor |
| 9. Rate limiting | ⚙️ Built, not configured | `src/lib/rateLimit.ts`, Upstash Redis — no-ops (never blocks) until `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set; add before this is public-facing |
| 10. Caching & CDN | ⚙️ Platform-provided | Vercel's edge network; `Cache-Control` header set as an example on `/api/health` |
| 11. Load balancing & scaling | ⚙️ Platform-provided | Vercel serverless auto-scaling |
| 12. Error tracking & logs | ⚙️ Built, not configured | Sentry wired into all 3 runtimes (client/server/edge) plus `global-error.tsx` and the middleware/login-form catch blocks — no-ops with a console warning until `NEXT_PUBLIC_SENTRY_DSN` is set; add a real DSN and (optionally) `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for source maps before relying on it in production |
| 13. Availability & recovery | ⚙️ Platform-provided | Vercel (multi-region edge, automatic rollback on failed deploys) + Supabase (automated backups; point-in-time recovery requires a paid Supabase plan) |

"Platform-provided" means the layer is handled by Vercel/Supabase's infrastructure with no custom code required, not that it's unimplemented.
