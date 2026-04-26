# Database Schema

## Scope

This document defines the current PostgreSQL schema for the relay monitoring website.

The goal is to support:
- relay catalog and model coverage
- public leaderboard pages
- relay detail pages
- self-check probe flow
- background monitoring and score generation

## Schema Design Principles

- PostgreSQL is the source of truth
- raw probe data is append-only, with a 7-day retention target for monitoring rows
- public pages do not query raw tables directly
- public pages read snapshot or pre-aggregated tables
- only abnormal or sampled payload evidence should be stored in detail
- schema should remain friendly to a future TimescaleDB upgrade if needed

## State Taxonomy

Three state concepts exist in the schema and should stay distinct:

- `catalog status`: relay listing lifecycle, currently stored on `relays.status`
- `support status`: relay-model support lifecycle, currently stored on `relay_models.status`
- `health status`: measured runtime condition used for public rendering; currently
  materialized into snapshot and aggregate outputs such as `status_label`

Application types and API payloads should prefer explicit names such as
`catalogStatus`, `supportStatus`, and `healthStatus` even when the underlying table
column is still named `status`.

For MVP, the intended catalog lifecycle values are:
- `pending`
- `active`
- `paused`
- `retired`
- `archived`

In the current operator workflow, the main working set is narrower:
- `active` relays are monitored and may appear in the public directory and leaderboard
- `paused` relays remain editable but are excluded from monitoring and public pages
- `archived` relays move out of the primary relay list into history views

## Current Migration Notes

The current executable schema is built by these migrations, in order:

- `apps/api/db/migrations/0001_initial.sql`
- `apps/api/db/migrations/0002_probe_credentials.sql`
- `apps/api/db/migrations/0003_submission_description.sql`
- `apps/api/db/migrations/0004_submission_prices_and_contacts.sql`

Concrete choices in that migration:
- UUID primary keys use `gen_random_uuid()`, so the database enables `pgcrypto`
- mutable tables use `updated_at` triggers
- the original `submissions` table still carries legacy `submitter_name` and
  `submitter_email` columns for compatibility, even though current intake flows write
  `contact_info` instead
- `probe_region` is concrete in the schema and defaults to `global`
- current shared API contracts only expose the `global` region; additional regions
  should not be treated as public MVP surface until the contracts and snapshot jobs
  are expanded together
- aggregation tables use surrogate UUID primary keys plus unique indexes, because
  `model_id` can be nullable and cannot safely participate in a normal composite
  primary key
- snapshot tables are designed as current materialized rows; rebuild jobs should
  replace rows for a given key rather than append unlimited history
- basic `CHECK` constraints were added for common statuses, score ranges, ratios,
  and non-negative numeric fields
- `0004_submission_prices_and_contacts.sql` adds relay and submission contact info,
  plus a normalized `submission_model_prices` table for submission-scoped price rows
- `0002_probe_credentials.sql` enforces exactly one credential owner on each row via
  `CHECK (num_nonnulls(submission_id, relay_id) = 1)` and partial unique indexes for
  one active credential per submission or relay

## Core Entities

### relays
Stores the canonical relay record.

Suggested columns:
- `id` uuid primary key
- `slug` text unique not null
- `name` text not null
- `base_url` text not null
- `provider_name` text null
- `contact_info` text null
- `description` text null
- `website_url` text null
- `docs_url` text null
- `status` text not null default 'active'  # catalog status
- `is_featured` boolean not null default false
- `is_sponsored` boolean not null default false
- `region_label` text null
- `notes` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- unique index on `slug`
- index on `status`
- index on `is_featured`

Notes:
- `is_sponsored` is not the authoritative source of paid placement visibility
- public paid placement rendering should read from `sponsors`
- `status` should represent listing lifecycle only, not measured runtime health
- only rows with `status = 'active'` should enter scheduled monitoring, public
  directory reads, leaderboard snapshots, and public relay detail exposure

