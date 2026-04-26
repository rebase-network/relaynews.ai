# API Contract V1

This document defines the initial public API contract for `relaynew.ai`.

## Scope

This version is intentionally narrow. It only locks the public endpoints needed to build:
- homepage
- leaderboard directory page
- leaderboard pages
- relay detail pages
- merged methodology / governance page
- public submission page

Internal and admin APIs are intentionally not frozen here. They can evolve during backend
implementation as long as they stay consistent with `docs/ARCHITECTURE.md`.
The public probe endpoint is documented separately in `docs/PROBE_SECURITY.md`
because it has a different threat model, accepts a write-style diagnostic request, and
uses a compatibility-detection contract that is separate from these read-only content
endpoints.

## Contract Rules

- JSON field names use `camelCase`
- all timestamps are ISO 8601 strings in UTC
- numeric ratios use decimal values between `0` and `1`
- scores use decimal values between `0` and `100`
- content endpoints in this file are read-only `GET` requests unless a section
  explicitly documents a public write endpoint
- cache only the read-only `GET` endpoints in this file

## Shared Enums

### Relay Status

```txt
healthy
degraded
down
paused
unknown
```

### Badge

```txt
low-latency
high-stability
high-value
sample-size-low
under-observation
```

### Region

```txt
global
```

The first version only guarantees `global`. Region-specific variants can be added later.

## State Naming

Public payloads should avoid the generic field name `status` when they refer to
runtime health. This contract uses:

- `healthStatus` for measured relay health shown on public pages

The broader system still contains:
- `catalogStatus` for relay listing lifecycle
- `supportStatus` for relay-model support lifecycle

## Common Shapes

### Relay Summary

```json
{
  "slug": "sample-relay",
  "name": "Sample Relay"
}
```

### Score Summary

```json
{
  "availability": 98.4,
  "latency": 92.1,
  "consistency": 96.0,
  "value": 88.3,
  "stability": 94.6,
  "total": 94.1
}
```

### Incident Summary

```json
{
  "id": "incident_01",
  "relay": {
    "slug": "sample-relay",
    "name": "Sample Relay"
  },
  "startedAt": "2026-04-15T08:10:00Z",
  "endedAt": null,
  "severity": "degraded",
  "title": "Elevated latency",
  "summary": "Latency exceeded the degradation threshold for multiple probe windows."
}
```

## Public Endpoints

### GET /public/home-summary

Returns homepage modules that are already aggregated and ready to render.

