# AI Tokenomics Model

An interactive financial dashboard for AI tokenomics research. Built as a dynamic Next.js app with Supabase (Postgres + Auth) and deployed to Vercel.

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

## Setup (new environment)

1. Create a [Supabase](https://supabase.com) project. In the SQL Editor, run `supabase/migrations/0001_init.sql`.
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API.
3. (Optional) Create an [Upstash](https://upstash.com) Redis database and add its REST URL/token to `.env.local` to enable API rate limiting.
4. Connect this repo to a [Vercel](https://vercel.com) project and set the same env vars there (Project Settings → Environment Variables) for production/preview deploys.

## Architecture

### State Management
- `src/lib/params.ts` — Global parameter types and scenario presets (bear/base/bull)
- `src/contexts/ParamsContext.tsx` — React context that wraps the whole app; persists params to `localStorage` under `ai-tokenomics-params-v2`

### Data
- `src/lib/data.ts` — Static financial/hardware datasets
- `src/lib/sources.ts` — Data source references
- `src/hooks/useLiveData.ts` — Fetches `public/live-data.json` at runtime (stock prices, GPU rental rates, model pricing, NVDA financials); staleness thresholds: fresh < 12h, aging < 26h, stale otherwise
- `src/hooks/useThroughputData.ts` — Token throughput data hook
- `scripts/fetch-live-data.mjs` — Script to refresh `live-data.json` from external APIs
- `scripts/monitor-throughput.mjs` — Autonomous throughput monitoring agent

### Auth & Backend
- `src/middleware.ts` — Runs on every request: refreshes the Supabase session, redirects unauthenticated requests to `/login`, and applies rate limiting to `/api/*`
- `src/lib/supabase/client.ts` — Browser Supabase client (Client Components)
- `src/lib/supabase/server.ts` — Server Supabase client bound to request cookies (Server Components, Route Handlers) — queries made with it are scoped by Postgres RLS
- `src/lib/rateLimit.ts` — Upstash-backed sliding-window rate limiter; no-ops (never blocks) if `UPSTASH_REDIS_REST_URL`/`_TOKEN` aren't set
- `src/app/login/page.tsx` — Email/password sign-in and sign-up
- `src/app/auth/callback/route.ts` — Exchanges a Supabase email-confirmation code for a session
- `src/app/api/health/route.ts`, `src/app/api/profile/route.ts` — Example Route Handlers; `profile` demonstrates a Postgres-RLS-scoped query against the signed-in user
- `supabase/migrations/0001_init.sql` — `profiles` table, RLS policies, and an `auth.users` insert trigger that provisions a profile row on signup

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

## Live Data

`public/live-data.json` is regenerated by running:
```bash
node scripts/fetch-live-data.mjs
```
This file is committed and served statically. The `useLiveData` hook reads it at runtime.

## Full-Stack Architecture Map

| Layer | Status | Implementation |
|---|---|---|
| 1. Frontend foundations | ✅ Built | Next.js App Router, React, Tailwind |
| 2. APIs & backend logic | ✅ Built | Next.js Route Handlers (`src/app/api/*`) |
| 3. Database & storage | ✅ Built | Supabase Postgres (`profiles` table); no object storage yet — add a Supabase Storage bucket if needed |
| 4. Auth, authz, permissions | ✅ Built | Supabase Auth (email/password), session cookies via `@supabase/ssr`, `middleware.ts` route protection; `profiles.role` column exists for future RBAC checks but nothing enforces roles yet |
| 5/6. Hosting & compute | ⚙️ Platform-provided | Vercel serverless functions — auto-scales, no config needed |
| 7. CI/CD & version control | ✅ Built (CI) / ⚙️ Platform (CD) | `.github/workflows/ci.yml` lints+builds on push/PR; actual deploys happen via Vercel's native GitHub integration (connect the repo in the Vercel dashboard) |
| 8. Security & row-level security | ✅ Built | Postgres RLS policies in `supabase/migrations/0001_init.sql` |
| 9. Rate limiting | ✅ Built (optional) | `src/lib/rateLimit.ts`, Upstash Redis — no-ops if unconfigured |
| 10. Caching & CDN | ⚙️ Platform-provided | Vercel's edge network; `Cache-Control` header set as an example on `/api/health` |
| 11. Load balancing & scaling | ⚙️ Platform-provided | Vercel serverless auto-scaling |
| 12. Error tracking & logs | ❌ Not built | No Sentry/logging service wired up. Adding Sentry is a well-documented drop-in (`npx @sentry/wizard@latest -i nextjs`) once you have a DSN — deliberately left out rather than half-configured |
| 13. Availability & recovery | ⚙️ Platform-provided | Vercel (multi-region edge, automatic rollback on failed deploys) + Supabase (automated backups; point-in-time recovery requires a paid Supabase plan) |

"Platform-provided" means the layer is handled by Vercel/Supabase's infrastructure with no custom code required, not that it's unimplemented.
