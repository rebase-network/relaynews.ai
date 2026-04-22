# Deployment

This document defines the current deployment topology, publish boundaries, and
required environment inputs for `relaynew.ai`.

It intentionally does not repeat step-by-step runbooks. Use
`docs/TECHNICAL_OPERATIONS.md` for deployment execution, rollback, auth rollout,
backup / restore, data cleanup, and troubleshooting.

## Runtime Split

- `apps/api` runs on the remote server through Docker Compose
- `apps/web` deploys to Cloudflare Workers Static Assets at `relaynew.ai`
- `apps/api-edge` deploys a Cloudflare Worker custom domain at `api.relaynew.ai`
- `apps/admin` deploys to Cloudflare Workers Static Assets at `a.relaynew.ai`
- a dedicated Cloudflare Tunnel in the product account carries API traffic without
  sharing the legacy tunnel

## Required Tooling

### Local Workstation

- `pnpm`
- `Docker` for local validation and E2E
- `wrangler` for `api-edge` preview and deploy checks
- SSH access to `rebase@rebase.host` for API operations
- Cloudflare account target: `5abb6d6f38eb7d3dabf8a5adf095c5f7`

### Remote API Host

- Docker Engine
- Docker Compose
- `curl`
- `rsync`

## Environment Inputs

### API Service

The backend API reads its runtime values from:

- `/home/rebase/apps/relaynews-api/shared/api.env`

Start from `ops/api.env.example` and fill in the production database URL,
PostgreSQL credentials, tunnel token, and admin credentials before the first
deploy.

Recommended production behavior:

- set both `ADMIN_AUTH_USERNAME` and `ADMIN_AUTH_PASSWORD` to protect all
  `/admin/*` API routes
- leave both values blank only for local development or temporary debugging
- if you also want to hide the static admin assets themselves, add Cloudflare
  Access in front of `a.relaynew.ai`

The remote Docker Compose stack includes a dedicated `postgres` container and a
project-local Docker volume. That keeps this product isolated from any
pre-existing PostgreSQL service on the same machine while preserving data across
restarts.

### Frontend Builds

The production frontend flow bakes product URLs directly into the repository build
scripts:

- `pnpm run build:web:prod` -> `relaynew.ai` + `api.relaynew.ai`
- `pnpm run build:admin:prod` -> `a.relaynew.ai` + `relaynew.ai` +
  `api.relaynew.ai`

That means the required GitHub -> Cloudflare Workers Builds production path does
not need dashboard-level `VITE_*` production URL variables.

For local `api-edge` preview checks and manual deploys, `./ops/manage-api-edge.sh`
accepts:

- `CF_ACCOUNT_ID` default: `5abb6d6f38eb7d3dabf8a5adf095c5f7`

The helper is reserved for `relaynews-api-edge` only. Frontend production host
mapping stays in the repository build scripts and GitHub-connected Workers Builds.
Do not use local `wrangler deploy` or any ops wrapper to publish `relaynews-web`
or `relaynews-admin`.

## Publish Responsibility Matrix

| Surface | Runtime | Production publish path | Primary reference |
|---|---|---|---|
| `relaynew.ai` | Cloudflare Workers Static Assets | GitHub-triggered Workers Builds after committed changes are pushed | `docs/CLOUDFLARE_WORKERS_BUILDS.md` |
| `a.relaynew.ai` | Cloudflare Workers Static Assets | GitHub-triggered Workers Builds after committed changes are pushed | `docs/CLOUDFLARE_WORKERS_BUILDS.md` |
| `api.relaynew.ai` | Cloudflare Worker custom domain | `./ops/manage-api-edge.sh deploy` | `docs/TECHNICAL_OPERATIONS.md` |
| `apps/api` on remote host | Docker Compose | `./ops/manage.sh deploy` | `docs/TECHNICAL_OPERATIONS.md` |

Rules:

- do not use local `wrangler deploy` or ad hoc scripts for `relaynew.ai` or
  `a.relaynew.ai`
- frontend production releases happen only through committed-and-pushed GitHub
  changes watched by Workers Builds
- `relaynews-api-edge` remains the only Cloudflare Worker published manually in the
  normal production path
- the remote API remains the only write-capable application runtime in the MVP

## Related Runbooks

- deployment, rollback, auth rollout, backup / restore, data cleanup, and incident
  response: `docs/TECHNICAL_OPERATIONS.md`
- Cloudflare Workers Builds dashboard values, build variables, and watch paths:
  `docs/CLOUDFLARE_WORKERS_BUILDS.md`
- daily admin usage and operator workflow: `docs/ADMIN_OPERATIONS.md`
