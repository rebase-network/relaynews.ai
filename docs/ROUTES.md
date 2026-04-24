# Routes

This document lists the current route structure for `relaynew.ai`, the rendering mode
for each route, and the primary data source that should back it.

## Rendering Rules

- use CSR for the current MVP frontend deployed through Cloudflare Workers Static Assets
- keep the public site on `relaynew.ai` and the admin app on `a.relaynew.ai`
- keep public route data boundaries clean so SSR or pre-render can be added later if needed
- keep page data reads on snapshots or aggregate tables when possible
- do not expose an admin entry in the public site navigation
- default user-facing navigation, labels, and help copy to Simplified Chinese

## Public Routes

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/` | Homepage with hero CTA, quick test entry, leaderboard previews, and sponsor highlights | CSR in public SPA | `GET /public/home-summary` |
| `/leaderboard` | Default full leaderboard view for the primary model category | CSR in public SPA | `GET /public/leaderboard/:modelKey` |
| `/leaderboard/directory` | Directory for browsing all tracked model categories | CSR in public SPA | `GET /public/leaderboard-directory` |
| `/leaderboard/:modelKey` | Main leaderboard for one model category | CSR in public SPA | `GET /public/leaderboard/:modelKey` |
| `/relay/:slug` | Relay detail page with overview, 30-day history, and supported-model pricing summary | CSR in public SPA | `GET /public/relay/:slug/overview`, `GET /public/relay/:slug/history`, `GET /public/relay/:slug/models`, `GET /public/relay/:slug/pricing-history` |
| `/methodology` | Public explanation of the `评测方式` page, plus merged sponsor separation, intake, and review rules | CSR in public SPA | static content or `GET /public/methodology` |
| `/policy` | Legacy compatibility redirect to the merged `我们怎么做` section on `/methodology` | CSR redirect in public SPA | none |
| `/submit` | Public submission entry with initial automated verification | CSR in public SPA | `POST /public/submissions` |

## Tooling Routes

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/probe` | Public `站点测试` flow with model-first auto detection and optional advanced override | CSR | `POST /public/probe/check` |

## API Surface Split

The current backend transport boundary is split into three practical surfaces.

### Public content APIs

These are the read-only, page-facing content endpoints documented in
`docs/API_CONTRACT_V1.md`.

Rules:

- owned by `apps/api/src/routes/public.ts`
- cacheable under the public CDN policy
- should stay read-only and page-shaped rather than exposing raw monitoring rows

### Public write-style endpoints

These are still public-facing, but they behave like bounded write or diagnostic flows:

- `POST /public/probe/check`
- `POST /public/submissions`

Rules:

- not cacheable like content reads
- `POST /public/probe/check` stays isolated for SSRF-sensitive self-check logic
- `POST /public/submissions` belongs to the public boundary, not the admin boundary
- user-supplied probe keys from `/probe` should not be persisted by default
- submission-scoped `testApiKey` values may be persisted for the review workflow

### Admin APIs

These power the admin SPA and should never be CDN-cached:

- `/admin/overview`
- `/admin/relays`
- `/admin/submissions`
- `/admin/probe-credentials`
- `/admin/sponsors`
- `/admin/prices`
- `/admin/models`
- `/admin/refresh-public`

Rules:

- owned by `apps/api/src/routes/admin.ts`
- protected by admin authorization
- `GET /admin/overview` currently acts mainly as the auth/bootstrap probe before
  the SPA lands on `/relays`

## Admin Routes (`a.relaynew.ai`)

