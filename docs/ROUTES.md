# Routes

This document lists the planned route structure for `relaynew.ai`, the rendering mode
for each route, and the primary data source that should back it.

## Rendering Rules

- use CSR for the current MVP frontend deployed through Cloudflare Workers Static Assets
- keep the public site on `relaynew.ai` and the admin app on `admin.relaynew.ai`
- keep public route data boundaries clean so SSR or pre-render can be added later if needed
- keep page data reads on snapshots or aggregate tables when possible
- do not expose an admin entry in the public site navigation

## Public Routes

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/` | Homepage with status summary, model leaderboard previews, and recent updates | CSR in public SPA | `GET /public/home-summary` |
| `/leaderboard` | Default full leaderboard view using the primary model lane | CSR in public SPA | `GET /public/leaderboard/:modelKey` |
| `/leaderboard/directory` | Model lane directory for browsing all tracked boards | CSR in public SPA | `GET /public/leaderboard-directory` |
| `/leaderboard/:modelKey` | Main leaderboard for a model | CSR in public SPA | `GET /public/leaderboard/:modelKey` |
| `/relay/:slug` | Relay detail page with overview and trend charts | CSR in public SPA | `GET /public/relay/:slug/overview`, `GET /public/relay/:slug/history`, `GET /public/relay/:slug/models`, `GET /public/relay/:slug/pricing-history`, `GET /public/relay/:slug/incidents` |
| `/methodology` | Ranking and scoring explanation | CSR in public SPA | static content or `GET /public/methodology` |
| `/submit` | Relay submission entry point with initial bounded verification | CSR in public SPA | `POST /public/submissions` |

## Tooling Routes

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/probe` | User self-check probe flow with model-first auto detection and optional advanced override | CSR | `POST /public/probe/check` |

## Admin Routes (`admin.relaynew.ai`)

These routes live on the dedicated admin hostname. They are not mirrored under
`relaynew.ai/admin`.

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/` | Admin dashboard landing page | CSR in admin SPA | `GET /admin/overview` |
| `/relays` | Relay review and metadata management | CSR in admin SPA | `GET /admin/relays` |
| `/submissions` | Submission review queue | CSR in admin SPA | `GET /admin/submissions` |
| `/credentials` | Probe credential management with rotation and reprobe controls | CSR in admin SPA | `GET /admin/probe-credentials` |
| `/sponsors` | Sponsor placement management | CSR in admin SPA | `GET /admin/sponsors` |
| `/prices` | Price record management | CSR in admin SPA | `GET /admin/prices` |

## Homepage Modules

The homepage is expected to include:
- hero summary with total relay count and current health snapshot
- featured model leaderboard blocks
- latest incident or degradation events
- highlighted relays or curated picks
- methodology and trust signals

For MVP, homepage data should be built and served as one atomic page-shaped snapshot
payload rather than independently refreshed module fragments.
When `latestIncidents` is non-empty, it should use the incident summary shape defined
in `docs/API_CONTRACT_V1.md`.

## Leaderboard Page Modules

The leaderboard page is expected to include:
- model header and last measured time
- direct access from `/leaderboard` without forcing a directory click first
- a secondary link to the full model lane directory
- ranked table with score, availability, latency, and price
- filters for region and result limits
- sponsor placement section separated from natural rankings
- methodology link and ranking notes

## Relay Detail Page Modules

The relay detail page is expected to include:
- relay identity and endpoint summary
- current health snapshot
- 24h and 7d latency and availability charts
- supported models list
- pricing summary and history
- incident timeline
- explanatory badges and score summary

### Relay Detail Loading Boundary

First-paint critical:
- overview identity and endpoint summary
- current `healthStatus`
- 24h summary metrics
- score summary and badges

Hydration or secondary loads:
- history chart buckets
- supported models list
- pricing history
- incident timeline

## Probe Page Modules

The probe page is expected to include:
- a primary form with `Base URL`, `API key`, and `Target model`
- an advanced section with an optional `Compatibility Mode` selector
- a diagnostic result panel that shows host, connectivity, protocol status, and latency
- explanatory output such as detected compatibility mode, selected endpoint, and next
  steps when automatic detection fails

### Probe Interaction Rules

- the default path should not require users to classify the relay manually
- the advanced compatibility selector should use a fixed enum, not arbitrary free text
- if a compatibility override is selected, the server should probe only that mode
- if the probe runs in auto mode, the response should make the detected mode explainable

## Data Contract Notes

- `/public/home-summary` should return homepage modules that are already aggregated
- `/public/leaderboard/:modelKey` should return a ready-to-render row list
- `/public/relay/:slug/overview` should return a single summary payload for first paint
- `/public/relay/:slug/history` should return chart buckets, not raw probe rows
- `/public/relay/:slug/models` should return supported model rows only
- `/public/relay/:slug/pricing-history` should return price change points or chart-ready buckets
- `/public/relay/:slug/incidents` should return timeline-ready incident records
- `/probe` must only call the public-safe probe endpoint described in `docs/PROBE_SECURITY.md`
- `/public/probe/check` should accept an optional `compatibilityMode` override while
  still defaulting to model-driven automatic detection
- `/public/submissions` should require `testApiKey` and `testModel`, store them in a
  rotation-friendly credential record, and return a concise initial probe summary
- approving a submission should move the active credential from the submission owner
  into the target relay owner rather than duplicating keys across tables
- admin routes on `admin.relaynew.ai` should never rely on CDN-cached responses
