# Ops Guide

This directory contains the first deployment management tools for the remote origin
service.

## Default Remote Target

- SSH target: `rebase@rebase.network`
- Default app root: `/home/rebase/apps/relaynews-origin`
- Default Docker Compose project: `relaynews-origin`
- Default host port: `8787`

## Files

- `ops/manage.sh` - deployment and remote operations helper
- `ops/manage-edge.sh` - Cloudflare frontend build and deploy helper
- `ops/origin.env.example` - production environment template for origin
- `ops/docker-compose.origin.yml` - origin runtime definition for remote Docker deploys

## Typical Flow

1. Copy `ops/origin.env.example` to the remote server as the real environment file.
2. Run `./ops/manage.sh bootstrap` once to create directories and verify the remote
   Docker toolchain.
3. Run `./ops/manage.sh deploy` to sync the repo, build the origin image, apply
   migrations, and restart the container.
4. Use `./ops/manage.sh status`, `./ops/manage.sh logs`, and
   `./ops/manage.sh health` for ongoing operations.
5. Use `./ops/manage.sh releases` and `./ops/manage.sh rollback` when a release
   needs to be inspected or reverted.

## Notes

- `deploy` is focused on `apps/origin` only. It does not publish `web` or `admin`
  to Cloudflare.
- The remote host should already have Docker Engine, Docker Compose, PostgreSQL
  access, `curl`, and `rsync` available.
- `HOST=0.0.0.0` is required in the production env file so the container can accept
  traffic through the published port.
