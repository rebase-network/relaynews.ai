import { z } from "zod";

import {
  badgeSchema,
  healthStatusSchema,
  incidentSummarySchema,
  incidentWindowSchema,
  isoTimestampSchema,
  regionSchema,
  relayHistoryWindowSchema,
  relaySummarySchema,
  scoreSummarySchema,
  supportStatusSchema,
} from "./common";

const leaderboardPreviewRowSchema = z.object({
  rank: z.number().int().positive(),
  relay: relaySummarySchema,
  score: z.number().min(0).max(100),
  availability24h: z.number().min(0).max(1),
  latencyP50Ms: z.number().int().nonnegative().nullable(),
  latencyP95Ms: z.number().int().nonnegative().nullable(),
  healthStatus: healthStatusSchema,
  badges: z.array(badgeSchema),
});

const leaderboardPreviewSchema = z.object({
  modelKey: z.string().min(1),
  measuredAt: isoTimestampSchema,
  rows: z.array(leaderboardPreviewRowSchema),
});

export const homeSummaryResponseSchema = z.object({
  hero: z.object({
    totalRelays: z.number().int().min(0),
    healthyRelays: z.number().int().min(0),
    degradedRelays: z.number().int().min(0),
    downRelays: z.number().int().min(0),
    measuredAt: isoTimestampSchema,
  }),
  leaderboards: z.array(leaderboardPreviewSchema),
  highlights: z.array(
    z.object({
      slug: z.string().min(1),
      name: z.string().min(1),
      healthStatus: healthStatusSchema,
      badge: badgeSchema,
    }),
  ),
  latestIncidents: z.array(incidentSummarySchema),
  measuredAt: isoTimestampSchema,
});

export const leaderboardDirectoryResponseSchema = z.object({
  boards: z.array(leaderboardPreviewSchema),
  measuredAt: isoTimestampSchema,
});

export const leaderboardQuerySchema = z.object({
  region: regionSchema.default("global"),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const leaderboardResponseSchema = z.object({
  model: z.object({
    key: z.string().min(1),
    vendor: z.string().min(1),
  }),
  region: regionSchema,
  measuredAt: isoTimestampSchema,
  rows: z.array(
    z.object({
      rank: z.number().int().positive(),
      relay: relaySummarySchema,
      score: z.number().min(0).max(100),
      availability24h: z.number().min(0).max(1),
      latencyP50Ms: z.number().int().nonnegative().nullable(),
      latencyP95Ms: z.number().int().nonnegative().nullable(),
      inputPricePer1M: z.number().min(0).nullable(),
      outputPricePer1M: z.number().min(0).nullable(),
      sampleCount24h: z.number().int().min(0),
      healthStatus: healthStatusSchema,
      badges: z.array(badgeSchema),
    }),
  ),
});

export const relayOverviewResponseSchema = z.object({
  relay: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    baseUrl: z.string().url(),
    websiteUrl: z.string().url().nullable(),
    contactInfo: z.string().nullable(),
    description: z.string().nullable(),
  }),
  healthStatus: healthStatusSchema,
  availability24h: z.number().min(0).max(1),
  latencyP50Ms: z.number().int().nonnegative().nullable(),
  latencyP95Ms: z.number().int().nonnegative().nullable(),
  incidents7d: z.number().int().min(0),
  supportedModelsCount: z.number().int().min(0),
  startingInputPricePer1M: z.number().min(0).nullable(),
  startingOutputPricePer1M: z.number().min(0).nullable(),
  scoreSummary: scoreSummarySchema,
  badges: z.array(badgeSchema),
  measuredAt: isoTimestampSchema,
});

export const relayModelHealthQuerySchema = z.object({
  window: z.enum(["7d"]).default("7d"),
  region: regionSchema.default("global"),
});

export const relayModelHealthResponseSchema = z.object({
  relay: relaySummarySchema,
  window: z.enum(["7d"]),
  rows: z.array(
    z.object({
      modelKey: z.string().min(1),
      vendor: z.string().min(1),
      supportStatus: supportStatusSchema,
      currentStatus: healthStatusSchema,
      availability7d: z.number().min(0).max(1).nullable(),
      latestLatencyP50Ms: z.number().int().nonnegative().nullable(),
      statusTrend7d: z.array(
        z.object({
          dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          status: healthStatusSchema,
          availability: z.number().min(0).max(1).nullable(),
        }),
      ).length(7),
      currentPrice: z.object({
        currency: z.string().min(1),
        inputPricePer1M: z.number().min(0).nullable(),
        outputPricePer1M: z.number().min(0).nullable(),
      }).nullable(),
      lastVerifiedAt: isoTimestampSchema.nullable(),
    }),
  ),
  measuredAt: isoTimestampSchema,
});