Response:
```json
{
  "hero": {
    "totalRelays": 42,
    "healthyRelays": 38,
    "degradedRelays": 3,
    "downRelays": 1,
    "measuredAt": "2026-04-15T10:00:00Z"
  },
  "leaderboards": [
    {
      "modelKey": "openai-gpt-4.1",
      "measuredAt": "2026-04-15T10:00:00Z",
      "rows": [
        {
          "rank": 1,
          "relay": {
            "slug": "sample-relay",
            "name": "Sample Relay"
          },
          "score": 96.2,
          "availability24h": 0.998,
          "latencyP50Ms": 820,
          "latencyP95Ms": 1540,
          "healthStatus": "healthy",
          "badges": ["low-latency"]
        }
      ]
    }
  ],
  "highlights": [
    {
      "slug": "sample-relay",
      "name": "Sample Relay",
      "healthStatus": "healthy",
      "badge": "high-stability"
    }
  ],
  "latestIncidents": [
    {
      "id": "incident_01",
      "relay": {
        "slug": "sample-relay",
        "name": "Sample Relay"
      },
      "startedAt": "2026-04-15T08:10:00Z",
      "endedAt": null,
      "severity": "degraded",
      "title": "Elevated latency",
      "summary": "Latency exceeded the degradation threshold for multiple probe windows."
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required fields:
- `hero`
- `leaderboards`
- `highlights`
- `latestIncidents`
- `measuredAt`

Notes:
- homepage modules should already be shaped for rendering
- public model labels should use `modelKey` directly; there is no separate
  display-name field in this contract
- `highlights` is the sponsor-highlight lane used by the homepage sponsor cards
- `latestIncidents` can be an empty array in the first version
- when non-empty, `latestIncidents[]` uses the `Incident Summary` shape

### GET /public/leaderboard-directory

Returns the directory payload used by `/leaderboard/directory`.

Response:
```json
{
  "boards": [
    {
      "modelKey": "openai-gpt-4.1",
      "measuredAt": "2026-04-15T10:00:00Z",
      "rows": [
        {
          "rank": 1,
          "relay": {
            "slug": "sample-relay",
            "name": "Sample Relay"
          },
          "score": 96.2,
          "availability24h": 0.998,
          "latencyP50Ms": 820,
          "latencyP95Ms": 1540,
          "healthStatus": "healthy",
          "badges": ["low-latency"]
        }
      ]
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Notes:
- each `boards[]` item reuses the same preview-row shape as homepage leaderboard previews
- boards without usable rows may be omitted
- the response may cap preview rows per board
- this endpoint is read-only and safe for CDN caching

### GET /public/leaderboard/:modelKey

Returns the latest leaderboard for one model.

Query params:
- `region` optional, default `global`
- `limit` optional, default `20`

Response:
```json
{
  "model": {
    "key": "openai-gpt-4.1",
    "vendor": "openai"
  },
  "region": "global",
  "measuredAt": "2026-04-15T10:00:00Z",
  "rows": [
    {
      "rank": 1,
      "relay": {
        "slug": "sample-relay",
        "name": "Sample Relay"
      },
      "score": 96.2,
      "availability24h": 0.998,
      "latencyP50Ms": 820,
      "latencyP95Ms": 1540,
      "inputPricePer1M": 0.8,
      "outputPricePer1M": 3.2,
      "sampleCount24h": 1440,
      "healthStatus": "healthy",
      "badges": ["low-latency", "high-stability"]
    }
  ]
}
```

Required row fields:
- `rank`
- `relay`
- `score`
- `availability24h`
- `latencyP50Ms`
- `latencyP95Ms`
- `inputPricePer1M`
- `outputPricePer1M`
- `sampleCount24h`
- `healthStatus`
- `badges`

Notes:
- this is the primary read contract for leaderboard pages
- rows should already be sorted by `rank`
- `inputPricePer1M` and `outputPricePer1M` may be `null` when price data is unknown
- the current snapshot builder materializes up to 20 ranked rows per model, so
  larger `limit` values do not currently yield more than those stored rows

### GET /public/relay/:slug/overview

Returns the summary block needed for relay detail first paint.

Response:
```json
{
  "relay": {
    "slug": "sample-relay",
    "name": "Sample Relay",
    "baseUrl": "https://relay.sample-provider.ai/v1",
    "websiteUrl": "https://sample-provider.ai"
  },
  "healthStatus": "healthy",
  "availability24h": 0.998,
  "latencyP50Ms": 820,
  "latencyP95Ms": 1540,
  "incidents7d": 1,
  "supportedModelsCount": 12,
  "startingInputPricePer1M": 0.8,
  "startingOutputPricePer1M": 3.2,
  "scoreSummary": {
    "availability": 98.4,
    "latency": 92.1,
    "consistency": 96.0,
    "value": 88.3,
    "stability": 94.6,
    "credibility": 75.0,
    "total": 94.1
  },
  "badges": ["low-latency"],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required fields:
- `relay`
- `healthStatus`
- `availability24h`
- `latencyP50Ms`
- `latencyP95Ms`
- `incidents7d`
- `supportedModelsCount`
- `scoreSummary`
- `badges`
- `measuredAt`

Notes:
- `startingInputPricePer1M` and `startingOutputPricePer1M` may be `null` when price
  data is unknown
- the current public relay detail page uses this endpoint primarily for relay identity
  and non-model aggregate metadata
- model-specific health, availability, and latency should be read from
  `GET /public/relay/:slug/model-health`

### GET /public/relay/:slug/model-health

Returns the model-by-model health board used by the public relay detail page.

Query params:
- `window` optional, currently only `7d`, default `7d`
- `region` optional, default `global`

Response:
```json
{
  "relay": {
    "slug": "sample-relay",
    "name": "Sample Relay"
  },
  "window": "7d",
  "rows": [
    {
      "modelKey": "gpt-5.4",
      "vendor": "gpt",
      "supportStatus": "active",
      "currentStatus": "healthy",
      "availability7d": 0.991,
      "latestLatencyP50Ms": 842,
      "statusTrend7d": [
        {
          "dateKey": "2026-04-09",
          "status": "healthy",
          "availability": 1.0
        },
        {
          "dateKey": "2026-04-10",
          "status": "healthy",
          "availability": 1.0
        }
      ],
      "currentPrice": {
        "currency": "USD",
        "inputPricePer1M": 2.5,
        "outputPricePer1M": 15
      },
      "lastVerifiedAt": "2026-04-15T10:00:00Z"
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required row fields:
- `modelKey`
- `vendor`
- `supportStatus`
- `currentStatus`
- `availability7d`
- `latestLatencyP50Ms`
- `statusTrend7d`
- `currentPrice`
- `lastVerifiedAt`

Notes:
- `statusTrend7d` always returns 7 day buckets in ascending date order
- `availability7d` may be `null` when no recent samples are available for that model
- `currentPrice` may be `null` when price data is unknown
- `latestLatencyP50Ms` may be `null` when no recent latency sample exists
- this is the primary read contract for the public relay detail page's model health list

### GET /public/relay/:slug/history

Returns chart buckets for one relay.

Query params:
- `window` required, one of `24h`, `7d`, `30d`
- `region` optional, default `global`
- `model` optional

Response:
```json
{
  "window": "24h",
  "region": "global",
  "modelKey": null,
  "points": [
    {
      "bucketStart": "2026-04-15T09:00:00Z",
      "availability": 1.0,
      "latencyP50Ms": 780,
      "latencyP95Ms": 1430
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required point fields:
- `bucketStart`
- `availability`
- `latencyP50Ms`
- `latencyP95Ms`

Notes:
- this endpoint returns chart-ready aggregate data only
- it must not expose raw probe rows
- long windows may be downsampled before the response is returned

### GET /public/relay/:slug/models

Returns the supported models list for one relay.

Response:
```json
{
  "relay": {
    "slug": "sample-relay",
    "name": "Sample Relay"
  },
  "rows": [
    {
      "modelKey": "openai-gpt-4.1",
      "vendor": "openai",
      "supportStatus": "active",
      "supportsStream": true,
      "supportsTools": false,
      "supportsVision": false,
      "supportsReasoning": false,
      "lastVerifiedAt": "2026-04-15T10:00:00Z"
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required row fields:
- `modelKey`
- `vendor`
- `supportStatus`
- `supportsStream`
- `supportsTools`
- `supportsVision`
- `supportsReasoning`
- `lastVerifiedAt`

Notes:
- the current implementation filters out rows where `supportStatus = unsupported`

### GET /public/relay/:slug/pricing-history

Returns price change points for one relay.

Query params:
- `model` optional

Response:
```json
{
  "relay": {
    "slug": "sample-relay",
    "name": "Sample Relay"
  },
  "rows": [
    {
      "modelKey": "openai-gpt-4.1",
      "currency": "USD",
      "inputPricePer1M": 0.8,
      "outputPricePer1M": 3.2,
      "effectiveFrom": "2026-04-01T00:00:00Z",
      "source": "manual"
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required row fields:
- `modelKey`
- `currency`
- `inputPricePer1M`
- `outputPricePer1M`
- `effectiveFrom`
- `source`

Notes:
- `inputPricePer1M` and `outputPricePer1M` may be `null` when a relay exposes only
  one side of the price schedule
- rows for relay-model pairs that are currently marked `unsupported` may be excluded

### GET /public/relay/:slug/incidents

Returns timeline-ready incident records for one relay.

Query params:
- `window` optional, one of `24h`, `7d`, `30d`, default `7d`

Response:
```json
{
  "relay": {
    "slug": "sample-relay",
    "name": "Sample Relay"
  },
  "rows": [
    {
      "id": "incident_01",
      "startedAt": "2026-04-15T08:10:00Z",
      "endedAt": "2026-04-15T08:42:00Z",
      "severity": "degraded",
      "title": "Elevated latency",
      "summary": "Latency exceeded the degradation threshold for multiple probe windows."
    }
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Required row fields:
- `id`
- `startedAt`
- `endedAt`
- `severity`
- `title`
- `summary`

Notes:
- `endedAt` is nullable and is `null` while an incident is still active
- incident severity is negative-only in MVP: `degraded`, `down`, `paused`, `unknown`

### GET /public/methodology

Returns the public explanation for ranking and scoring.

Response:
```json
{
  "weights": {
    "availability": 30,
    "latency": 20,
    "consistency": 15,
    "value": 15,
    "stability": 10,
    "credibility": 10
  },
  "healthStatuses": ["healthy", "degraded", "down", "paused", "unknown"],
  "badges": [
    "low-latency",
    "high-stability",
    "high-value",
    "sample-size-low",
    "under-observation"
  ],
  "notes": [
    "Natural ranking and sponsor placement are separate.",
    "Sample size influences confidence and badge display."
  ],
  "measuredAt": "2026-04-15T10:00:00Z"
}
```

Notes:
- the page copy on `/methodology` combines scoring explanation with sponsor
  separation, intake, and reconsideration guidance

### POST /public/submissions

Creates a pending public submission and runs the first bounded verification against
the submitted test key.

Request:
```json
{
  "relayName": "Sample Relay",
  "baseUrl": "https://relay.sample-provider.ai/v1",
  "websiteUrl": "https://sample-provider.ai",
  "contactInfo": "Telegram: @sample_ops",
  "description": "Low-latency OpenAI-compatible relay for general chat traffic.",
  "notes": "Please review GPT-5.4 first.",
  "modelPrices": [
    {
      "modelKey": "openai-gpt-5.4",
      "inputPricePer1M": 4.6,
      "outputPricePer1M": 13.2
    },
    {
      "modelKey": "openai-gpt-4.1",
      "inputPricePer1M": 2.0,
      "outputPricePer1M": 8.0
    }
  ],
  "testApiKey": "sk-...",
  "compatibilityMode": "auto"
}
```

Response:
```json
{
  "ok": true,
  "id": "submission_01",
  "status": "pending",
  "probe": {
    "ok": true,
    "healthStatus": "healthy",
    "httpStatus": 200,
    "message": null,
    "verifiedAt": "2026-04-15T10:00:00Z",
    "compatibilityMode": "openai-responses",
    "detectionMode": "auto"
  }
}
```

Notes:
- this is a public write endpoint and must not be CDN-cached
- `contactInfo`, `modelPrices`, and `testApiKey` are required
- `testModel` is optional; when omitted, the backend may derive it from the first
  submitted `modelPrices` row before running the initial bounded verification
- `modelPrices` must contain at least one row, and each row must include `modelKey`
  plus at least one non-null price field

## Versioning Guidance

This contract should stay stable enough for frontend implementation. If a breaking change is
needed, update this file first and then align route docs, shared types, and backend handlers.