Planned follow-up metadata for compatibility-aware probes:
- `compatibility_mode` text null
- `compatibility_mode_source` text null  # auto_detected, manual_override, admin_set
- `compatibility_mode_confidence` numeric(5,2) null
- `compatibility_detected_at` timestamptz null
- `compatibility_used_url` text null

These fields are not present in `0001_initial.sql` yet. Add them in a follow-up
migration when relay protocol detection and admin overrides are implemented.

### models
Stores canonical model definitions shown in the site.

Suggested columns:
- `id` uuid primary key
- `key` text unique not null
- `vendor` text not null
- `name` text not null
- `family` text not null
- `input_price_unit` text null
- `output_price_unit` text null
- `is_active` boolean not null default true
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- unique index on `key`
- index on `vendor`
- index on `family`

### relay_models
Support matrix between relays and models.

Suggested columns:
- `id` uuid primary key
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid not null references `models(id)`
- `remote_model_name` text null
- `supports_stream` boolean not null default true
- `supports_tools` boolean not null default false
- `supports_vision` boolean not null default false
- `supports_reasoning` boolean not null default false
- `status` text not null default 'active'  # support status
- `monitoring_enabled` boolean not null default true
- `monitoring_priority` integer not null default 100
- `compatibility_mode_override` text null
- `last_compatibility_mode` text null
- `last_probe_ok` boolean null
- `last_health_status` text null
- `last_http_status` integer null
- `last_message` text null
- `last_detection_mode` text null
- `last_used_url` text null
- `consecutive_failure_count` integer not null default 0
- `last_verified_at` timestamptz null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- unique index on (`relay_id`, `model_id`)
- index on `model_id`
- index on `status`
- index on (`relay_id`, `monitoring_enabled`, `monitoring_priority`, `status`)

Notes:
- `relay_models` is both the support matrix and the model-level monitoring target set
- `monitoring_enabled` controls whether that relay-model pair enters the scheduled
  monitoring cycle
- `monitoring_priority` is used to cap per-relay probe fan-out when model count is
  high
- `compatibility_mode_override` allows a single relay-model pair to bypass relay-level
  defaults and force a protocol mode
- `last_*` fields capture the latest direct model-level probe result and should be
  treated as model-scoped evidence, not relay-wide truth

### relay_prices
Price history per relay-model pair.

Suggested columns:
- `id` uuid primary key
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid not null references `models(id)`
- `currency` text not null default 'USD'
- `input_price_per_1m` numeric(18,6) null
- `output_price_per_1m` numeric(18,6) null
- `cache_read_price_per_1m` numeric(18,6) null
- `cache_write_price_per_1m` numeric(18,6) null
- `effective_from` timestamptz not null
- `source` text not null default 'manual'
- `captured_at` timestamptz not null default now()

Indexes:
- index on (`relay_id`, `model_id`, `effective_from` desc)

Notes:
- at least one price field should be present on each row
- public APIs may expose unknown price fields as `null`
- the current public relay page does not render a standalone price-history chart;
  instead it consumes the latest rows from this table to enrich the supported-model
  table with the most recent known price per model

### submissions
Candidate relay submissions from users or operators.

Suggested columns:
- `id` uuid primary key
- `relay_name` text not null
- `base_url` text not null
- `website_url` text null
- `contact_info` text null
- `description` text null
- `notes` text null
- `status` text not null default 'pending'
- `review_notes` text null
- `approved_relay_id` uuid null references `relays(id)`
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- index on `status`
- index on `created_at desc`

Notes:
- `submissions` stays as the review queue and audit trail, not the long-term source of truth
- the current public submission UI writes `contact_info`; legacy `submitter_name`
  and `submitter_email` columns may still exist for backward compatibility but are
  no longer the primary intake fields
- once approved, the operational relay record lives in `relays`, and
  `approved_relay_id` links the review record back to that catalog entry
- `pending` rows are the active review queue, while `approved`, `rejected`, and
  `archived` rows are treated as history
