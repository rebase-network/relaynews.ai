import { z } from "zod";

export const isoTimestampSchema = z.string().datetime({ offset: true });

export const healthStatusSchema = z.enum([
  "healthy",
  "degraded",
  "down",
  "paused",
  "unknown",
]);

export const catalogStatusSchema = z.enum([
  "pending",
  "active",
  "paused",
  "retired",
  "archived",
]);

export const supportStatusSchema = z.enum([
  "active",
  "degraded",
  "unsupported",
  "pending",
]);

export const incidentSeveritySchema = z.enum([
  "degraded",
  "down",
  "paused",
  "unknown",
]);

export const badgeSchema = z.enum([
  "low-latency",
  "high-stability",
  "high-value",
  "sample-size-low",
  "under-observation",
]);

export const regionSchema = z.enum(["global"]);

export const relayHistoryWindowSchema = z.enum(["24h", "7d", "30d"]);

export const incidentWindowSchema = z.enum(["24h", "7d", "30d"]);

export const relaySummarySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const scoreSummarySchema = z.object({
  availability: z.number().min(0).max(100),
  latency: z.number().min(0).max(100),
  consistency: z.number().min(0).max(100),
  value: z.number().min(0).max(100),
  stability: z.number().min(0).max(100),
  total: z.number().min(0).max(100),
});

export const incidentSummarySchema = z.object({
  id: z.string().min(1),
  relay: relaySummarySchema,
  startedAt: isoTimestampSchema,
  endedAt: isoTimestampSchema.nullable(),
  severity: incidentSeveritySchema,
  title: z.string().min(1),
  summary: z.string().min(1),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type CatalogStatus = z.infer<typeof catalogStatusSchema>;
export type SupportStatus = z.infer<typeof supportStatusSchema>;
export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;
export type Badge = z.infer<typeof badgeSchema>;
export type Region = z.infer<typeof regionSchema>;
export type RelayHistoryWindow = z.infer<typeof relayHistoryWindowSchema>;
export type IncidentWindow = z.infer<typeof incidentWindowSchema>;
export type RelaySummary = z.infer<typeof relaySummarySchema>;
export type ScoreSummary = z.infer<typeof scoreSummarySchema>;
export type IncidentSummary = z.infer<typeof incidentSummarySchema>;
