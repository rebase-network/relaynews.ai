# relaynew.ai

`relaynew.ai` is a public website for API relay monitoring, latency tracking, service
health, pricing comparison, and leaderboard discovery.

## Product Scope

The site currently provides:
- public leaderboards for relay and model combinations
- relay detail pages with health snapshots, latency/status history, supported models,
  and the latest known per-model pricing
- a self-check probe tool for user-supplied relay endpoints
- a merged methodology page that explains ranking, sponsor separation, intake rules,
  and review / reconsideration guidance
- submit and sponsor flows that stay separate from natural rankings

## Current Architecture

- Frontend: `React Router v7 + TypeScript + Tailwind + shadcn/ui`
- Frontend runtime: `Cloudflare Workers Static Assets`
- Frontend production deploys: GitHub-connected Cloudflare Workers Builds from the repository root
- API edge runtime: `Cloudflare Worker`
- Backend: `Node.js + Fastify + TypeScript`
- API deployment runtime: `Docker Compose` on the remote server
- Database: `PostgreSQL`
- Query layer: `Kysely`
- Validation: `Zod`
- Scheduling: `node-cron`
- Cache strategy: `Cloudflare CDN cache` for public read APIs

## Domains

- Public site: `relaynew.ai`
- Public API: `api.relaynew.ai`
- Admin site: `a.relaynew.ai`

## Repository Layout

```txt
DESIGN.md
README.md
AGENTS.md
package.json
pnpm-workspace.yaml
tsconfig.base.json
playwright.config.ts
.env.example
docs/
  ARCHITECTURE.md
  DATABASE_SCHEMA.md
  API_CONTRACT_V1.md
  CLOUDFLARE_WORKERS_BUILDS.md
  DEVELOPMENT_PLAN.md
  DEPLOYMENT.md
  TESTING_STRATEGY.md
  PROBE_SECURITY.md
  ROUTES.md
apps/
  admin/
  api-edge/
  web/
  api/
    db/
      migrations/
e2e/
ops/
  docker-compose.api.yml
packages/
  shared/
scripts/
```

## Document Index

### 产品

- Product visual direction: `DESIGN.md`
- Development plan: `docs/DEVELOPMENT_PLAN.md`
- Route map and rendering strategy: `docs/ROUTES.md`
- Localization rules: `docs/LOCALIZATION_ZH_CN.md`
- Issue tracker for unresolved design gaps: `docs/OPEN_DESIGN_ISSUES.md`

### 技术

- System architecture: `docs/ARCHITECTURE.md`
- Database schema: `docs/DATABASE_SCHEMA.md`
- Public API contract: `docs/API_CONTRACT_V1.md`
- Public probe safety model: `docs/PROBE_SECURITY.md`
- Testing strategy: `docs/TESTING_STRATEGY.md`
- Database migration notes: `apps/api/db/README.md`

### 运维

- Deployment guide: `docs/DEPLOYMENT.md`
- Technical operations manual: `docs/TECHNICAL_OPERATIONS.md`
- Admin operations manual: `docs/ADMIN_OPERATIONS.md`
- Cloudflare Workers Builds checklist: `docs/CLOUDFLARE_WORKERS_BUILDS.md`
- API deployment ops guide: `ops/README.md`

### 归档

- Archived historical audits and mockups: `docs/archive/`
- Agent collaboration guide: `AGENTS.md`

## Core Doc Responsibilities

Use this section when you are not sure which document should answer a question.

