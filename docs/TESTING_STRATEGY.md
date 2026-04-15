# Testing Strategy

This project should validate the MVP mainly by running the real product through the
browser. For now, the default testing strategy is Playwright-first end-to-end
acceptance, with only a few narrow exceptions where browser tests are not enough.

## Core Approach

- use `Playwright` as the primary test tool for public pages, admin pages, and the
  public probe flow
- prefer testing visible product behavior over duplicating the same checks across
  component, route, and API layers
- keep test data deterministic through seeds and fixtures so failures are easy to
  understand
- add non-E2E tests only for boundaries that are hard to validate safely through the
  browser alone

## Primary Coverage In Playwright

### Public Pages

The main browser suite should cover:
- homepage snapshot rendering
- leaderboard page loading, model switching, and empty/error states
- relay detail page rendering for overview, history, models, pricing history, and
  incidents
- methodology page rendering and basic navigation integrity

### Public Probe Flow

The browser suite should cover:
- valid probe submission against an allowed test target
- blocked or invalid target handling
- timeout, loading, and degraded response states
- user-facing redaction behavior so secrets are not echoed back into page content

### Admin Pages

The browser suite should cover the critical operational flows:
- relay catalog create and edit flows
- submission review actions
- sponsor placement management
- price record management

## Test Environments

### Local

Local development should use:
- local `web` app
- local `api` service
- local `PostgreSQL`
- deterministic seeded data for relays, models, incidents, prices, and snapshots

This environment is the main place for feature development and Playwright debugging.

### Staging

Staging should use the deployed stack and run at least the critical smoke and
acceptance suite before release.

The staging dataset should stay representative but controlled, so leaderboard and
probe assertions remain stable.

### Deployed Smoke

The repository also supports a deployed smoke mode for `relaynew.ai` and
`admin.relaynew.ai`:

- run `pnpm test:e2e:deployed` against the live frontends
- keep this suite read-mostly and skip write-path checks that would mutate deployed
  data
- source probe credentials from `.env` so the browser can exercise the real public
  probe flow without hardcoding secrets in the repo

## Data Strategy

- maintain a small seed dataset with representative relays, models, sponsor records,
  prices, incidents, and snapshot rows
- prefer seeded snapshot and aggregate rows over mocking API responses in the browser
- use a dedicated safe probe target for automated probe tests
- keep staging data isolated from production operational data

## Minimal Non-E2E Exceptions

These tests are still worth keeping even with a Playwright-first strategy:

### Database Migration Validation

- apply migrations against a clean PostgreSQL instance in CI or release validation
- fail fast if schema changes cannot be applied from scratch

### Probe Security Boundary Tests

Keep a small targeted suite for the controls defined in `docs/PROBE_SECURITY.md`,
including:
- URL normalization and validation
- DNS or IP blocking for disallowed ranges
- redirect re-validation
- timeout and bounded-response behavior
- secret redaction in logs and error handling

These checks are too security-sensitive to rely only on browser coverage.

### Shared Contract Smoke Tests

- validate representative public payloads with the shared `Zod` schemas
- verify that core request parsing rules do not drift between `web` and `api`

These tests help catch contract regressions earlier than full browser failures.

## CI And Release Usage

- pull requests should run migration validation, shared contract smoke tests, and a
  small critical Playwright smoke suite
- staging or pre-release validation should run the broader Playwright acceptance
  suite for public, probe, and admin flows
- preserve Playwright traces, screenshots, and videos on failure so regressions are
  diagnosable

## Current Repository Setup

- the browser acceptance suite lives in `e2e/`
- Playwright is configured from `playwright.config.ts`
- `pnpm test:e2e` starts an isolated PostgreSQL test container, seeds the API
  database, boots `api`, `web`, and `admin`, and then runs the browser suite
- `pnpm test:e2e:deployed` reuses the same Playwright specs against
  `https://relaynew.ai` and `https://admin.relaynew.ai`
- deployed runs intentionally skip relay creation, submission review, sponsor
  creation, and price creation so production data is not mutated during smoke tests

## Non-Goals For The MVP

- do not build a broad unit-test matrix by default
- do not duplicate the same scenario across too many test layers
- do not replace realistic seeded data with heavy mocking unless a case is otherwise
  impossible to test

If the system becomes more complex later, targeted lower-level tests can be added
where they clearly reduce risk.