- public submission intake persists the submitter-provided test credential into
  `probe_credentials` for immediate verification and later review follow-up
- submission-scoped model-price rows live in `submission_model_prices` instead of
  being flattened into the submission row itself

### submission_model_prices
Per-submission model and price rows collected during public intake.

Suggested columns:
- `id` uuid primary key
- `submission_id` uuid not null references `submissions(id)` on delete cascade
- `model_key` text not null
- `input_price_per_1m` numeric(18,6) null
- `output_price_per_1m` numeric(18,6) null
- `position` integer not null default 0
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- index on (`submission_id`, `position`, `created_at`)

Notes:
- each row must provide `model_key` plus at least one non-null price field
- `position` preserves the operator-facing order from the original submission form
- approved submissions should sync these rows into relay-owned price records during
  relay creation or relay update

### probe_credentials
Rotation-friendly monitoring credentials for either a pending submission or an approved relay.

Suggested columns:
- `id` uuid primary key
- `submission_id` uuid null references `submissions(id)` on delete cascade
- `relay_id` uuid null references `relays(id)` on delete cascade
- `api_key` text not null
- `test_model` text not null
- `compatibility_mode` text not null default 'auto'
- `status` text not null default 'active'
- `last_verified_at` timestamptz null
- `last_probe_ok` boolean null
- `last_health_status` text null
- `last_http_status` integer null
- `last_message` text null
- `last_detection_mode` text null
- `last_used_url` text null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- partial unique index on `submission_id` where `status = 'active'`
- partial unique index on `relay_id` where `status = 'active'`
- index on (`submission_id`, `created_at` desc)
- index on (`relay_id`, `created_at` desc)

Notes:
- exactly one owner should be present on each row: either `submission_id` or `relay_id`
- key rotation should create a new active row and mark the previous row as `rotated` or `revoked`
- initial submit-time probes should write their latest verification snapshot back to this table
- the public self-check route should not persist user-supplied probe keys by default
- when a submission is approved, the active monitoring credential should move from
  the submission owner to the approved relay owner, either by transferring the row
  or by rotating into a new `relay_id`-owned credential record
- relay-owned credentials are the long-term operational surface; after approval,
  operators may still rotate or replace them manually, but only `active` relays
  should use an active credential for scheduled monitoring
- `test_model` remains as a bootstrap and fallback value for initial verification, but
  scheduled monitoring should not assume it is the only long-term probe target
- relay-owned credentials define authentication and relay-level compatibility defaults;
  the actual scheduled monitoring target set comes from `relay_models`

### sponsors
Paid placement records kept separate from ranking logic.

Suggested columns:
- `id` uuid primary key
- `relay_id` uuid null references `relays(id)`
- `name` text not null
- `placement` text not null
- `start_at` timestamptz not null
- `end_at` timestamptz not null
- `status` text not null default 'active'
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- index on (`placement`, `status`)
- index on (`start_at`, `end_at`)

Notes:
- `sponsors` is the canonical source of truth for active paid placement windows
- public rendering must not infer paid placement from `relays.is_sponsored`
- the current homepage `highlights` lane is derived from sponsor rows where:
  - `status = 'active'`
  - the current measured time falls inside `[start_at, end_at]`
  - the linked relay is also `active`

## Monitoring Tables

### probe_results_raw
Append-only raw probe result table. Keep 7 days.

Suggested columns:
- `id` uuid primary key
- `probed_at` timestamptz not null
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `probe_kind` text not null
- `probe_region` text not null default 'global'
- `target_host` text not null
- `success` boolean not null
- `http_status` integer null
- `latency_ms` integer null
- `ttfb_ms` integer null
- `first_token_ms` integer null
- `dns_ms` integer null
- `tls_ms` integer null
- `request_tokens` integer null
- `response_tokens` integer null
- `error_code` text null
- `error_message` text null
- `protocol_consistency_score` integer null
- `response_model_name` text null
- `sample_key` text null
- `created_at` timestamptz not null default now()

