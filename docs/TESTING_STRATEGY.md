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
- relay detail page rendering for overview, 30-day history, supported-model pricing,
  and the intentional absence of standalone `价格历史` / `事故时间线` sections
- methodology page rendering and basic navigation integrity
- public submit flow success and validation states
- mobile navigation routing and critical responsive layout checks
- route-level metadata smoke for critical public pages

### Public Probe Flow

Current browser coverage focuses on:
- valid probe submission against an allowed test target
- automatic compatibility detection for a known relay target
- explicit compatibility override for a known relay target
- mobile layout and core explanatory copy for the public test page
- failure rendering that does not get mistaken for a successful probe

Follow-up coverage to add:
- blocked or invalid target handling
- timeout and degraded upstream response states
- user-facing redaction behavior so secrets are not echoed back into page content

### Admin Pages

The browser suite should cover the critical operational flows:
- relay catalog create, edit, pause, archive, and reactivate flows
- submission review actions
- sponsor placement management
- model delete and catalog maintenance
- direct price-record and credential maintenance compatibility surfaces

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
- run `pnpm test:e2e:deployed:writes` only for deliberate end-to-end verification
  when deployed data mutation is acceptable
- source probe credentials from `.env` so the browser can exercise the real public
  probe flow without hardcoding secrets in the repo
- when admin auth is enabled, provide `ADMIN_AUTH_USERNAME` and
  `ADMIN_AUTH_PASSWORD` in `.env` so the admin Playwright suite can sign in first

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
- current coverage: compatibility adapter matching and protocol-specific failure classification
- next coverage to add: URL normalization and validation
- next coverage to add: DNS or IP blocking for disallowed ranges
- next coverage to add: redirect re-validation
- next coverage to add: timeout and bounded-response behavior
- next coverage to add: secret redaction in logs and error handling

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
- public-route smoke coverage should include head metadata checks for critical pages,
  especially `title`, `meta[name=description]`, and `canonical`
- the public suite currently exercises homepage, leaderboard, relay detail, submit,
  probe, mobile navigation, route-level metadata checks, and the trimmed relay-detail
  layout that omits standalone incident / price-history panels
- `pnpm test` runs the package-level verification layer: API tests plus frontend and
  edge-worker typechecks
- `pnpm test:e2e` starts an isolated PostgreSQL test container, seeds the API
  database, boots `api`, `web`, and `admin`, and then runs the browser suite
- `pnpm test:e2e:deployed` reuses the same Playwright specs against
  `https://relaynew.ai` and `https://admin.relaynew.ai`
- `pnpm test:e2e:deployed:writes` enables deployed write-path coverage and should be
  used only when remote data mutation is acceptable
- deployed runs intentionally skip relay creation, submission review, sponsor
  creation, and price creation so production data is not mutated during smoke tests

## Non-Goals For The MVP

- do not build a broad unit-test matrix by default
- do not duplicate the same scenario across too many test layers
- do not replace realistic seeded data with heavy mocking unless a case is otherwise
  impossible to test

If the system becomes more complex later, targeted lower-level tests can be added
where they clearly reduce risk.
