# Architecture

## Goal

Build a public website for API relay monitoring, pricing, latency, service health,
and leaderboard discovery.

The product should:
- publish public leaderboards for relays and models
- show relay health, latency, price, and incident history
- provide a self-check probe tool for user-supplied API endpoints
- support future paid placements without mixing them into natural rankings
- follow the visual system defined in `DESIGN.md`

## Current Decisions

### Product Shape
- Public website with leaderboard, relay detail, methodology, submit, and probe pages
- Public ranking based on availability, latency, protocol consistency, value, and trend stability
- Public pages should be indexable and shareable
- Probe and admin flows can favor interaction over SEO
- The public probe should stay model-first by default and use compatibility auto-detection
  with an optional advanced override
- Relay detail pages use a small first-paint contract and can progressively load
  secondary modules after hydration

### Technology Stack
- Frontend: React Router v7 + TypeScript + Tailwind + shadcn/ui
- Frontend hosting/runtime: Cloudflare Workers Static Assets
- API edge: Cloudflare Worker custom domain proxy
- Backend: Node.js + Fastify + TypeScript
- API deployment runtime: Docker Compose on the remote server
- Database: PostgreSQL
- Query layer: Kysely
- Validation: Zod
- Scheduling: node-cron
- Logging: pino

### Explicit Non-Goals For MVP
- No Next.js
- No Cloudflare KV
- No Cloudflare R2
- No Redis
- No microservice split
- No heavy real-time streaming architecture

## High-Level Topology

```txt
Browser
  -> relaynew.ai
     -> Cloudflare Workers Static Assets
        - built web app assets
        - SPA fallback routing
        - client-side data fetches
        - calls public API at api.relaynew.ai

  -> admin.relaynew.ai
     -> Cloudflare Workers Static Assets
        - built admin app assets
        - SPA fallback routing
        - client-side admin data fetches
        - calls admin APIs at api.relaynew.ai

  -> api.relaynew.ai
     -> Cloudflare Worker custom domain
        - product-owned hostname
        - request proxy to dedicated tunnel
        -> Cloudflare Tunnel
           -> API Service (remote server)
              - public API
              - internal/admin API
              - probe scheduler
              - probe runner
              - aggregation jobs
              - dedicated PostgreSQL
```

## Runtime Responsibilities

### Cloudflare Workers Static Assets
The Worker layer is the web runtime for the frontend app deployment, but the MVP is
currently shipped as static assets with SPA routing rather than edge SSR.
It is responsible for:
- serving the frontend application
- serving SPA fallback routes for browser navigation
- calling public API endpoints
- edge-level headers, caching integration, and request shaping

It is not responsible for:
- storing business state
- running probe jobs
- writing high-frequency monitoring data
- replacing the backend API

### Cloudflare API Edge
Cloudflare sits in front of `api.relaynew.ai` and handles:
- TLS
- WAF
- rate limiting
- cache rules for public read APIs
- DDoS protection

The API custom domain currently resolves to a lightweight Worker that forwards
requests through a VPC network binding to the dedicated Cloudflare Tunnel owned
by the same account.
This keeps the product independent from the legacy tunnel on the remote host.

Important note: Cloudflare proxy does not automatically cache JSON APIs in the desired way.
Public `GET` endpoints must be made cacheable with explicit cache rules and/or
`Cloudflare-CDN-Cache-Control` headers.

### API Service
The API service runs on the remote server and is the core application backend.
It is responsible for:
- public read APIs for the website
- a dedicated public-safe probe endpoint
- a compatibility-detection registry for public and platform probe flows
- internal write APIs for probes and background jobs
- admin APIs
- probe scheduling and execution
- aggregation and score generation
- snapshot generation for leaderboard and overview pages
- PostgreSQL read and write operations

For the MVP, the service is packaged as a Docker image and managed through Docker
Compose on the remote host. This keeps deployment repeatable without adding another
process manager layer.

### PostgreSQL
PostgreSQL is the source of truth for structured data.
It stores:
- relay metadata
- model metadata
- relay-model support matrix
- price history and current price
- raw probe results
- aggregated monitoring windows
- incident events
- leaderboard snapshots
- homepage snapshots
- relay overview snapshots

## State Taxonomy

Three different state concepts exist in the system and should not share a single
meaning in application code:

- `catalog status`: relay listing lifecycle, stored on `relays.status`
- `support status`: relay-model support lifecycle, stored on `relay_models.status`
- `health status`: measured runtime state shown on public pages; API payloads should
  expose this as `healthStatus`

Shared types and API payloads should use explicit names such as `catalogStatus`,
`supportStatus`, and `healthStatus` when the distinction matters.

## Probe Compatibility Taxonomy

Probe and relay compatibility logic should use explicit names rather than a vague
`apiType` string.

Recommended terms:
- `modelFamily`: the broad family inferred from the submitted target model
- `compatibilityMode`: the concrete protocol adapter used for a relay probe
- `detectionMode`: whether the probe used automatic detection or an explicit override