Indexes:
- index on (`probed_at` desc)
- index on (`relay_id`, `probed_at` desc)
- index on (`relay_id`, `model_id`, `probed_at` desc)
- partial index on (`probed_at` desc) where `success = false`

Notes:
- platform-run probes should ideally record the resolved compatibility mode that was used
  for execution, either on this row or in a companion detection history table
- public self-check probe results should remain separate from platform monitoring rows
  unless secret-free, opt-in persistence is explicitly required
- current implementation already keeps `/public/probe/check` results out of this table;
  only relay-owned monitoring runs and related reprobes write here
- do not store full payloads for every successful request
- use `sample_key` only for abnormal or sampled cases
- if volume grows later, partition by day or convert to a Timescale hypertable
- automated cleanup for the 7-day retention target is not wired yet in the current API process

### relay_protocol_detections
Planned follow-up table for compatibility detection history.

This table is not in `0001_initial.sql` yet, but it is the recommended place to keep
explainable detection history without overloading `relays`.

Suggested columns:
- `id` uuid primary key
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `compatibility_mode` text not null
- `detection_mode` text not null  # auto or manual
- `confidence` numeric(5,2) null
- `used_url` text null
- `source` text not null  # public_probe, platform_probe, admin
- `result_status` text not null  # matched, failed, superseded
- `raw_result_json` jsonb null
- `detected_at` timestamptz not null default now()

Indexes:
- index on (`relay_id`, `detected_at` desc)
- index on (`compatibility_mode`, `detected_at` desc)

### relay_credibility_checks
Daily credibility evidence for relay-owned probes.

Suggested columns:
- `id` uuid primary key
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `probe_region` text not null default 'global'
- `compatibility_mode` text not null
- `requested_model` text not null
- `used_url` text null
- `response_reported_model` text null
- `response_reported_version` text null
- `self_reported_provider` text null
- `self_reported_model` text null
- `self_reported_version` text null
- `identity_confidence` text not null  # high, medium, low, unknown
- `identity_probe_ok` boolean not null default false
- `message` text null
- `measured_at` timestamptz not null
- `created_at` timestamptz not null default now()

Indexes:
- index on (`relay_id`, `measured_at` desc)
- index on (`model_id`, `measured_at` desc)

### probe_error_samples
Stores detailed evidence only for abnormal or sampled cases.

Suggested columns:
- `id` uuid primary key
- `probe_result_id` uuid not null references `probe_results_raw(id)`
- `sample_type` text not null
- `request_headers_json` jsonb null
- `response_headers_json` jsonb null
- `response_body_json` jsonb null
- `stream_excerpt_text` text null
- `analysis_json` jsonb null
- `created_at` timestamptz not null default now()

Indexes:
- unique index on `probe_result_id`
- index on `sample_type`

### incident_events
Stores normalized incident records used for relay incident timelines.

Suggested columns:
- `id` uuid primary key
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `probe_region` text not null default 'global'
- `severity` text not null
- `title` text not null
- `summary` text not null
- `started_at` timestamptz not null
- `ended_at` timestamptz null
- `detected_from_bucket` timestamptz null
- `resolved_from_bucket` timestamptz null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Indexes:
- index on (`relay_id`, `started_at` desc)
- index on (`probe_region`, `started_at` desc)

Notes:
- incident severity is negative-only in MVP: `degraded`, `down`, `paused`, `unknown`
- incident closure is represented by `ended_at`; there is no separate recovery event
  table in the first version

## Aggregation Tables

### relay_status_5m
5-minute health windows.

Suggested columns:
- `bucket_start` timestamptz not null
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `probe_region` text not null default 'global'
- `sample_count` integer not null
- `success_count` integer not null
- `failure_count` integer not null
- `availability_ratio` numeric(8,5) not null
- `error_rate_ratio` numeric(8,5) not null
- `last_success_at` timestamptz null
- `last_failure_at` timestamptz null
- `id` uuid primary key

