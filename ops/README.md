# Ops Guide

This directory contains the first deployment management tools for the remote API
service.

## Default Remote Target

- SSH target: `rebase@rebase.host`
- Default app root: `/home/rebase/apps/relaynews-api`
- Default Docker Compose project: `relaynews-api`
- Default host port: `8787`

## Files

- `ops/manage.sh` - deployment and remote operations helper for the backend API stack
- `ops/manage-api-edge.sh` - API edge Worker build, preview, and deploy helper
- `ops/manage-tunnel.sh` - dedicated product tunnel configuration helper
- `ops/send-telegram.sh` - send a Telegram bot message using values from `.env`
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
5. Run `./ops/manage-api-edge.sh deploy` to publish the API edge Worker.
6. Let `relaynews-web` and `relaynews-admin` auto-deploy from GitHub-connected
   Workers Builds after committed changes are pushed to GitHub.
7. Use `./ops/manage.sh status`, `./ops/manage.sh logs`, and
   `./ops/manage.sh health` for ongoing operations.
8. Use `./ops/manage.sh releases` and `./ops/manage.sh rollback` when a release
   needs to be inspected or reverted.

## Admin Auth Checks

When `ADMIN_AUTH_USERNAME` and `ADMIN_AUTH_PASSWORD` are set in the remote API env
file, the backend will protect every `/admin/*` API route with Basic Auth.

Recommended verification after deploy:

1. Confirm the normal health endpoint still works:

   ```bash
   ./ops/manage.sh health
   ```

2. Confirm admin routes reject anonymous requests:

   ```bash
   curl -i https://api.relaynew.ai/admin/overview
   ```

   Expected result: `401 Unauthorized`

3. Confirm admin routes accept the configured credentials:

   ```bash
   curl -i -u 'admin:replace-with-a-strong-password' https://api.relaynew.ai/admin/overview
   ```

   Expected result: `200 OK`

4. Confirm `https://admin.relaynew.ai` shows the login screen before loading admin
   content.

## Notes

- `deploy` is focused on `apps/api` only. It does not publish `web`, `api-edge`,
  or `admin` to Cloudflare.
- `deploy` and `rollback` stamp the API image/container with the release id and
  force-recreate the running API service so `./ops/manage.sh status` can confirm
  which release is actually live
- `ops/manage-api-edge.sh` is only for `relaynews-api-edge`; do not use ops scripts
  to deploy `web` or `admin`
- The remote stack includes its own `postgres` container and named Docker volume,
  so it does not depend on or interfere with another PostgreSQL service on the same host.
- `HOST=0.0.0.0` is required in the production env file so the container can accept
  traffic through the published port.

## Telegram Bot Helper

The repository root `.env` may include:

```bash
TELEGRAM_BOT_TOKEN="123456:abc"
TELEGRAM_BOT_CHAT_ID="-1001234567890"
```

Examples:

```bash
./ops/send-telegram.sh "Relay 测试完成"
printf '%s\n' "后台审批已完成" | ./ops/send-telegram.sh
```
