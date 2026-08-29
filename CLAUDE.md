# AI Tokenomics Model

The AXIS LABS website plus an interactive financial dashboard for AI tokenomics research. Built as a dynamic Next.js app with Supabase (Postgres + Auth) and deployed to Vercel.

Two unrelated surfaces share one deployment:
- **AXIS LABS site** (`/`, `/products`, `/products/[slug]`, `/lots`, `/lots/[lot]`, `/cart`, `/checkout`, `/quality`, `/about`, `/ordering`, `/contact`, plus the footer policy pages `/prohibited-use`, `/terms`, `/privacy`, `/shipping-returns`, `/accessibility`) — public, no auth. A research-compound storefront: register, lot records, cart, checkout, release specification, and enquiry form.
- **Dashboard** (`/dashboard`) — the AI tokenomics model, behind Supabase auth via `middleware.ts`.

### Research-use-only constraint

AXIS LABS supplies research chemicals. All catalogue copy must stay in laboratory-research terms. Never add dosing, administration, reconstitution protocols, human- or veterinary-use guidance, or health claims to any product page or data file. The `ResearchNotice` component belongs on every public page, and the full disclaimer stays in the footer.

### No fabricated analytical data

**Never write a lot code, an assayed purity figure, or a lot count into the marketing source** — not as a fixture, not as a design placeholder, not in a comment. Those values may only reach a page from the `lots` table. The site's entire argument is that its figures are checkable; an invented one turns the research-use framing into exactly the pretextual claim it must not be. `npm run lint` runs `scripts/check-no-fabricated-data.mjs`, which fails the build on any of the three. If you need a figure to lay something out, render the real empty state instead.

## Full-Stack Development Policy

**Every new feature or change in this repo is built against the full 13-layer architecture below, by default — not bolted on as a frontend-only change.** Before starting new dev work, check which layers it touches and reuse the existing pattern for that layer rather than inventing a parallel one. If a layer genuinely doesn't apply to a given change, that's fine — just don't skip a layer silently when the change actually touches it (e.g. a new table with no RLS, a new API route with no auth check, a new external call with no graceful-degradation fallback).

