# Cloudflare Workers Builds Checklist

Use this checklist when wiring `relaynews-web` and `relaynews-admin` to GitHub
through Cloudflare Workers Builds.

This document is intentionally operational and copy-paste friendly. The broader
deployment context still lives in `docs/DEPLOYMENT.md`.

## Expected Worker Inventory

Keep these Workers:

- `relaynews-web`
- `relaynews-admin`
- `relaynews-api-edge`

Do not confuse these two:

- `relaynews-api-edge` is the Cloudflare proxy Worker for `api.relaynew.ai`
- `apps/api` is the real backend service running on the remote server

If the old `relaynews-api` Worker still exists in the Cloudflare dashboard, treat
it as a legacy leftover and remove it only after confirming `api.relaynew.ai` is
attached to `relaynews-api-edge`.

## One-Time Dashboard Setup

Do this once for `relaynews-web`, then repeat for `relaynews-admin`.

### Step 1: Open The Worker

- go to `Workers & Pages`
- open `relaynews-web` or `relaynews-admin`
- open `Settings`
- open `Builds`

### Step 2: Connect The Repository

- click `Connect repository`
- choose `GitHub`
- select the `relaynews.ai` repository
- choose the production branch, usually `main`

### Step 3: Fill The Build Settings

#### `relaynews-web`

Use these values:

```txt
Root directory: repository root
Build command: pnpm install --frozen-lockfile && pnpm run build:web:prod
Deploy command: pnpm exec wrangler deploy --config apps/web/wrangler.jsonc
Non-production branch deploy command: pnpm exec wrangler versions upload --config apps/web/wrangler.jsonc
```

#### `relaynews-admin`

Use these values:

```txt
Root directory: repository root
Build command: pnpm install --frozen-lockfile && pnpm run build:admin:prod
Deploy command: pnpm exec wrangler deploy --config apps/admin/wrangler.jsonc
Non-production branch deploy command: pnpm exec wrangler versions upload --config apps/admin/wrangler.jsonc
```

This is the more aggressive monorepo setup:

- Cloudflare runs from the repository root
- the build command directly calls the root production build script
- the deploy command directly targets the app-specific Wrangler config
- no app-level Cloudflare wrapper scripts are needed

Do not add production `VITE_*` URL variables in the Cloudflare dashboard for these
two frontend Workers. The root repository scripts already bake the production host
mapping into the build output.

## Build Variables

Add these build variables to both Workers:

```txt
SKIP_DEPENDENCY_INSTALL=1
NODE_VERSION=22.16.0
PNPM_VERSION=10.33.0
```

Notes:

- `SKIP_DEPENDENCY_INSTALL=1` avoids a default install in the app subdirectory,
  which is not what this pnpm workspace needs
- if Cloudflare later changes the default Node or pnpm version, these variables
  keep the build image aligned with the repo
- production frontend URLs are now baked into the repository build scripts:
  - `pnpm run build:web:prod`
  - `pnpm run build:admin:prod`
- this keeps `relaynew.ai`, `admin.relaynew.ai`, and `api.relaynew.ai` out of the
  Cloudflare dashboard build variables for normal production deploys
- if you later want a staging frontend domain, add separate staging build scripts
  instead of editing the production ones in the dashboard

## Variables To Avoid

For the normal production path, leave these unset in the Cloudflare dashboard:

- `VITE_API_BASE_URL`
- `VITE_PUBLIC_SITE_URL`
- `VITE_ADMIN_SITE_URL`

If you later need a one-off staging or preview hostname override, change the build
command or add a dedicated staging script instead of mutating the production Worker.

## Build Watch Paths

Set watch paths so each Worker rebuilds only when relevant files change.

### `relaynews-web`

Recommended include paths:

```txt
apps/web/*
packages/shared/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
```

### `relaynews-admin`

Recommended include paths:

```txt
apps/admin/*
packages/shared/*
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.base.json
```

## Post-Setup Verification

After saving the configuration:

1. trigger a manual build from the Cloudflare dashboard
2. confirm the build succeeds
3. confirm the Worker still owns the expected custom domain
4. push a tiny commit to a non-production branch and verify preview behavior
5. push or merge to `main` and verify production auto-deploy behavior

## Current Script Mapping

These are the scripts Cloudflare will call.

### Root `package.json`

```txt
build:web:prod
build:admin:prod
```

## Recommended Operating Model

- `relaynews-web` -> GitHub auto-deploy enabled, manual fallback `./ops/manage-edge.sh deploy web`
- `relaynews-admin` -> GitHub auto-deploy enabled, manual fallback `./ops/manage-edge.sh deploy admin`
- `relaynews-api-edge` -> manual deploy `./ops/manage-edge.sh deploy api`
- `apps/api` on the remote server -> manual deploy through `./ops/manage.sh deploy`

This keeps the public and admin frontends fast to ship while preserving tighter
control over the API path.