The product should default to `detectionMode=auto` for the public probe UI, while still
allowing an advanced explicit compatibility override when needed.

For the MVP, `compatibilityMode` should stay constrained to a small server-owned enum
instead of arbitrary free text.

## Rendering Strategy

The MVP currently uses a client-rendered SPA deployed on Cloudflare Workers Static
Assets.

### Current Route Model
- public routes render through the public SPA shell on `relaynew.ai` and fetch data
  from the backend API
- admin routes render through a separate admin SPA shell on `admin.relaynew.ai`
- probe flows and chart modules stay client-rendered
- the probe page should default to URL + key + model input, with compatibility override
  hidden behind advanced controls

### Forward Compatibility
- keep public route data contracts explicit so edge rendering or pre-render can be
  added later without changing the backend API shape
- prefer route modules and page composition that can evolve toward SSR if SEO needs
  become stronger after the MVP

## Caching Strategy

The MVP uses one main cache layer only: Cloudflare CDN cache.

### Cacheable Endpoints
Public read-only endpoints under `/public/*` should be cacheable.
Examples:
- `/public/home-summary`
- `/public/leaderboard/:modelKey`
- `/public/relay/:slug/overview`
- `/public/relay/:slug/history`
- `/public/relay/:slug/models`
- `/public/relay/:slug/pricing-history`
- `/public/relay/:slug/incidents`
- `/public/methodology`

### Suggested Response Headers

```http
Cache-Control: public, max-age=15
Cloudflare-CDN-Cache-Control: public, max-age=60, stale-while-revalidate=300, stale-if-error=600
```

### Rules
- cache only `GET`
- never cache admin or internal endpoints
- avoid `Set-Cookie` on public endpoints
- purge by URL or tag after snapshot rebuilds when necessary

## Monitoring Data Flow

```txt
node-cron scheduler
  -> enqueue logical probe run
  -> load relay compatibility metadata when available
  -> probe runner executes checks
     - use stored compatibility mode when known
     - run compatibility detection when unknown or under review
     - connectivity
     - model availability
     - non-stream completion
     - stream completion
     - latency / TTFB / outcome / usage
  -> write raw probe result rows
  -> persist compatibility metadata updates for catalog relays when confidence is high
  -> aggregation jobs persist 5-minute health and latency windows
  -> score jobs compute and persist hourly relay scores
  -> public history APIs derive 24h / 7d / 30d responses from persisted rollups
  -> snapshot jobs write homepage, leaderboard, and relay overview snapshots
  -> public API reads snapshots and aggregated tables
  -> Cloudflare CDN caches public responses
```

MVP assumption:
- the API deployment is single-instance while `node-cron` owns scheduling
- if the API deployment becomes multi-instance later, probe scheduling and
  snapshot rebuilds must use PostgreSQL-backed coordination such as advisory locks
  or leased job rows

## Data Retention

- raw probe results: keep 7 days
- aggregated 5-minute windows: keep longer than raw data
- hourly and daily summaries: keep significantly longer for charts and reporting
- snapshots: keep current rows and a small version history if useful

## Security Model

- `relaynew.ai` serves the public site via Cloudflare Workers Static Assets
- `api.relaynew.ai` sits behind a product-owned Cloudflare Worker and dedicated tunnel
- `admin.relaynew.ai` is the dedicated administrative entry point
- the public site should not expose an admin navigation entry
- admin endpoints should be protected with API-level auth at minimum, and Cloudflare
  Access can be layered on later if the static admin assets should also stay private
- the public probe flow must use a dedicated public-safe endpoint rather than any
  generic internal probe surface
- the public probe flow should rely on server-owned compatibility adapters instead of
  arbitrary client-specified request templates
- the public probe flow must apply DNS, IP, redirect, timeout, concurrency, rate,
  and payload-size controls before any outbound request is made
- probe keys used by the platform must never be exposed to the frontend
- user-supplied probe keys should not be persisted by default
- public ranking and paid placement must remain clearly separated
- public sponsor rendering must treat `sponsors` as the authoritative source of
  active paid placement windows

See `docs/PROBE_SECURITY.md` for the public probe threat model and required controls.

## Repository Direction

Recommended monorepo shape:

```txt
apps/
  admin/     # admin frontend app
  api-edge/  # Cloudflare Worker for API custom domain proxy
  web/       # Cloudflare Workers Static Assets frontend app
  api/       # Fastify backend app
packages/
  shared/    # shared types, schemas, constants
```

## MVP Delivery Order

1. finalize routes and information architecture
2. finalize database schema and API contracts
3. scaffold frontend and backend apps
4. implement public snapshots and public pages
5. implement probe scheduler and aggregation jobs
6. add submit flow and admin tools

## Notes

- The current frontend delivery model is a SPA on Cloudflare Workers Static Assets.
- Public route contracts should stay compatible with a future move to edge rendering
  if the product later needs stronger SEO guarantees.
- The frontend runtime target remains Cloudflare Workers rather than a Node-only
  frontend server.
