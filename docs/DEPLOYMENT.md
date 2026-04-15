# Deployment

This document describes the current deployment shape for the MVP.

## Runtime Split

- `apps/origin` runs on the remote server through Docker Compose
- `apps/web` deploys to Cloudflare Workers Static Assets at `relaynew.ai`
- `apps/admin` deploys to Cloudflare Workers Static Assets at `admin.relaynew.ai`
- the current public API base is `https://api.rebase.network/relaynews` through the existing Cloudflare Tunnel

## Required Tooling

### Local Workstation

- `pnpm`
- `Docker` for local validation and E2E
- `wrangler` for Cloudflare deploys
- SSH access to `rebase@rebase.network` for origin operations
- Cloudflare account target: `5abb6d6f38eb7d3dabf8a5adf095c5f7`

### Remote Origin Host

- Docker Engine
- Docker Compose
- PostgreSQL network access
- `curl`
- `rsync`

## Environment Inputs

### Origin

The origin service reads its runtime values from the remote file:

- `/home/rebase/apps/relaynews-origin/shared/origin.env`

Start from `ops/origin.env.example` and fill in the production database URL and any
other runtime values before the first deploy.

The current origin deployment joins the shared `rebase-production_default` Docker
network so Cloudflare Tunnel can reach it through the `relaynews-origin` network alias.
`DATABASE_URL` should therefore target the shared PostgreSQL service at `postgres:5432`
instead of a loopback host.

### Frontend Builds

The frontend deploy flow expects these build-time variables:

- `CF_ACCOUNT_ID` default: `5abb6d6f38eb7d3dabf8a5adf095c5f7`
- `PUBLIC_API_BASE_URL` default: `https://api.rebase.network/relaynews`
- `PUBLIC_SITE_URL` default: `https://relaynew.ai`
- `ADMIN_SITE_URL` default: `https://admin.relaynew.ai`

These values are injected into the Vite builds as:

- `VITE_API_BASE_URL`
- `VITE_PUBLIC_SITE_URL`
- `VITE_ADMIN_SITE_URL`

## Origin Deploy Flow

1. Bootstrap the remote host once:

   ```bash
   ./ops/manage.sh bootstrap
   ```

2. Upload the production env file:

   ```bash
   ./ops/manage.sh env-push /path/to/origin.env
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
- `relaynew.ai` and `admin.relaynew.ai` are intended to run behind Cloudflare proxy
- the shared `api.rebase.network` tunnel is available from the `Rebase Community` account
- the relay monitoring ingress rule is present:

  ```bash
  ./ops/manage-tunnel.sh apply
  ```

1. Authenticate Wrangler if the local machine has not been set up yet:

   ```bash
   pnpm exec wrangler login
   ```

2. Validate the Cloudflare deploy config without publishing:

   ```bash
   ./ops/manage-edge.sh preview web
   ./ops/manage-edge.sh preview admin
   ```

3. Deploy the public site and admin site:

   ```bash
   ./ops/manage-edge.sh deploy web
   ./ops/manage-edge.sh deploy admin
   ```

Or deploy both together:

```bash
./ops/manage-edge.sh deploy all
```

## Notes

- The frontend deploy path currently ships static Vite builds through Cloudflare
  Workers Static Assets with SPA fallback routing.
- Public and admin builds intentionally use explicit absolute URLs so cross-domain
  links stay correct after deployment.
- The branded API hostname is intentionally deferred because the frontend zone and the
  existing tunnel live in different Cloudflare accounts today.
- The origin service remains the only write-capable application runtime in the MVP.
