# Development Plan

This document turns the current architecture and contract decisions for `relaynew.ai`
into an execution plan.

## Current Baseline

The following decisions are already in place and should be treated as the starting point:
- system architecture: `docs/ARCHITECTURE.md`
- database schema: `docs/DATABASE_SCHEMA.md`
- public API contract v1: `docs/API_CONTRACT_V1.md`
- routing and rendering split: `docs/ROUTES.md`
- public probe safety model: `docs/PROBE_SECURITY.md`
- initial PostgreSQL migration: `apps/api/db/migrations/0001_initial.sql`

## Current Delivery Status

As of `2026-04-18`, the repository is no longer in greenfield setup mode.

Implemented and in daily use:
- monorepo workspace with `web`, `admin`, `api`, `api-edge`, and `shared`
- shared public contracts, shared submission contracts, and runtime validation
- public website routes for homepage, leaderboard, leaderboard directory, relay detail,
  the `评测方式`, `我们怎么做`, `提交站点`, and `站点测试` pages
- admin routes for relay management, submission review, credentials, sponsors, and prices
- public submission intake with initial bounded verification
- public-safe probe endpoint with compatibility auto-detection and optional override
- Playwright-first browser coverage for public flows, admin flows, metadata smoke,
  and deployed smoke modes

The remaining work is primarily launch hardening and coverage refinement rather than
initial scaffolding.

## Current Reprioritization

The next implementation stage is no longer "add more standalone admin pages".
The priority is to simplify the operator workflow, tighten the relay lifecycle rules,
and reduce the maintenance cost caused by oversized frontend entry files.

### Product Direction

- converge admin operations around two main centers:
  - `提交记录`: current queue + history
  - `Relay`: active/paused list + archived history + full editor
- treat `提交记录` as the review trail rather than the long-term working surface:
  - `pending` submissions stay in the current queue
  - `approved` submissions move to submission history and create or link a relay entry
  - `rejected` and `archived` submissions also live only in submission history
- treat the relay catalog as the long-term operational surface:
  - `active` relays are monitored and may appear in the public directory and leaderboard
  - `paused` relays stay editable and may be reactivated, but are excluded from testing
    and public exposure
  - `archived` relays move out of the main relay list into relay history and may be
    reactivated when needed
- make the relay editor the main place for day-to-day relay maintenance, including:
  - site name
  - site website
  - contact info
  - site description
  - `Base URL`
  - test `API Key`
  - supported models and per-model input/output prices
- let admins manually create relay records directly in the relay catalog rather than
  forcing all entries to originate from public submissions
- keep API key rotation and recovery as admin-only actions attached to the relay
  record or backend workflow, not as a separate primary navigation center

### Engineering Direction

- keep the data model normalized instead of collapsing everything into a single table;
  extend the schema and contracts where needed, such as relay/submission contact info
  and submission-scoped model-price rows
- update backend lifecycle rules so only `relays.status = 'active'` enters scheduled
  monitoring, public directory reads, and leaderboard snapshots
- refactor `apps/admin` and `apps/web` by page and feature boundaries so oversized
  `app.tsx` files are split into route pages, feature modules, shared hooks, and
  reusable presentation components
- preserve Chinese-first UX for operators, normal users, and relay operators while
  restructuring the code and information architecture
- expand acceptance coverage around the full approval-to-public path, especially:
  - submission approval moving records into history
  - manual relay creation
  - relay pause/archive/reactivation
  - active-only public visibility and monitoring

### Desktop Web UI Polish Plan

The next public-web polish pass should prioritize desktop readability and visual
hierarchy before any further mobile-specific refresh.

Primary findings from the current desktop audit:
- page containers, data cards, and helper cards overuse the same warm `panel` and
  `surface-card` treatment, flattening visual hierarchy
- large Chinese headlines are set too tightly, while many helper labels rely on
  very small uppercase mono text that feels cramped and noisy
- the homepage hero, leaderboard hero, and submit-page hero each compete with nearby
  functional modules instead of establishing one clear desktop focal point
- explanatory copy is often split across multiple medium-weight cards, pushing the
  main task content below the fold on desktop
