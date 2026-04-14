# Development Plan

This document turns the current architecture and contract decisions for `relaynews.ai`
into an execution plan.

## Current Baseline

The following decisions are already in place and should be treated as the starting point:
- system architecture: `docs/ARCHITECTURE.md`
- database schema: `docs/DATABASE_SCHEMA.md`
- public API contract v1: `docs/API_CONTRACT_V1.md`
- routing and rendering split: `docs/ROUTES.md`
- public probe safety model: `docs/PROBE_SECURITY.md`
- initial PostgreSQL migration: `apps/origin/db/migrations/0001_initial.sql`

## Delivery Principles

- keep the MVP simple and explicit
- use TypeScript across frontend and backend
- public pages should read snapshots or aggregate tables, not raw probe rows
- sponsor placement must remain separate from natural ranking
- public probe work must follow `docs/PROBE_SECURITY.md`
- testing should follow `docs/TESTING_STRATEGY.md`
- default to Playwright-first acceptance coverage and keep non-E2E tests narrow
- prefer shipping thin vertical slices over building all infrastructure up front

## Phase 1: Repository And Workspace Foundation

Goal:
- create a clean monorepo foundation for `web`, `admin`, `origin`, and `shared`

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
  - `apps/origin`
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
- export reusable payload fragments such as relay summary, score summary, and incident summary
- add shared contract smoke tests for representative request and response payloads

Exit criteria:
- `packages/shared` exports both TypeScript types and runtime validation schemas
- `apps/web` and `apps/origin` consume the same shared contract package
- public API field names and validation rules are no longer implicit in implementation code
- representative contract payloads parse successfully through shared runtime schemas

## Phase 3: Origin API Foundation

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
- render the public site shell and connect it to real public APIs

Work items:
- scaffold `React Router v7 + TypeScript + Tailwind + shadcn/ui`
- wire Cloudflare Workers runtime target
- implement SSR or pre-render routing for:
  - `/`
  - `/leaderboard/:modelKey`
  - `/relay/:slug`
  - `/methodology`
- build first page slices
  - homepage using `/public/home-summary`
  - leaderboard using `/public/leaderboard/:modelKey`
  - relay overview shell using `/public/relay/:slug/overview`
- add Playwright smoke coverage for homepage, leaderboard, and relay overview

Exit criteria:
- public pages render with live API data
- SSR and hydration boundaries match `docs/ROUTES.md`
- critical public page flows pass browser-based smoke coverage

## Phase 5: Relay Detail Integration

Goal:
- complete the relay detail page against contract-shaped APIs, even before live monitoring
  producers become authoritative

Work items:
- implement origin endpoints
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
- add secret redaction and bounded logging rules
- add Cloudflare-side rate limiting and optional Turnstile gating
- build `/probe` UI against the dedicated public-safe endpoint
- add Playwright coverage for the main public probe page flows
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
- browser coverage validates the public probe UX for success and failure states
- probe security tests pass for the controls required by `docs/PROBE_SECURITY.md`

## Phase 8: Admin, Submit, And Sponsor Operations

Goal:
- provide the minimum operational tooling needed to run the site

Work items:
- implement admin routes for:
  - relay management
  - submission review
  - sponsor placement management
  - price record management
- implement submit flow for relay intake
- ensure sponsor placement is rendered separately from natural ranking
- treat `sponsors` as the public source of truth for paid placement windows
- add Playwright acceptance coverage for critical admin operations

Exit criteria:
- operators can review submissions and maintain catalog data
- sponsor workflow does not affect natural ranking logic
- critical admin flows pass browser-based acceptance coverage

## Phase 9: Deployment And Launch Hardening

Goal:
- prepare the project for stable staging and production deployment

Work items:
- deploy `apps/web` to Cloudflare Workers
- deploy `apps/origin` to the remote server
- configure `relaynews.ai`, `api.relaynews.ai`, and `admin.relaynews.ai`
- configure Cloudflare cache rules, WAF, and access control
- finalize environment variable management
- add deployment and operational runbooks
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
- origin service running
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
1. initialize the monorepo foundation
2. create `packages/shared`
3. encode `docs/API_CONTRACT_V1.md` into shared TypeScript types and `Zod` schemas
4. scaffold `apps/origin`
5. implement `GET /public/home-summary`
6. implement `GET /public/leaderboard/:modelKey`

## Notes

- if implementation reveals a new unresolved architecture or contract gap, record it in
  `docs/OPEN_DESIGN_ISSUES.md`
- if a breaking public contract change becomes necessary, update `docs/API_CONTRACT_V1.md`
  before implementing it
