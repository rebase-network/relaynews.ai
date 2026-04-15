# AGENTS

This repository is for `relaynew.ai`, a public relay monitoring and leaderboard site.

## Read First

Before making changes, review:
- `DESIGN.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE_SCHEMA.md`
- `docs/API_CONTRACT_V1.md`
- `docs/DEVELOPMENT_PLAN.md`
- `docs/TESTING_STRATEGY.md`
- `docs/PROBE_SECURITY.md`
- `docs/ROUTES.md`

Review `docs/OPEN_DESIGN_ISSUES.md` only when active unresolved design gaps exist.

## Current Stack

- frontend runtime: `Cloudflare Workers Static Assets`
- frontend app: `React Router v7 + TypeScript + Tailwind + shadcn/ui`
- backend: `Node.js + Fastify + TypeScript`
- database: `PostgreSQL`
- query layer: `Kysely`

## Current MVP Constraints

- do not add `Next.js`
- do not add `Cloudflare KV`
- do not add `Cloudflare R2`
- do not add `Redis`
- do not split into microservices yet
- keep public pages on snapshot or aggregate reads

## Product Rules

- sponsor placement must stay clearly separate from natural ranking
- probe and ranking methodology should remain explainable
- user-supplied probe keys should not be persisted by default
- public pages should favor SSR or pre-render when they benefit SEO
- admin and probe tooling can remain CSR
- testing should default to Playwright-first acceptance coverage

## Deployment Rules

- `relaynew.ai` and `admin.relaynew.ai` must deploy only through GitHub-triggered Cloudflare Workers Builds after code is committed and pushed
- do not run `./ops/manage-edge.sh deploy web`, `./ops/manage-edge.sh deploy admin`, or `./ops/manage-edge.sh deploy all`
- `api.relaynew.ai` is deployed manually with `./ops/manage-edge.sh deploy api`
- the remote backend API is deployed manually with `./ops/manage.sh deploy`

## Code Change Guidance

- prefer small, explicit changes
- update documentation when architectural decisions change
- keep naming neutral and product-specific to `relaynew.ai`
- avoid introducing new infrastructure without documenting why it is needed
- when adding APIs, separate `public`, `internal`, and `admin` responsibilities
- commit each completed functional slice or document change as an atomic change set
- commit messages must follow `Conventional Commits 1.0.0`
- prefer messages in the form `type(scope): description` when a scope adds clarity

## Near-Term Priorities

Use `docs/DEVELOPMENT_PLAN.md` as the source for phased execution order.