- information pages such as `评测方式` and `我们怎么做` read like card stacks rather than
  designed editorial pages

Execution order for the desktop polish pass:
1. shared visual system
   - reduce decorative density in secondary cards
   - establish clearer tiers for page shell, primary task blocks, and helper blocks
   - relax desktop headline spacing and reduce reliance on ultra-small uppercase labels
2. homepage and leaderboard
   - keep one obvious hero focal point
   - demote helper explanations so rankings and discovery remain the first desktop task
   - distinguish sponsor presentation more clearly from natural ranking previews
3. submit, probe, and relay detail
   - simplify nested card structures
   - make public forms feel like guided consumer workflows rather than admin tooling
   - give result and detail pages clearer desktop reading order
4. methodology and governance content
   - keep `评测方式` as the single information page and merge `我们怎么做` into grouped, comparative sections

Acceptance goals for the desktop pass:
- each first screen should present one clear primary action or information target
- helper copy should no longer outweigh the main task content on desktop
- sponsor, ranking, explanation, and form surfaces should feel visually distinct
- Playwright coverage should continue to pass for critical public flows and metadata

## Delivery Principles

- keep the MVP simple and explicit
- use TypeScript across frontend and backend
- default the public site and admin tooling to Simplified Chinese for user-facing copy
- public pages should read snapshots or aggregate tables, not raw probe rows
- sponsor placement must remain separate from natural ranking
- public probe work must follow `docs/PROBE_SECURITY.md`
- testing should follow `docs/TESTING_STRATEGY.md`
- default to Playwright-first acceptance coverage and keep non-E2E tests narrow
- prefer shipping thin vertical slices over building all infrastructure up front
- treat Chinese UX polish, public cache behavior, and launch hardening as explicit release work

## Phase 1: Repository And Workspace Foundation

Goal:
- create a clean monorepo foundation for `web`, `admin`, `api`, and `shared`

Work items:
- initialize git repository
- create workspace root files
  - `package.json`
  - `pnpm-workspace.yaml`
  - `tsconfig.base.json`
  - `.gitignore`
- create base directories
  - `apps/admin`
  - `apps/web`
  - `apps/api`
  - `packages/shared`

Exit criteria:
- workspace installs successfully
- repository structure matches the documented architecture

## Phase 2: Shared Contract, Type, And Validation Layer

Goal:
- turn the public API contract into shared TypeScript definitions and runtime validation

Work items:
- define shared enums
  - `healthStatus`
  - `supportStatus`
  - `badge`
  - `region`
- define shared `Zod` enums for the same contract primitives
- define shared response types
  - `HomeSummaryResponse`
  - `LeaderboardResponse`
  - `RelayOverviewResponse`
  - `RelayHistoryResponse`
  - `RelayModelsResponse`
  - `RelayPricingHistoryResponse`
  - `RelayIncidentsResponse`
  - `MethodologyResponse`
- define shared `Zod` response schemas for the same public payloads
- define shared request and query schemas where the contract needs runtime validation
  - leaderboard query
  - relay history query
  - relay pricing-history query
  - relay incidents query
  - public probe request shape
- define shared probe enums and response fields
  - `compatibilityMode`
  - `detectionMode`
  - public probe diagnostic response fields such as `usedUrl` and `attemptedModes`
- export reusable payload fragments such as relay summary, score summary, and incident summary
- add shared contract smoke tests for representative request and response payloads

Exit criteria:
- `packages/shared` exports both TypeScript types and runtime validation schemas
- `apps/web` and `apps/api` consume the same shared contract package
- public API field names and validation rules are no longer implicit in implementation code
- representative contract payloads parse successfully through shared runtime schemas

## Phase 3: API Service Foundation

Goal:
- stand up the backend service and connect it to PostgreSQL

Work items:
- scaffold `Fastify + TypeScript`
- add configuration and environment loading
- add PostgreSQL connection setup
- add migration apply workflow
- create database access layer and route registration layout
- implement first public endpoints
  - `GET /public/home-summary`
  - `GET /public/leaderboard/:modelKey`
- implement next simple read endpoints
  - `GET /public/relay/:slug/overview`
  - `GET /public/methodology`