Checklist for anything beyond a pure UI tweak:
- [ ] **New database table?** → add a migration in `supabase/migrations/`, enable RLS, add policies. Never ship a table without RLS.
- [ ] **New backend logic?** → a Route Handler in `src/app/api/*`, using `src/lib/supabase/server.ts` for any DB access so RLS is enforced (see `src/app/api/profile/route.ts` for the pattern).
- [ ] **Touches auth/permissions?** → extend `middleware.ts` / the `profiles.role` column rather than inventing a new gate.
- [ ] **New external API call?** → rate-limit it the way `src/lib/rateLimit.ts` does, and fail open (never crash) if it's unconfigured — see `src/middleware.ts`.
- [ ] **New env var?** → add it to `.env.example`, document it under Setup, and make the code degrade gracefully rather than crash if it's unset.
- [ ] **Changes what's deployed?** → `npm run build` + `npm run lint` clean before pushing. Vercel deploys automatically on merge to `master`; don't add a custom deploy Action.
- [ ] Go branch → PR → merge for every change, same as CI/CD layer below — no direct pushes to `master`.

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
npm run lint     # ESLint, then the no-fabricated-data check
npm run check:data  # the no-fabricated-data check on its own
```

```bash
node scripts/fetch-molecules.mjs   # refresh reference chemistry + structure SVGs from PubChem
node scripts/screenshot.mjs <dir> / /products   # visual review against a running server
```

## Setup (new environment)

1. Create a [Supabase](https://supabase.com) project. In the SQL Editor, run the migrations in `supabase/migrations/` in order (`0001_init` → `0002_contact_messages` → `0003_orders` → `0004_lots`).
2. Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Project Settings → API. Set `NEXT_PUBLIC_SITE_URL` to the production domain so sitemap, robots, canonical and Open Graph URLs are absolute.
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
- `src/hooks/useThroughputData.ts` — Token throughput data hook
- `scripts/fetch-live-data.mjs` — Script to refresh `live-data.json` from external APIs
- `scripts/monitor-throughput.mjs` — Autonomous throughput monitoring agent

### Auth & Backend
- `src/middleware.ts` — Runs on every request: refreshes the Supabase session, redirects unauthenticated requests to `/login`, and applies rate limiting to `/api/*`. Public routes are listed explicitly in `PUBLIC_PREFIXES`/`PUBLIC_EXACT` (the marketing pages), so **new routes are private by default** — add a route there to make it public
- `src/lib/supabase/client.ts` — Browser Supabase client (Client Components)
- `src/lib/supabase/server.ts` — Server Supabase client bound to request cookies (Server Components, Route Handlers) — queries made with it are scoped by Postgres RLS
- `src/lib/rateLimit.ts` — Upstash-backed sliding-window rate limiter; no-ops (never blocks) if `UPSTASH_REDIS_REST_URL`/`_TOKEN` aren't set
- `src/app/login/page.tsx` — Email/password sign-in and sign-up
- `src/app/auth/callback/route.ts` — Exchanges a Supabase email-confirmation code for a session
- `src/app/api/health/route.ts`, `src/app/api/profile/route.ts` — Example Route Handlers; `profile` demonstrates a Postgres-RLS-scoped query against the signed-in user
- `src/app/api/contact/route.ts` — Public contact-form endpoint: validates and length-caps input, drops honeypot submissions silently, inserts via the RLS-scoped server client, and returns 503 (rather than crashing) if Supabase is unconfigured
- `supabase/migrations/0001_init.sql` — `profiles` table, RLS policies, and an `auth.users` insert trigger that provisions a profile row on signup
- `supabase/migrations/0002_contact_messages.sql` — `contact_messages` table; RLS grants anon/authenticated **insert only** (no select policy for them) and restricts reads to `profiles.role = 'admin'`
- `supabase/migrations/0004_lots.sql` — `lots` table, the public assay register. RLS is the inverse of `orders`: anon may **select** rows where `published = true` and nothing else; writes are admin-only. **Nothing is seeded** — there are no fixture lots anywhere in this repo
- `src/lib/supabase/public.ts` — Session-free client for public reads, so lot data does not force product pages out of static generation

### Observability
- `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` — Sentry init for each runtime; all no-op with a console warning if `NEXT_PUBLIC_SENTRY_DSN` isn't set
- `src/instrumentation.ts` — Next.js instrumentation hook that loads the right Sentry config per runtime and wires up `onRequestError` for Server Component/Route Handler errors
- `src/app/global-error.tsx` — Root error boundary; reports uncaught React render errors to Sentry
- `next.config.js` — Wrapped with `withSentryConfig` for source map upload; skipped automatically (not a build failure) unless `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` are set

### UI Structure — AXIS LABS site

The direction is **"against specification"**: every competitor asserts purity, AXIS publishes the record. The site's one recurring graphic is the release specification drawn as a dashed hairline, and everything is measured against it — including the lots that failed. Keep new work inside that idea; a decorative element that argues nothing does not belong.

- `src/app/(marketing)/layout.tsx` — Route-group layout. Loads **Archivo** and **Martian Mono** via `next/font/google` here rather than in the root layout, so `/dashboard` pays nothing for them. Note both omit `weight` — passing it loads static cuts and makes the `axes` (width) option illegal.
- `src/app/(marketing)/page.tsx` — Home; `products/`, `products/[slug]/`, `lots/`, `lots/[lot]/`, `quality/`, `about/`, `ordering/`, `contact/`, `cart/`, `checkout/` and the five policy pages are the rest
- `src/lib/products.ts` — The catalogue: `CATEGORIES` (7) and `PRODUCTS` (17). Product pages are statically generated via `generateStaticParams`. **`casNumber`, `molecularWeight` and `presentation` are deliberately `null` wherever unconfirmed** — populate them from real certificates of analysis, never from a guess, and never from `molecules.generated.json` (see below)
- `src/lib/molecules.ts` + `molecules.generated.json` + `molecules.svg.json` — **Reference chemistry**, resolved from PubChem at build time. This is registry data about the molecule and is rendered in its own block, cited to a CID, **never merged into the product's CoA fields**. `hasStructure()` gates the structure drawing at 250 atoms; above that the depiction is line noise and the formula specimen carries the page
- `src/lib/lots.ts` — The lot register, read through the **session-free** public client so product pages stay statically generated. Every function returns an empty result rather than throwing, and `available` distinguishes "read successfully and empty" from "could not read"
- `src/lib/variants.ts` — **vial sizes and prices, read from the `product_variants` table** so an administrator can change them without a deploy. Falls back to the `VARIANTS` block in `products.ts` when Supabase is unconfigured or the table is missing, so the shop never renders priceless. `resolveVariant()` is what `/api/orders` prices against
- `src/lib/pricing.ts` — `$/mg` and the mg parser. Client-safe by design: it imports nothing server-only, because the order tray runs in the browser
- `src/app/api/catalogue/route.ts` — the public price list, fetched once by `CartProvider` so a saved order shows current prices. Informs the display only; `/api/orders` still re-prices every line at checkout
- `src/lib/site.ts` — Canonical origin for sitemap, robots, OG and JSON-LD
- `src/components/marketing/ui.tsx` — The primitive set: `Container`, `Section`, `Rail`, `Rule`, `PageHead`, `SectionHead`, `OrderButton`, `OrderLink`, `HairlineLink`, `ArrowLink`, `DataList`, `StatusChip`, `Specimen`, `ResearchNotice`
- `src/components/marketing/Register.tsx` — The catalogue as a ruled table, not a card grid
- `src/components/marketing/PurityPlot.tsx` — Hand-authored inline SVG, no chart library. Renders an honest empty state at zero rows — **never a placeholder curve**
- `src/components/marketing/Structure.tsx` — Inlines the generated SVG so `currentColor` and `--molecule-hetero` resolve against the page
- `src/components/marketing/Logo.tsx` — The wordmark. **The one place brand colour survives**, because it is identity rather than interface and matches the physical artwork
- `src/components/marketing/HelixMark.tsx` — Currently unused by any page. Retained as brand artwork and as the favicon source (`public/axis-labs-mark.svg`). Note a double helix is the nucleic-acid duplex; these are peptides, so it reads as a domain error to the buyer being courted — replacing it is an open brand decision
- `src/components/marketing/SiteNav.tsx` / `SiteFooter.tsx` — **Keep the nav flat.** Four links plus search, order tray and Contact; no dropdowns, no mega-menu. Seven classes over seventeen compounds averages under three each, far below where an intermediary layer earns its place. The classes live in the footer and as filter state on `/products`. Contact must stay in the identical position on every page — WCAG 2.2 SC 3.2.6 is normative at Level A

### Administration (`/admin`)
- `src/lib/content.ts` — the **editable-copy registry**. Every editable string is declared with the text in source as its fallback, so an empty `site_content` table renders exactly what the repo says and a row exists only where something was changed. Reverting a string is a delete, not a re-transcription
- `src/app/admin/content/page.tsx` + `src/components/admin/ContentEditor.tsx` — edit home, release-specification, contact and per-compound copy
- **`checkResearchUse()` is enforced server-side on every save.** Making copy editable without it would let anyone with the admin password turn a compliant catalogue page into a pretextual one. It deliberately does NOT match bare "treat"/"treatment" or bare "cycle" — a treatment group and the cell cycle are ordinary in vitro language, and a guard that blocks correct science just teaches people to work around it
- **The policy pages and the research-use notice are not editable.** They are disclosures and stay in source, where a change is reviewed in a diff
- `src/app/admin/pricing/page.tsx` + `src/components/admin/PricingEditor.tsx` — edit prices, add vial sizes from the standard ladder, and hide a size without deleting its row (historical `order_items` must still resolve to a label)
- `src/lib/admin.ts` — `requireAdmin()`, plus `STANDARD_VIAL_SIZES_MG`. The ladder is a convenience, **not** a constraint: the catalogue already carries a 2 mg vial, a 60 mg vial and three multi-vial kits that are not on it
- `src/app/api/admin/variants/route.ts` — the write path. Validates money as integer cents, re-checks admin, and `revalidatePath`s the affected product pages so a price change is visible immediately rather than after the hourly ISR window
- **Three layers guard this, and all three are deliberate**: the page check (for the person), the API check (the security boundary), and RLS on `product_variants` (the last word — writes require `profiles.role = 'admin'` and every query carries the caller's own session). A page that renders is never a permission
- `/admin` is **not** in `PUBLIC_PREFIXES` and must never be added

**Two rules that bite:**
1. `middleware.ts` lists public routes explicitly, and **route groups never appear in a URL** — `(marketing)` cannot be matched. Every new public route must be added to `PUBLIC_PREFIXES` in the same change that creates it, or it redirects to `/login` in production.
2. Reading cookies opts a route out of static generation. Public data (the lot register) uses `src/lib/supabase/public.ts`, which carries no session and is governed by the same RLS.

### Data pipelines
- `scripts/fetch-molecules.mjs` — Resolves each catalogue slug against PubChem, records formula/mass/CAS/InChIKey, and renders the 2D structure as SVG in our own line weight. Stroke is normalised to each molecule's **median bond length**, not to the viewBox, so a 46-atom tripeptide and a 689-atom peptide look drawn by one hand. Merges into its previous output and retries with backoff, so a transient PubChem failure cannot silently drop a compound
- `scripts/check-no-fabricated-data.mjs` — Runs in `npm run lint`. See the constraint at the top of this file
- `scripts/screenshot.mjs` — Screenshots a running server for visual review

### UI Structure — Dashboard
- `src/app/dashboard/page.tsx` — Dashboard root; renders sidebar + header + section content; sections are lazy-loaded with `next/dynamic`. Protected by `middleware.ts`, not a client-side gate.
- `src/components/Sidebar.tsx` — Navigation sidebar (16 sections grouped into Dashboard / Supply / Demand / Economics / Tokenomics / Methodology)
- `src/components/sections/` — One component per dashboard section
- `src/components/AssumptionsPanel.tsx` — Slide-in panel for tweaking global parameters
- `src/components/ScenarioBar.tsx` — Bear/Base/Bull scenario switcher

### Dashboard sections (in order)
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

Two palettes, one per surface. Do not mix them, and do not use arbitrary hex values in either.

### AXIS LABS site — `axis-*`

Every token resolves through a CSS custom property declared in `globals.css`, so `prefers-color-scheme: dark` re-points the whole system in one place. **There is no decorative accent colour.** Colour on this surface means exactly one thing — that a lot passed, was retained, or was rejected — which is why the primary order control is filled with ink rather than a brand blue.

- `bg-axis-paper` / `bg-axis-sunk` / `bg-axis-plate` — the three grounds. Paper is the page; sunk is an inset register (order panel, form fields, folio); **plate (white) appears only inside a bordered data cell**, so white reads as an object on the page rather than as the page.
- `text-axis-ink` / `-ink-700` / `-ink-500` / `-ink-300` — `ink-300` is the floor. Nothing lighter may carry a word.
- `border-axis-rule-1` / `-rule-2` / `-rule-3` — rule-1 and rule-2 are decorative and sit below 3:1 by design, so they may never carry meaning alone. **Any border that signals state or bounds a control uses rule-3**, which clears 3:1 against all three grounds.
- `text-axis-released` / `-retained` / `-rejected` — lot status only. Always encoded redundantly (glyph + label + colour) so it survives greyscale print and colour-vision deficiency.
- Type: **eight named steps, `.t-1` … `.t-8`**. If a size is not a step, it does not exist — no `text-3xl`, no arbitrary `text-[...]`. Size, leading and tracking are bound together in the step so they cannot drift apart.
- **Weight ceiling: nothing above 500 below 40px, nothing ever 600+.** `font-bold` and `font-extrabold` are banned on this surface; weight-as-hierarchy is the loudest generated-site signal there is.
- `font-grot` (Archivo) for language, `font-data` (Martian Mono) for data. **Mono is a semantic role, not a texture**: formulae, masses, CAS numbers, InChIKeys, lot codes, prices, quantities, dates, column heads. Never nav, buttons, or prose. Add `.data` for tabular figures.
- Spacing is baseline multiples only: 4, 8, 13, 26, 39, 52, 78, 104. No arbitrary values.
- `rounded-plate` (2px) is the only radius. No `rounded-xl`, no shadows on content, no gradients, no texture, no icon libraries — UI marks are glyphs set in the mono.

### Dashboard — `sa-*`

Unchanged, and scoped: the dark inheritance, scrollbar, `select` and range-input styles live under `.dashboard-scope`, applied at the roots of `/dashboard` and the login form. They used to be global and were leaking onto the light marketing surface.

- `bg-sa-bg` / `bg-sa-surface` / `bg-sa-card`, `text-sa-muted`, `border-sa-border`, `text-sa-accent` (#f97316), `text-sa-green` / `-red` / `-blue` / `-purple` / `-yellow`
- Font: `font-mono` (JetBrains Mono) for numeric values

### Motion

One device: the spec line draws itself left-to-right on a `view()` timeline (`.draw`). Every motion rule is authored **inside** `@media (prefers-reduced-motion: no-preference)`, so reduced motion is the absence of the rules rather than an override of them. Zero runtime motion dependencies — no Lenis, no GSAP, no Motion.

**Never hide content behind an entrance animation.** An animation whose start state is hidden leaves real text invisible wherever its timeline does not advance — below the fold, in print, in a browser that resolves the scroller differently. This already happened once: thirteen of seventeen catalogue rows rendered blank.

## Live Data

`public/live-data.json` is regenerated by running:
```bash
node scripts/fetch-live-data.mjs
```
This file is committed and served statically. The `useLiveData` hook reads it at runtime.

## Full-Stack Architecture Map

| Layer | Status | Implementation |
|---|---|---|
| 1. Frontend foundations | ✅ Verified live | Next.js App Router, React, Tailwind. Marketing surface rebuilt on a token layer (`globals.css`) with two self-hosted variable typefaces; zero runtime motion or icon dependencies. WCAG 2.2 AA is the design target — see Styling Conventions |
| 2. APIs & backend logic | ✅ Built | Next.js Route Handlers (`src/app/api/*`); `/api/health` checked live, `/api/profile` not yet called directly (its data path is proven via the DB check below) |
| 3. Database & storage | ✅ Verified live | Supabase Postgres (`profiles` confirmed live). `lots` (0004) is **built but unpopulated** — the register, per-lot pages and purity plot all render honest empty states until real records are loaded. Certificates need a Storage bucket; not created yet |
| 4. Auth, authz, permissions | ✅ Verified live | Supabase Auth (email/password), session cookies via `@supabase/ssr`, `middleware.ts` route protection — full sign-up → confirm → sign-in → logout cycle confirmed working. `profiles.role` column exists for future RBAC checks but nothing enforces roles yet. **Email confirmation is currently OFF** in the Supabase dashboard (Authentication → Providers → Email) to work around the default mailer's rate limit during testing — turn it back on (and/or configure custom SMTP) before real users sign up |
| 5/6. Hosting & compute | ✅ Verified live | Vercel serverless functions, auto-deploys on push to `master` — confirmed across multiple deployments |
| 7. CI/CD & version control | ✅ Working | `.github/workflows/ci.yml` lints+builds on push/PR; every change goes branch → PR → merge → Vercel auto-deploy (its native GitHub integration, not a custom Action) |
| 8. Security & row-level security | ✅ Verified live | Postgres RLS in `0001_init.sql` — confirmed 2 active policies on `profiles`. `lots` (0004) adds public-read-where-published with admin-only writes; **run the migration and confirm its policies before publishing any lot** |
| 9. Rate limiting | ⚙️ Built, not configured | `src/lib/rateLimit.ts`, Upstash Redis — no-ops (never blocks) until `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set; add before this is public-facing |
| 10. Caching & CDN | ⚙️ Platform-provided | Vercel's edge network; `Cache-Control` header set as an example on `/api/health` |
| 11. Load balancing & scaling | ⚙️ Platform-provided | Vercel serverless auto-scaling |
| 12. Error tracking & logs | ⚙️ Built, not configured | Sentry wired into all 3 runtimes (client/server/edge) plus `global-error.tsx` and the middleware/login-form catch blocks — no-ops with a console warning until `NEXT_PUBLIC_SENTRY_DSN` is set; add a real DSN and (optionally) `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN` for source maps before relying on it in production |
| 13. Availability & recovery | ⚙️ Platform-provided | Vercel (multi-region edge, automatic rollback on failed deploys) + Supabase (automated backups; point-in-time recovery requires a paid Supabase plan) |

"Platform-provided" means the layer is handled by Vercel/Supabase's infrastructure with no custom code required, not that it's unimplemented.

## Known gaps, in priority order

These are the things the site is currently writing cheques for. None is a design problem.

1. **No transactional email.** `/api/orders` writes a row and the confirmation page promises an invoice, but nothing sends one and no one is notified an order arrived. This is the largest live gap.
2. **No lot records.** The whole credibility argument routes through a register that is empty. It needs real assays, and a named laboratory (whose name-use consent is a separate question — most contract labs prohibit use of their name in advertising, so `lab_legal_name` is nullable and renders as withheld).
3. **Placeholder pricing.** Every figure in `VARIANTS` is invented, and the `$/mg` column now makes the ladder's inconsistencies visible.
4. **Legal pages need counsel.** `/terms`, `/privacy`, `/shipping-returns` and `/prohibited-use` are written to be accurate about how this site actually behaves, but the contracting entity, governing law and jurisdiction are deliberately deferred to the invoice rather than asserted on the page.
5. **No tests.** Playwright is in `devDependencies` and unused. The cart, the server-side price recomputation and the research-use gate are the paths worth covering first.
