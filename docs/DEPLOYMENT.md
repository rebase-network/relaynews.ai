# Deployment

This document describes the current deployment shape for the MVP.

## Runtime Split

- `apps/api` runs on the remote server through Docker Compose
- `apps/web` deploys to Cloudflare Workers Static Assets at `relaynew.ai`
- `apps/api-edge` deploys a Cloudflare Worker custom domain at `api.relaynew.ai`
- `apps/admin` deploys to Cloudflare Workers Static Assets at `admin.relaynew.ai`
- a dedicated Cloudflare Tunnel in the product account carries API traffic without sharing the legacy tunnel

## Required Tooling

### Local Workstation

- `pnpm`
- `Docker` for local validation and E2E
- `wrangler` for Cloudflare deploys
- SSH access to `rebase@rebase.network` for API operations
- Cloudflare account target: `5abb6d6f38eb7d3dabf8a5adf095c5f7`

### Remote API Host

- Docker Engine
- Docker Compose
- `curl`
- `rsync`

## Environment Inputs

### API Service

The backend API reads its runtime values from the remote file:

- `/home/rebase/apps/relaynews-api/shared/api.env`

Start from `ops/api.env.example` and fill in the production database URL,
PostgreSQL credentials, and tunnel token before the first deploy.

The remote Docker Compose stack now includes a dedicated `postgres` container and a
project-local Docker volume. That keeps this product isolated from any pre-existing
PostgreSQL service on the same machine while preserving data across restarts.

### Frontend Builds

The primary production frontend flow now bakes the product URLs directly into the
repository build scripts:

- `pnpm run build:web:prod` -> `relaynew.ai` + `api.relaynew.ai`
- `pnpm run build:admin:prod` -> `admin.relaynew.ai` + `relaynew.ai` + `api.relaynew.ai`

That means the normal GitHub -> Cloudflare Workers Builds path does not need
dashboard-level `VITE_*` production URL variables.

For local build or preview checks, plus manual `api-edge` deploys,
`./ops/manage-edge.sh` still accepts:

- `CF_ACCOUNT_ID` default: `5abb6d6f38eb7d3dabf8a5adf095c5f7`
- `PUBLIC_API_BASE_URL` default: `https://api.relaynew.ai`
- `PUBLIC_SITE_URL` default: `https://relaynew.ai`
- `ADMIN_SITE_URL` default: `https://admin.relaynew.ai`

The helper exports those values into `VITE_API_BASE_URL`,
`VITE_PUBLIC_SITE_URL`, and `VITE_ADMIN_SITE_URL` only for the local build,
preview, and `api-edge` deploy path.

## API Service Deploy Flow

1. Bootstrap the remote host once:

   ```bash
   ./ops/manage.sh bootstrap
   ```

2. Upload the production env file:

   ```bash
   ./ops/manage.sh env-push /path/to/api.env
   ```

3. Deploy the latest release:

   ```bash
   ./ops/manage.sh deploy
   ```

4. Inspect the running service if needed:

   ```bash
   ./ops/manage.sh status
   ./ops/manage.sh health
   ./ops/manage.sh logs 200
   ```

5. Inspect or revert stored releases if needed:

   ```bash
   ./ops/manage.sh releases
   ./ops/manage.sh rollback
   ./ops/manage.sh rollback 20260415094500
   ```

## Cloudflare Deploy Flow

Before the first production deploy, make sure:

- the `relaynew.ai` zone already exists in Cloudflare account `5abb6d6f38eb7d3dabf8a5adf095c5f7`
- `relaynew.ai`, `api.relaynew.ai`, and `admin.relaynew.ai` are intended to run behind Cloudflare proxy
- the dedicated product tunnel has been created in the same Cloudflare account
- the tunnel token has been stored in the remote API env file as `CLOUDFLARE_TUNNEL_TOKEN`
- the dedicated tunnel ingress rule is present:

  ```bash
  ./ops/manage-tunnel.sh apply
  ```

1. Authenticate Wrangler if the local machine has not been set up yet:

   ```bash
   pnpm exec wrangler login
   ```

2. Connect `relaynews-web` and `relaynews-admin` to GitHub through Workers Builds.
   Use the exact dashboard values documented in `docs/CLOUDFLARE_WORKERS_BUILDS.md`.

3. Validate the Cloudflare deploy config without publishing when you want a manual
   preflight check:

   ```bash
   ./ops/manage-edge.sh preview web
   ./ops/manage-edge.sh preview admin
   ./ops/manage-edge.sh preview api
   ```

4. Deploy the API edge Worker manually:

   ```bash
   ./ops/manage-edge.sh deploy api
   ```

5. Deploy `relaynews-web` and `relaynews-admin` only by pushing committed changes
   to GitHub so Cloudflare Workers Builds runs automatically.

Do not run `./ops/manage-edge.sh deploy web`, `./ops/manage-edge.sh deploy admin`,
or `./ops/manage-edge.sh deploy all` in normal production flow.

## Cloudflare Worker Inventory

The intended Cloudflare Worker inventory for this project is:

- `relaynews-web` -> public site at `relaynew.ai`
- `relaynews-admin` -> admin site at `admin.relaynew.ai`
- `relaynews-api-edge` -> API edge proxy at `api.relaynew.ai`

Important distinction:

