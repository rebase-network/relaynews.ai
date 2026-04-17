# Internal API Notes

## Scope

This document records the current responsibility split between `public`, `admin`,
and adjacent write-style endpoints. It is not a frozen contract. It is a working
reference so the implementation does not drift silently.

## Current Boundary

### Public content APIs

- `GET /public/home-summary`
- `GET /public/leaderboard-directory`
- `GET /public/leaderboard/:modelKey`
- `GET /public/relay/:slug/overview`
- `GET /public/relay/:slug/history`
- `GET /public/relay/:slug/models`
- `GET /public/relay/:slug/pricing-history`
- `GET /public/relay/:slug/incidents`
- `GET /public/methodology`

Rules:

- these routes are owned by `apps/api/src/routes/public.ts`
- these routes are read-only and cacheable
- the API service sets:
  - `Cache-Control: public, max-age=15`
  - `Cloudflare-CDN-Cache-Control: public, max-age=60, stale-while-revalidate=300, stale-if-error=600`
- cache behavior applies only to `GET /public/*`

### Public write-style endpoints

- `POST /public/probe/check`
- `POST /public/submissions`

Rules:

- these routes are public-facing, but they are not cacheable content reads
- `POST /public/probe/check` is owned by `apps/api/src/routes/probe.ts`
- `POST /public/probe/check` remains isolated for SSRF-sensitive self-check logic
  and does not persist user-supplied probe keys by default
- `POST /public/submissions` is owned by `apps/api/src/routes/public.ts`
- `POST /public/submissions` belongs to the public boundary and is no longer owned
  by the admin route module
- `POST /public/submissions` persists the submitter-provided `testApiKey` and
  `testModel` into `probe_credentials` for the review workflow
- shared schemas for public submissions live in `packages/shared/src/submissions.ts`

### Admin APIs

- `/admin/overview`
- `/admin/relays`
- `/admin/submissions`
- `/admin/probe-credentials`
- `/admin/sponsors`
- `/admin/prices`
- `/admin/models`
- `/admin/refresh-public`

Rules:

- admin routes are owned by `apps/api/src/routes/admin.ts`
- admin routes are protected by admin authorization
- admin routes must not receive CDN cache headers

## Current Shared Schema Split

- `packages/shared/src/public.ts`
  - public read contracts
- `packages/shared/src/submissions.ts`
  - public submission request / response contracts
- `packages/shared/src/admin.ts`
  - admin-only contracts
- `packages/shared/src/probe.ts`
  - probe compatibility and probe diagnostic contracts

## Current Internal Surface

- the current repo does not expose a standalone `/internal/*` HTTP route surface yet
- internal-only responsibilities currently live in background jobs, shared service
  modules, and admin-triggered workflows rather than a separate transport boundary

## Operational Reminder

- if a route is public only because it is user-facing, but its behavior is write-like
  or security-sensitive, do not automatically treat it as a cacheable public content API
- when adding new routes, decide the boundary first:
  - public content
  - public write-style
  - admin
  - future internal