Exit criteria:
- backend boots locally
- backend connects to PostgreSQL
- initial public endpoints return contract-shaped JSON

## Phase 4: Public Web Foundation

Goal:
- render the public site shell, deploy it through Cloudflare Workers Static Assets,
  and connect it to real public APIs

Work items:
- scaffold `React Router v7 + TypeScript + Tailwind + shadcn/ui`
- wire Cloudflare Workers runtime target
- implement client-rendered routing for:
  - `/`
  - `/leaderboard/:modelKey`
  - `/relay/:slug`
  - `/methodology`
- build first page slices
  - homepage using `/public/home-summary`
  - leaderboard using `/public/leaderboard/:modelKey`
  - relay overview shell using `/public/relay/:slug/overview`
- default public route copy and empty states to Simplified Chinese
- add Playwright smoke coverage for homepage, leaderboard, and relay overview

Exit criteria:
- public pages render with live API data
- SPA route boundaries and browser flows match `docs/ROUTES.md`
- critical public page flows pass browser-based smoke coverage

## Phase 5: Relay Detail Integration

Goal:
- complete the relay detail page against contract-shaped APIs, even before live monitoring
  producers become authoritative

Work items:
- implement API endpoints
  - `GET /public/relay/:slug/history`
  - `GET /public/relay/:slug/models`
  - `GET /public/relay/:slug/pricing-history`
  - `GET /public/relay/:slug/incidents`
- implement page modules for:
  - history charts
  - supported models
  - pricing history
  - incident timeline
- keep overview as the first-paint payload and load secondary modules after hydration
- use seeded rows or fixture snapshot/aggregate data for relay history and incidents
  until Phase 6 live monitoring jobs are operating
- add Playwright acceptance coverage for relay detail modules

Exit criteria:
- relay detail page covers all modules defined in `docs/ROUTES.md`
- page reads come from documented sources in `docs/DATABASE_SCHEMA.md`
- relay detail APIs and page modules are contract-complete even if some data is still
  fixture-backed for development
- relay detail browser coverage validates the seeded or fixture-backed experience

## Phase 6: Monitoring, Aggregation, And Snapshots

Goal:
- make the system produce live monitoring data rather than serving only static or seeded content

Work items:
- implement scheduler using `node-cron`
- implement platform probe runner for fixed server-controlled checks
- persist and reuse relay compatibility metadata so known relays do not require
  full auto-detection on every scheduled probe
- write raw probe results to PostgreSQL
- build aggregation jobs for:
  - `relay_status_5m`
  - `relay_latency_5m`
  - `relay_score_hourly`
- build snapshot jobs for:
  - `home_summary_snapshots`
  - `leaderboard_snapshots`
  - `relay_overview_snapshots`
- implement incident generation and persistence for `incident_events`

Exit criteria:
- public leaderboard and overview data can be rebuilt from actual probe results
- homepage and leaderboard content can be served from snapshots
- relay detail history and incident endpoints are backed by live rollups and incident
  generation instead of seed-only development data

## Phase 7: Public Probe Flow

Goal:
- expose the self-check probe flow safely

Work items:
- implement `POST /public/probe/check`
- enforce URL validation and outbound restrictions from `docs/PROBE_SECURITY.md`
- implement a server-owned probe adapter registry with model-family-based auto detection
- support an optional explicit `compatibilityMode` override for advanced users
- add secret redaction and bounded logging rules
- add Cloudflare-side rate limiting and optional Turnstile gating
- build `/probe` UI against the dedicated public-safe endpoint
- add Playwright coverage for the main public probe page flows
- add adapter-level tests for compatibility detection and failure classification
- add probe security tests for:
  - URL normalization and validation
  - DNS and IP blocking of disallowed ranges
  - redirect re-validation
  - timeout and bounded-response behavior
  - authorization redaction in logs and error handling

Exit criteria:
- public probe endpoint is isolated from internal probe paths
- no user-supplied API key is persisted by default
- endpoint behavior respects the documented SSRF and abuse controls
- the probe UI defaults to model-driven auto detection and exposes a safe advanced
  compatibility override
- browser coverage validates the public probe UX for success and failure states
- probe security tests pass for the controls required by `docs/PROBE_SECURITY.md`