Indexes:
- unique index on (`bucket_start`, `relay_id`, coalesced `model_id`, `probe_region`)
- index on (`relay_id`, `bucket_start` desc)
- index on (`model_id`, `bucket_start` desc)

### relay_latency_5m
5-minute latency windows.

Suggested columns:
- `bucket_start` timestamptz not null
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `probe_region` text not null default 'global'
- `sample_count` integer not null
- `latency_p50_ms` integer null
- `latency_p95_ms` integer null
- `latency_p99_ms` integer null
- `ttfb_p50_ms` integer null
- `ttfb_p95_ms` integer null
- `id` uuid primary key

Indexes:
- unique index on (`bucket_start`, `relay_id`, coalesced `model_id`, `probe_region`)
- index on (`relay_id`, `bucket_start` desc)
- index on (`model_id`, `bucket_start` desc)

### relay_score_hourly
Hourly score output used by leaderboard generation.

Suggested columns:
- `bucket_start` timestamptz not null
- `relay_id` uuid not null references `relays(id)`
- `model_id` uuid null references `models(id)`
- `probe_region` text not null default 'global'
- `availability_score` numeric(8,4) not null
- `latency_score` numeric(8,4) not null
- `consistency_score` numeric(8,4) not null
- `value_score` numeric(8,4) not null
- `stability_score` numeric(8,4) not null
- `total_score` numeric(8,4) not null
- `sample_count` integer not null
- `status_label` text not null
- `id` uuid primary key

Indexes:
- unique index on (`bucket_start`, `relay_id`, coalesced `model_id`, `probe_region`)
- index on (`model_id`, `bucket_start` desc, `total_score` desc)
- index on (`relay_id`, `bucket_start` desc)

## Snapshot Tables

These tables are the main read path for public pages.

### leaderboard_snapshots
Stores ready-to-serve leaderboard rows.

Suggested columns:
- `id` uuid primary key
- `snapshot_key` text not null
- `model_id` uuid null references `models(id)`
- `probe_region` text not null default 'global'
- `relay_id` uuid not null references `relays(id)`
- `rank` integer not null
- `total_score` numeric(8,4) not null
- `availability_24h` numeric(8,5) not null
- `latency_p50_ms` integer null
- `latency_p95_ms` integer null
- `input_price_per_1m` numeric(18,6) null
- `output_price_per_1m` numeric(18,6) null
- `sample_count_24h` integer not null
- `status_label` text not null
- `badges_json` jsonb not null default '[]'::jsonb
- `measured_at` timestamptz not null
- `created_at` timestamptz not null default now()

Indexes:
- index on (`snapshot_key`, `rank`)
- index on (`model_id`, `probe_region`, `measured_at` desc)
- unique index on (`snapshot_key`, `relay_id`)

Suggested `snapshot_key` examples:
- `leaderboard:openai-gpt-4.1:global`
- `leaderboard:claude-4-sonnet:global`

Notes:
- this snapshot table powers both model leaderboard pages and the
  `/public/leaderboard-directory` preview payload used by the directory page
- the current refresh job writes at most the top 20 rows per model snapshot

### relay_overview_snapshots
Stores one fast summary row per relay for the detail page.

Suggested columns:
- `relay_id` uuid primary key references `relays(id)`
- `status_label` text not null
- `availability_24h` numeric(8,5) not null
- `latency_p50_ms` integer null
- `latency_p95_ms` integer null
- `incidents_7d` integer not null default 0
- `supported_models_count` integer not null default 0
- `starting_input_price_per_1m` numeric(18,6) null
- `starting_output_price_per_1m` numeric(18,6) null
- `score_summary_json` jsonb not null default '{}'::jsonb
- `badges_json` jsonb not null default '[]'::jsonb
- `measured_at` timestamptz not null
- `updated_at` timestamptz not null default now()

Notes:
- `incidents_7d` is currently a count of incident rows whose `started_at` falls inside
  the last 7 days
