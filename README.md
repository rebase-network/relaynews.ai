# relaynews.ai

`relaynews.ai` is a public website for API relay monitoring, latency tracking, service
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
- Frontend runtime: `Cloudflare Workers`
- Backend: `Node.js + Fastify + TypeScript`
- Origin deployment runtime: `Docker Compose` on the remote server
- Database: `PostgreSQL`
- Query layer: `Kysely`
- Validation: `Zod`
- Scheduling: `node-cron`
- Cache strategy: `Cloudflare CDN cache` for public read APIs

## Domains

- Public site: `relaynews.ai`
- Public API: `api.relaynews.ai`
- Admin site: `admin.relaynews.ai`

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
  DEVELOPMENT_PLAN.md
  TESTING_STRATEGY.md
  PROBE_SECURITY.md
  ROUTES.md
apps/
  admin/
  web/
  origin/
    db/
      migrations/
e2e/
ops/
  docker-compose.origin.yml
packages/
  shared/
scripts/
```

## Document Index

- Product visual direction: `DESIGN.md`
- System architecture: `docs/ARCHITECTURE.md`
- Database schema: `docs/DATABASE_SCHEMA.md`
- Public API contract: `docs/API_CONTRACT_V1.md`
- Development plan: `docs/DEVELOPMENT_PLAN.md`
- Testing strategy: `docs/TESTING_STRATEGY.md`
- Public probe safety model: `docs/PROBE_SECURITY.md`
- Route map and rendering strategy: `docs/ROUTES.md`
- Issue tracker for unresolved design gaps: `docs/OPEN_DESIGN_ISSUES.md`
- Agent collaboration guide: `AGENTS.md`
- Database migration notes: `apps/origin/db/README.md`
- Origin deployment ops guide: `ops/README.md`

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
- start the origin API: `pnpm dev:origin`
- run type checks: `pnpm typecheck`
- run Playwright acceptance tests: `pnpm test:e2e`
- inspect remote origin deployment paths: `./ops/manage.sh path`
- bootstrap the remote origin host: `./ops/manage.sh bootstrap`
- deploy the remote origin service: `./ops/manage.sh deploy`
