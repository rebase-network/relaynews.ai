# Deployment

This document describes the current deployment shape for the MVP.

## Runtime Split

- `apps/origin` runs on the remote server through Docker Compose
- `apps/web` deploys to Cloudflare Workers Static Assets at `relaynews.ai`
- `apps/admin` deploys to Cloudflare Workers Static Assets at `admin.relaynews.ai`
- `api.relaynews.ai` continues to point at the remote origin through Cloudflare Proxy

## Required Tooling

### Local Workstation

- `pnpm`
- `Docker` for local validation and E2E
- `wrangler` for Cloudflare deploys
- SSH access to `rebase@rebase.network` for origin operations

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

### Frontend Builds

The frontend deploy flow expects these build-time variables:

- `PUBLIC_API_BASE_URL` default: `https://api.relaynews.ai`
- `PUBLIC_SITE_URL` default: `https://relaynews.ai`
- `ADMIN_SITE_URL` default: `https://admin.relaynews.ai`

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
- The origin service remains the only write-capable application runtime in the MVP.
