# relaynew.ai

`relaynew.ai` is a public website for API relay monitoring, latency tracking, service
health, pricing comparison, and leaderboard discovery.

## Product Scope

The site is planned to provide:
- public leaderboards for relay and model combinations
- relay detail pages with health, latency, and price history
- a self-check probe tool for user-supplied relay endpoints
- methodology pages that explain ranking and scoring
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
- Admin site: `admin.relaynew.ai`

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

- Product visual direction: `DESIGN.md`
- System architecture: `docs/ARCHITECTURE.md`
- Database schema: `docs/DATABASE_SCHEMA.md`
- Public API contract: `docs/API_CONTRACT_V1.md`
- Cloudflare Workers Builds checklist: `docs/CLOUDFLARE_WORKERS_BUILDS.md`
- Development plan: `docs/DEVELOPMENT_PLAN.md`
- Deployment guide: `docs/DEPLOYMENT.md`
- Testing strategy: `docs/TESTING_STRATEGY.md`
- Public probe safety model: `docs/PROBE_SECURITY.md`
- Route map and rendering strategy: `docs/ROUTES.md`
- Issue tracker for unresolved design gaps: `docs/OPEN_DESIGN_ISSUES.md`
- Agent collaboration guide: `AGENTS.md`
- Database migration notes: `apps/api/db/README.md`
- API deployment ops guide: `ops/README.md`

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
- run type checks: `pnpm typecheck`
- run Playwright acceptance tests: `pnpm test:e2e`
- run deployed smoke tests against `relaynew.ai`: `pnpm test:e2e:deployed`
- inspect remote API deployment paths: `./ops/manage.sh path`
- bootstrap the remote API host: `./ops/manage.sh bootstrap`
- deploy the remote API service: `./ops/manage.sh deploy`
- inspect or update the dedicated Cloudflare Tunnel rule: `./ops/manage-tunnel.sh status`
- preview Cloudflare edge deploys manually: `./ops/manage-edge.sh preview all`
- manually deploy Cloudflare apps as a fallback: `./ops/manage-edge.sh deploy all`
