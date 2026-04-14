import test from "node:test";
import assert from "node:assert/strict";

import {
  homeSummaryResponseSchema,
  leaderboardQuerySchema,
  methodologyResponseSchema,
  publicProbeRequestSchema,
  relayHistoryQuerySchema,
} from "./index";

test("home summary example parses", () => {
  const parsed = homeSummaryResponseSchema.parse({
    hero: {
      totalRelays: 42,
      healthyRelays: 38,
      degradedRelays: 3,
      downRelays: 1,
      measuredAt: "2026-04-15T10:00:00.000Z",
    },
    leaderboards: [
      {
        modelKey: "openai-gpt-4.1",
        modelName: "GPT-4.1",
        measuredAt: "2026-04-15T10:00:00.000Z",
        rows: [
          {
            rank: 1,
            relay: {
              slug: "sample-relay",
              name: "Sample Relay",
            },
            score: 96.2,
            availability24h: 0.998,
            latencyP50Ms: 820,
            latencyP95Ms: 1540,
            healthStatus: "healthy",
            badges: ["low-latency"],
          },
        ],
      },
    ],
    highlights: [
      {
        slug: "sample-relay",
        name: "Sample Relay",
        healthStatus: "healthy",
        badge: "high-stability",
      },
    ],
    latestIncidents: [],
    measuredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(parsed.hero.totalRelays, 42);
});

test("query defaults are applied", () => {
  const leaderboardQuery = leaderboardQuerySchema.parse({});
  const relayHistoryQuery = relayHistoryQuerySchema.parse({ window: "7d" });

  assert.equal(leaderboardQuery.region, "global");
  assert.equal(leaderboardQuery.limit, 20);
  assert.equal(relayHistoryQuery.region, "global");
});

test("probe request requires https", () => {
  const success = publicProbeRequestSchema.safeParse({
    baseUrl: "https://relay.example.ai/v1",
    apiKey: "sk-live",
    model: "openai-gpt-4.1",
  });

  const failure = publicProbeRequestSchema.safeParse({
    baseUrl: "http://relay.example.ai/v1",
    apiKey: "sk-live",
    model: "openai-gpt-4.1",
  });

  assert.equal(success.success, true);
  assert.equal(failure.success, false);
});

test("methodology payload parses", () => {
  const parsed = methodologyResponseSchema.parse({
    weights: {
      availability: 35,
      latency: 20,
      consistency: 20,
      value: 15,
      stability: 10,
    },
    healthStatuses: ["healthy", "degraded", "down", "paused", "unknown"],
    badges: [
      "low-latency",
      "high-stability",
      "high-value",
      "sample-size-low",
      "under-observation",
    ],
    notes: [
      "Natural ranking and sponsor placement are separate.",
      "Sample size influences confidence and badge display.",
    ],
    measuredAt: "2026-04-15T10:00:00.000Z",
  });

  assert.equal(parsed.weights.availability, 35);
});