- `starting_input_price_per_1m` and `starting_output_price_per_1m` are derived from the
  minimum currently known latest price rows for that relay
- the current relay page uses this table for hero / first-paint summary data, then
  loads history and model/pricing details separately

### home_summary_snapshots
Stores the homepage snapshot payload.

Suggested columns:
- `summary_key` text primary key
- `payload_json` jsonb not null
- `measured_at` timestamptz not null
- `updated_at` timestamptz not null default now()

Suggested keys:
- `home:full-page`

Notes:
- MVP should write one atomic homepage payload under `home:full-page`
- if modular homepage snapshots are introduced later, they should share a revision
  boundary before being exposed as one public page payload
- `latestIncidents` inside the homepage payload should use the incident summary shape
  defined in `docs/API_CONTRACT_V1.md`
- `latestIncidents` remains part of the homepage snapshot contract even when the
  current homepage UI does not render a dedicated incidents block
- current homepage payload building also caps:
  - leaderboard preview rows to 5 per model block
  - sponsor highlights to 4 distinct sponsored relays

## Retention And Jobs

Current runtime behavior:
- the API process runs one primary `node-cron` probe task every 15 minutes
- the API process runs one separate credibility task once per day
- each primary tick loads relay-owned credentials where both `probe_credentials.status = 'active'`
  and `relays.status = 'active'`, then expands them into relay-model monitoring targets
  using `relay_models`
- each relay-model target resolves its request model and compatibility mode using
  model-level overrides, last successful mode, and credential defaults
- each successful or failed relay-model run writes raw probe rows, updates
  `relay_models` latest result fields, refreshes the touched 5-minute / hourly
  aggregates, and then rebuilds public snapshots
- per-relay probe fan-out is budgeted by `relay_models.monitoring_priority`,
  `monitoring_enabled`, and scheduler-side model caps / failure backoff rules
- the separate credibility task only targets relays whose latest primary probe still
  indicates they are available enough to test
- admin write flows such as relay edits, submission review, sponsor changes, model
  changes, price changes, and `/admin/refresh-public` also rebuild public snapshots immediately

Current gaps / follow-up work:
- automated deletion of `probe_results_raw` older than the 7-day target is not yet scheduled
- automated cleanup of stale `probe_error_samples` is not yet scheduled

Execution assumption:
- the API scheduler is single-instance
- if the API service is later scaled horizontally, scheduling and rebuild jobs
  must use PostgreSQL-backed coordination such as advisory locks or job leases

## Public Read Models

- homepage
  - source: `home_summary_snapshots`
  - key: `home:full-page`
- leaderboard directory and per-model leaderboards
  - source: `leaderboard_snapshots`
  - read model: aggregate the top preview rows per tracked model from current global snapshots
- relay detail first paint
  - source: `relay_overview_snapshots` joined with `relays`
- relay history
  - source: `relay_status_5m` and `relay_latency_5m`
  - current implementation reads persisted 5-minute buckets for every supported window
    and applies a simple stride downsampling before returning the response:
    - `24h`: every 2nd point
    - `7d`: every 4th point
    - `30d`: every 8th point
- relay supported models
  - source: `relay_models` joined with `models`
  - read model: exclude rows whose relay-model support status is `unsupported`
- relay pricing history or latest-price enrichment
  - source: `relay_prices`
  - read model: return price change points ordered by `effective_from`, while excluding
    relay-model pairs currently marked `unsupported`
- relay incidents
  - source: `incident_events`

## Notes

- The authoritative public API contract lives in `docs/API_CONTRACT_V1.md`.
- The public probe threat model and required controls live in `docs/PROBE_SECURITY.md`.
- Internal and admin APIs can continue to evolve alongside implementation, but should
  stay consistent with the routing and responsibility split defined in `docs/ARCHITECTURE.md`.
- MVP public history reads use persisted 5-minute health and latency windows with
  response-time downsampling; the first version does not define separate persisted
  24-hour or 30-day history tables.