export const relayHistoryQuerySchema = z.object({
  window: relayHistoryWindowSchema,
  region: regionSchema.default("global"),
  model: z.string().min(1).optional(),
});

export const relayHistoryResponseSchema = z.object({
  window: relayHistoryWindowSchema,
  region: regionSchema,
  modelKey: z.string().min(1).nullable(),
  points: z.array(
    z.object({
      bucketStart: isoTimestampSchema,
      availability: z.number().min(0).max(1),
      latencyP50Ms: z.number().int().nonnegative().nullable(),
      latencyP95Ms: z.number().int().nonnegative().nullable(),
    }),
  ),
  measuredAt: isoTimestampSchema,
});

export const relayModelsResponseSchema = z.object({
  relay: relaySummarySchema,
  rows: z.array(
    z.object({
      modelKey: z.string().min(1),
      vendor: z.string().min(1),
      supportStatus: supportStatusSchema,
      supportsStream: z.boolean(),
      supportsTools: z.boolean(),
      supportsVision: z.boolean(),
      supportsReasoning: z.boolean(),
      lastVerifiedAt: isoTimestampSchema.nullable(),
    }),
  ),
  measuredAt: isoTimestampSchema,
});

export const relayPricingHistoryQuerySchema = z.object({
  model: z.string().min(1).optional(),
});

export const relayPricingHistoryResponseSchema = z.object({
  relay: relaySummarySchema,
  rows: z.array(
    z.object({
      modelKey: z.string().min(1),
      currency: z.string().min(1),
      inputPricePer1M: z.number().min(0).nullable(),
      outputPricePer1M: z.number().min(0).nullable(),
      effectiveFrom: isoTimestampSchema,
      source: z.enum(["manual", "scraped", "detected", "api"]),
    }),
  ),
  measuredAt: isoTimestampSchema,
});

export const relayIncidentsQuerySchema = z.object({
  window: incidentWindowSchema.default("7d"),
});

export const relayIncidentsResponseSchema = z.object({
  relay: relaySummarySchema,
  rows: z.array(
    z.object({
      id: z.string().min(1),
      startedAt: isoTimestampSchema,
      endedAt: isoTimestampSchema.nullable(),
      severity: z.enum(["degraded", "down", "paused", "unknown"]),
      title: z.string().min(1),
      summary: z.string().min(1),
    }),
  ),
  measuredAt: isoTimestampSchema,
});

export const methodologyResponseSchema = z.object({
  weights: z.object({
    availability: z.number().min(0).max(100),
    latency: z.number().min(0).max(100),
    consistency: z.number().min(0).max(100),
    value: z.number().min(0).max(100),
    stability: z.number().min(0).max(100),
    credibility: z.number().min(0).max(100),
  }),
  healthStatuses: z.array(healthStatusSchema),
  badges: z.array(badgeSchema),
  notes: z.array(z.string().min(1)),
  measuredAt: isoTimestampSchema,
});

export type HomeSummaryResponse = z.infer<typeof homeSummaryResponseSchema>;
export type LeaderboardDirectoryResponse = z.infer<
  typeof leaderboardDirectoryResponseSchema
>;
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
export type RelayOverviewResponse = z.infer<typeof relayOverviewResponseSchema>;
export type RelayModelHealthQuery = z.infer<typeof relayModelHealthQuerySchema>;
export type RelayModelHealthResponse = z.infer<typeof relayModelHealthResponseSchema>;
export type RelayHistoryQuery = z.infer<typeof relayHistoryQuerySchema>;
export type RelayHistoryResponse = z.infer<typeof relayHistoryResponseSchema>;
export type RelayModelsResponse = z.infer<typeof relayModelsResponseSchema>;
export type RelayPricingHistoryQuery = z.infer<
  typeof relayPricingHistoryQuerySchema
>;
export type RelayPricingHistoryResponse = z.infer<
  typeof relayPricingHistoryResponseSchema
>;
export type RelayIncidentsQuery = z.infer<typeof relayIncidentsQuerySchema>;
export type RelayIncidentsResponse = z.infer<typeof relayIncidentsResponseSchema>;
export type MethodologyResponse = z.infer<typeof methodologyResponseSchema>;
