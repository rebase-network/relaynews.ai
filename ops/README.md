# Ops Guide

This directory contains the first deployment management tools for the remote API
service.

## Default Remote Target

- SSH target: `rebase@rebase.network`
- Default app root: `/home/rebase/apps/relaynews-api`
- Default Docker Compose project: `relaynews-api`
- Default host port: `8787`

## Files

- `ops/manage.sh` - deployment and remote operations helper for the backend API stack
- `ops/manage-edge.sh` - Cloudflare edge app build and deploy helper
- `ops/manage-tunnel.sh` - dedicated product tunnel configuration helper
- `ops/api.env.example` - production environment template for the backend API
- `ops/docker-compose.api.yml` - isolated runtime definition for the remote Docker deploy

## Typical Flow

1. Copy `ops/api.env.example` to the remote server as the real environment file.
2. Run `./ops/manage.sh bootstrap` once to create directories and verify the remote
   Docker toolchain.
3. Run `./ops/manage-tunnel.sh apply` once after creating the dedicated tunnel so
   Cloudflare knows how to forward API traffic.
4. Run `./ops/manage.sh deploy` to sync the repo, build the API image, apply
   migrations, and restart the API stack plus `cloudflared`.
5. Run `./ops/manage-edge.sh deploy api` to publish the API edge Worker.
6. Let `relaynews-web` and `relaynews-admin` auto-deploy from GitHub-connected
   Workers Builds. Use `./ops/manage-edge.sh deploy web` or
   `./ops/manage-edge.sh deploy admin` only for bootstrap or manual fallback.
7. Use `./ops/manage.sh status`, `./ops/manage.sh logs`, and
   `./ops/manage.sh health` for ongoing operations.
8. Use `./ops/manage.sh releases` and `./ops/manage.sh rollback` when a release
   needs to be inspected or reverted.

## Notes

- `deploy` is focused on `apps/api` only. It does not publish `web`, `api-edge`,
  or `admin` to Cloudflare.
- `ops/manage-edge.sh deploy all` still exists as a manual fallback, but the normal
  production path is GitHub auto-deploy for `web` and `admin` plus a manual
  `api-edge` publish.
- The remote stack includes its own `postgres` container and named Docker volume,
  so it does not depend on or interfere with another PostgreSQL service on the same host.
- `HOST=0.0.0.0` is required in the production env file so the container can accept
  traffic through the published port.