- `relaynews-api-edge` is only the Cloudflare Worker proxy layer
- the real backend API is `apps/api` on the remote server

### Legacy `relaynews-api` Worker

Earlier iterations used the Worker name `relaynews-api` for the API edge layer.
After the rename to `relaynews-api-edge`, Cloudflare kept the old Worker as a
separate resource instead of renaming it in place.

If `relaynews-api` is still visible in the dashboard:

1. open `relaynews-api-edge`
2. confirm `api.relaynew.ai` is attached under `Settings -> Domains & Routes`
3. confirm the active deployment is the new Worker
4. delete the legacy `relaynews-api` Worker

Safe cleanup rule:

- keep `relaynews-api-edge`
- remove `relaynews-api` once it no longer owns any custom domain or route

CLI cleanup example:

```bash
pnpm exec wrangler delete relaynews-api
```

## Cloudflare Git Auto-Deploy For `web` And `admin`

The public site and admin site can be connected directly to GitHub through Workers
Builds so pushes to the production branch deploy automatically.

For a shorter dashboard-oriented checklist, see
`docs/CLOUDFLARE_WORKERS_BUILDS.md`.

### Recommended Worker Mapping

- `relaynews-web` -> `apps/web/wrangler.jsonc` -> `relaynew.ai`
- `relaynews-admin` -> `apps/admin/wrangler.jsonc` -> `admin.relaynew.ai`

Cloudflare requires the Worker name in the dashboard to match the `name` in the
Wrangler configuration file found in the configured root directory.

### Root Directory

For each Worker, connect the same GitHub repository and set:

- `relaynews-web` root directory: repository root
- `relaynews-admin` root directory: repository root

### Build Commands

Set these commands in the Cloudflare dashboard under `Settings -> Builds`.

For `relaynews-web`:

- Build command:

```bash
pnpm install --frozen-lockfile && pnpm run build:web:prod
```

- Deploy command:

```bash
pnpm exec wrangler deploy --config apps/web/wrangler.jsonc
```

- Non-production branch deploy command:

```bash
pnpm exec wrangler versions upload --config apps/web/wrangler.jsonc
```

For `relaynews-admin`:

- Build command:

```bash
pnpm install --frozen-lockfile && pnpm run build:admin:prod
```

- Deploy command:

```bash
pnpm exec wrangler deploy --config apps/admin/wrangler.jsonc
```

- Non-production branch deploy command:

```bash
pnpm exec wrangler versions upload --config apps/admin/wrangler.jsonc
```

This setup removes the extra Cloudflare wrapper layer from `apps/web/package.json`
and `apps/admin/package.json`. Cloudflare builds now run directly from the
repository root against the target app config.

### Build Variables

Recommended build variables for both Workers:

```txt
SKIP_DEPENDENCY_INSTALL=1
NODE_VERSION=22.16.0
PNPM_VERSION=10.33.0
```

Notes:

- `SKIP_DEPENDENCY_INSTALL=1` keeps Workers Builds from doing a default dependency
  install inside the app subdirectory before our monorepo-aware build command runs
- production frontend URLs are provided by repository scripts instead of Cloudflare
  dashboard variables:
  - `pnpm run build:web:prod`
  - `pnpm run build:admin:prod`
- keep `VITE_API_BASE_URL`, `VITE_PUBLIC_SITE_URL`, and `VITE_ADMIN_SITE_URL`
  unset in the Cloudflare dashboard for the normal production path
- this reduces dashboard drift and avoids rebuilding the public or admin frontend
  against `127.0.0.1` by mistake
- Cloudflare can create and manage a build API token automatically, so a custom
  `CLOUDFLARE_API_TOKEN` is optional unless you want to manage it yourself

### Recommended Operating Model

- `relaynews-web` -> GitHub auto-deploy enabled
- `relaynews-admin` -> GitHub auto-deploy enabled
- `relaynews-api-edge` -> manual deploy through `./ops/manage-edge.sh deploy api`
- `apps/api` on the remote server -> manual deploy through `./ops/manage.sh deploy`

### Build Watch Paths

Recommended include paths for `relaynews-web`:

```txt
apps/web/*
packages/shared/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
```

Recommended include paths for `relaynews-admin`:

```txt
apps/admin/*
packages/shared/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
```

This keeps a change in `apps/web` from rebuilding `admin`, and vice versa, while
still rebuilding both apps when shared contracts or workspace metadata change.

### Recommended Branch Behavior

- production branch: deploy automatically with the app-specific `wrangler deploy`
  command shown above
- non-production branches: upload preview versions with the app-specific
  `wrangler versions upload` command shown above

This gives preview builds for feature branches without promoting them to the active
production deployment.

## Notes

- The frontend deploy path currently ships static Vite builds through Cloudflare
  Workers Static Assets with SPA fallback routing.
- The API hostname is implemented as a small Cloudflare Worker proxy so the site,
  custom domain, and tunnel stay in the same account without modifying the legacy tunnel.
- The API Worker reaches the backend service through a VPC network binding to the
  dedicated tunnel, so the tunnel itself does not need a public product hostname or shared DNS changes.
- Public and admin builds intentionally use explicit absolute URLs so cross-domain
  links stay correct after deployment.
- The API service remains the only write-capable application runtime in the MVP.