These routes live on the dedicated admin hostname. They are not mirrored under
`relaynew.ai/admin`.

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/` | Admin auth/bootstrap entry that redirects to `/relays` | CSR in admin SPA | `GET /admin/overview` (bootstrap only) |
| `/relays` | Active / paused Relay catalog, manual relay creation, and full relay editor | CSR in admin SPA | `GET /admin/relays` |
| `/relays/history` | Archived Relay history and reactivation entry | CSR in admin SPA | `GET /admin/relays` |
| `/intake` | Pending submission queue for new Relay submissions | CSR in admin SPA | `GET /admin/submissions` |
| `/intake/history` | Approved / rejected / archived submission history | CSR in admin SPA | `GET /admin/submissions` |
| `/sponsors` | Pick active Relay rows for the sponsor showcase and remove them when needed; the current UI does not expose placement or time-window editing | CSR in admin SPA | `GET /admin/sponsors` |
| `/models` | Model catalog management centered on model key, inferred vendor/family, activation, price units, and delete actions | CSR in admin SPA | `GET /admin/models` |

### Secondary Admin Routes

These routes still exist, but they are no longer shown in the primary admin navigation
and are used mainly as direct maintenance / debugging surfaces.

| Route | Purpose | Render | Primary Data Source |
|---|---|---|---|
| `/credentials` | Direct credential debugging, rotation, revoke, and reprobe controls | CSR in admin SPA | `GET /admin/probe-credentials` |
| `/prices` | Legacy direct price-record maintenance surface | CSR in admin SPA | `GET /admin/prices` |

### Admin Intake Flow

The expected operator path is:

1. a submitter creates a pending record through `/submit` with relay metadata,
   contact info, model-price rows, and a test key
2. the initial bounded verification stays attached to the submission record, and
   the submitted model-price rows are stored as submission-scoped data
3. an admin reviews the submission on `/intake`
4. `Approve & activate` creates or links the relay, copies the approved metadata and
   model-price rows into the relay catalog, moves the active credential to that relay,
   flips the relay to `active`, runs the first relay-owned monitoring probe, and refreshes
   public snapshots
5. the reviewed submission then leaves the active queue and is visible under `/intake/history`
6. rejected or archived submissions also live only in `/intake/history`
7. only relays with `status = active` enter scheduled monitoring and public exposure;
   `paused` relays stay editable but remain off the public surface, and `archived`
   relays move to `/relays/history`
8. `/credentials` and `/prices` remain secondary operator tools rather than the
   normal approval handoff path

## Homepage Modules

The homepage is expected to include:
- hero copy with primary CTA and quick-test entry
- featured model leaderboard blocks
- a bridge into `评测方式` and the merged `我们怎么做` section
- sponsor highlight cards

For MVP, homepage data should be built and served as one atomic page-shaped snapshot
payload rather than independently refreshed module fragments.
The snapshot may still carry additional aggregate fields such as `latestIncidents`,
but the current public homepage does not render a dedicated incidents section.

## Leaderboard Page Modules

The leaderboard page is expected to include:
- model header and last measured time
- direct access from `/leaderboard` without forcing a directory click first
- a secondary link to the full model directory
- ranked table with score, availability, latency, and price
- model switch pills for tracked categories
- explicit sponsor separation messaging for `评测排名`
- links to `评测方式` and the merged `我们怎么做` section

## Relay Detail Page Modules

The relay detail page is expected to include:
- relay identity and endpoint summary
- current health snapshot
- 30-day latency and availability charts
- supported models list enriched with the latest known input / output price
- explanatory badges and score summary
- no standalone `价格历史` or `事故时间线` block in the current shipped UI, even
  though the backend still exposes those APIs

### Relay Detail Loading Boundary

First-paint critical:
- overview identity and endpoint summary
- current `healthStatus`
- 24h summary metrics
- score summary and badges

Hydration or secondary loads:
- history chart buckets
- supported models list
- pricing enrichment for the supported-model table

## Test Page Modules (`/probe`)

The test page is expected to include:
- a primary form with `Base URL`, `API Key`, and `模型`
- an advanced section with an optional `Compatibility Mode` selector
- an explicit deep-scan action for advanced users who want to enumerate all bounded
  compatible modes instead of stopping at the first match
- a diagnostic result panel that shows host, connectivity, protocol status, TTFB, and
  first-token timing when available
- explanatory output such as detected compatibility mode, selected endpoint, and next
  steps when automatic detection fails

### Test Interaction Rules

- the default path should not require users to classify the relay manually
- the advanced compatibility selector should use a fixed enum, not arbitrary free text
- if a compatibility override is selected, the server should test only that mode
- if the flow runs in auto mode, the response should make the detected mode explainable
- if the user explicitly triggers a deep scan in auto mode, the response may include
  all matched bounded compatibility modes, not just the first match

## Data Contract Notes

- public content payload shapes and field rules live in `docs/API_CONTRACT_V1.md`
- `/probe` must only call the public-safe test endpoint described in
  `docs/PROBE_SECURITY.md`
- public directory, leaderboard, and relay detail routes should only read relays with
  `status = active`
- approving a submission should activate the relay, move the reviewed submission to
  history, transfer the active credential to the target relay owner, and trigger the
  first relay-owned monitoring run
- `/submissions` may remain as a compatibility redirect to `/intake`, but new operator
  links should point at `/intake`
- admin routes on `a.relaynew.ai` should never rely on CDN-cached responses