| Topic | Canonical document | What it owns |
|---|---|---|
| Visual tone and UI inspiration | `DESIGN.md` | Visual language, color / typography direction, and style references; not the shipped information architecture |
| Product roadmap and phase order | `docs/DEVELOPMENT_PLAN.md` | Current delivery baseline, phased priorities, and near-term execution order |
| System topology and runtime boundaries | `docs/ARCHITECTURE.md` | Runtime split, component responsibilities, cache model, security model, and data flow |
| Page / route map | `docs/ROUTES.md` | Public, tooling, and admin route inventory plus route-to-data-source mapping |
| Public API request / response shapes | `docs/API_CONTRACT_V1.md` | Public endpoint contracts, payload fields, and versioning rules |
| Database structure and read models | `docs/DATABASE_SCHEMA.md` | Table design, state taxonomy, retention, aggregation tables, and public read models |
| Public probe threat model | `docs/PROBE_SECURITY.md` | Public self-check security rules, network controls, secret handling, and bounded probe behavior |
| Test strategy | `docs/TESTING_STRATEGY.md` | Playwright-first coverage model, local / staging / deployed test usage, and narrow non-E2E exceptions |
| Deployment topology | `docs/DEPLOYMENT.md` | Production publish boundaries, runtime topology, and required environment inputs |
| Technical operations runbooks | `docs/TECHNICAL_OPERATIONS.md` | Step-by-step deploy, rollback, auth, backup / restore, data cleanup, and troubleshooting procedures |
| Admin daily operations | `docs/ADMIN_OPERATIONS.md` | Chinese operator-facing workflows, page responsibilities, and daily handling rules |
| Cloudflare frontend build settings | `docs/CLOUDFLARE_WORKERS_BUILDS.md` | Cloudflare Workers Builds dashboard values, watch paths, and post-setup checks |
| Localization conventions | `docs/LOCALIZATION_ZH_CN.md` | Simplified Chinese wording and localization constraints |
| Open design gaps | `docs/OPEN_DESIGN_ISSUES.md` | Unresolved design decisions that still need explicit closure |

## Quick Lookup

| If you want to know... | Read this first |
|---|---|
| how the system is split across browser, Cloudflare, API, and PostgreSQL | `docs/ARCHITECTURE.md` |
| which page calls which API or data source | `docs/ROUTES.md` |
| what a public API must return | `docs/API_CONTRACT_V1.md` |
| where homepage / leaderboard / relay detail data is stored | `docs/DATABASE_SCHEMA.md` |
| how the public probe must stay safe | `docs/PROBE_SECURITY.md` |
| how to publish or rollback production | `docs/TECHNICAL_OPERATIONS.md` |
| which production surface is published through which path | `docs/DEPLOYMENT.md` |
| how to configure Cloudflare Workers Builds for `web` and `admin` | `docs/CLOUDFLARE_WORKERS_BUILDS.md` |
| how operators use the admin console day to day | `docs/ADMIN_OPERATIONS.md` |
| what to test locally or in deployed smoke mode | `docs/TESTING_STRATEGY.md` |

## Working Agreements

- use TypeScript across frontend and backend
- do not introduce `Next.js`, `KV`, `R2`, or `Redis` into the MVP without discussion
- public pages read snapshots or aggregate tables, not raw probe tables
- sponsor placement and natural ranking must remain separate
- user-supplied API keys should not be persisted by default
- testing should be Playwright-first, with only narrow non-E2E exceptions

## Execution Order

Use `docs/DEVELOPMENT_PLAN.md` as the canonical phased build order.

## Local Commands

- install workspace dependencies: `pnpm install`
- bootstrap a local env file: `cp .env.example .env`
- start the public app: `pnpm dev:web`
- start the admin app: `pnpm dev:admin`
- start the backend API: `pnpm dev:api`
- build the public production bundle: `pnpm run build:web:prod`
- build the admin production bundle: `pnpm run build:admin:prod`
- run the package-level verification set: `pnpm test`
- run type checks: `pnpm typecheck`
- run Playwright acceptance tests: `pnpm test:e2e`
- run deployed smoke tests against `relaynew.ai`: `pnpm test:e2e:deployed`
- run deployed end-to-end coverage with write paths enabled: `pnpm test:e2e:deployed:writes`
- inspect remote API deployment paths: `./ops/manage.sh path`
- bootstrap the remote API host: `./ops/manage.sh bootstrap`
- deploy the remote API service: `./ops/manage.sh deploy`
- inspect or update the dedicated Cloudflare Tunnel rule: `./ops/manage-tunnel.sh status`
- preview the API edge Worker deploy locally: `./ops/manage-api-edge.sh preview`
- deploy the API edge Worker manually: `./ops/manage-api-edge.sh deploy`
- deploy `relaynew.ai` and `a.relaynew.ai` by pushing committed changes to GitHub