## Phase 8: Admin, Submit, And Sponsor Operations

Goal:
- provide the minimum operational tooling needed to run the site, then simplify that
  tooling into a smaller day-to-day operator surface

Work items:
- reshape admin routes around the long-term target workflow:
  - submission queue
  - submission history
  - relay list
  - relay history
  - relay editor
  - sponsor placement management
  - low-frequency model settings when needed
- localize admin, submit, and probe experiences for Chinese operators and users
- allow operators to inspect and, when necessary, override a relay's stored
  compatibility mode without changing natural ranking logic
- implement submit flow for relay intake
- extend the public `/submit` form and the relay editor so both can express:
  - site name
  - site website
  - contact info
  - site description
  - `Base URL`
  - test `API Key`
  - repeatable model/price rows with `model`, `input price`, and `output price`
- make approval move a submission out of the current queue and into submission history
  while creating or linking the relay record in the relay catalog
- allow admins to create relay records manually without a preceding public submission
- treat relay API key rotation and recovery as relay-owned operations rather than a
  separate primary workspace
- enforce that only active relays participate in monitoring, public directory views,
  and leaderboard generation
- ensure sponsor placement is rendered separately from natural ranking
- treat `sponsors` as the public source of truth for paid placement windows
- add Playwright acceptance coverage for critical admin operations

Exit criteria:
- operators can review pending submissions, inspect historical review outcomes, and
  maintain relay catalog data from a smaller navigation surface
- approved submissions no longer remain in the active intake list after handoff
- only active relays are probed and exposed publicly
- sponsor workflow does not affect natural ranking logic
- critical admin flows pass browser-based acceptance coverage

## Phase 9: Deployment And Launch Hardening

Goal:
- prepare the project for stable staging and production deployment

Work items:
- deploy `apps/web` to Cloudflare Workers
- deploy `apps/api` to the remote server with Docker Compose
- configure `relaynew.ai`, `api.relaynew.ai`, and `admin.relaynew.ai`
- configure Cloudflare cache rules, WAF, and access control
- finalize environment variable management
- add deployment and operational runbooks
- verify public cache headers, Chinese UX consistency, and page-level SEO metadata
- run staging Playwright smoke coverage before launch

Exit criteria:
- the full stack is deployable end to end
- public pages, API, and admin surfaces are accessible through the intended domains
- staging validation covers the critical public, probe, and admin flows

## Milestones

### M1: Workspace Ready
- repository initialized
- monorepo scaffolded
- shared package created

### M2: First Public APIs
- API service running
- home summary and leaderboard endpoints implemented

### M3: Public Site First Slice
- homepage and leaderboard page render live data
- relay detail first-paint overview works

### M4: Relay Detail Integrated
- history, models, pricing history, and incident timeline are contract-complete
- relay detail works against seeded or fixture-backed data where live producers are
  not yet authoritative

### M5: Real Monitoring Data
- probe scheduler, aggregation jobs, and snapshots are operating
- relay detail history and incident data are backed by live monitoring outputs

### M6: Operations And Launch
- probe page, admin tools, submit flow, and deployment stack are ready

## Immediate Next Steps

The most efficient next implementation sequence is:
1. land the simplified admin and relay lifecycle plan in the planning docs, then align
   schema and shared contracts around submission history, relay statuses, contact info,
   and model-price rows
2. rebuild the admin information architecture around `提交记录` and `Relay` so approval,
   rejection, archiving, manual relay creation, and relay editing follow one consistent
   Chinese-first workflow
3. tighten backend rules so only active relays are monitored and appear in the public
   directory and leaderboard
4. split oversized `apps/admin/src/app.tsx` and `apps/web/src/app.tsx` into page and
   feature modules before expanding the operator UI further
5. extend Playwright and API coverage around approval handoff, paused/archived relays,
   relay reactivation, and public visibility gating

## Notes

- if implementation reveals a new unresolved architecture or contract gap, record it in
  `docs/OPEN_DESIGN_ISSUES.md`
- if a breaking public contract change becomes necessary, update `docs/API_CONTRACT_V1.md`
  before implementing it
