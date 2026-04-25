import { z } from "zod";

import { healthStatusSchema, isoTimestampSchema } from "./common";

export const probeResolvedCompatibilityModeSchema = z.enum([
  "openai-responses",
  "openai-chat-completions",
  "anthropic-messages",
  "google-gemini-generate-content",
]);

export const probeCompatibilityModeSchema = z.enum([
  "auto",
  ...probeResolvedCompatibilityModeSchema.options,
]);

export const probeDetectionModeSchema = z.enum(["auto", "manual"]);
export const publicProbeScanModeSchema = z.enum(["standard", "deep"]);
export const probeCredibilityLevelSchema = z.enum(["high", "medium", "low", "unknown"]);

export const probeResolvedCompatibilityModes = probeResolvedCompatibilityModeSchema.options;
export const probeCompatibilityModes = probeCompatibilityModeSchema.options;

export const publicProbeAttemptTraceSchema = z.object({
  mode: probeResolvedCompatibilityModeSchema,
  label: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  matched: z.boolean(),
  message: z.string().min(1).nullable().optional(),
});

export const publicProbeMatchedModeSchema = z.object({
  mode: probeResolvedCompatibilityModeSchema,
  label: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  httpStatus: z.number().int().min(100).max(599),
  latencyMs: z.number().int().nonnegative(),
  ttfbMs: z.number().int().nonnegative().nullable().optional(),
  firstTokenMs: z.number().int().nonnegative().nullable().optional(),
  credibility: z.object({
    requestedModel: z.string().min(1),
    responseReportedModel: z.string().min(1).nullable(),
    responseReportedVersion: z.string().min(1).nullable(),
    selfReportedProvider: z.string().min(1).nullable(),
    selfReportedModel: z.string().min(1).nullable(),
    selfReportedVersion: z.string().min(1).nullable(),
    identityProbeOk: z.boolean(),
    identityConfidence: probeCredibilityLevelSchema,
    message: z.string().min(1).nullable(),
  }).nullable().optional(),
});

export const publicProbeRequestSchema = z.object({
  baseUrl: z.url({ protocol: /^https$/ }),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  compatibilityMode: probeCompatibilityModeSchema.default("auto"),
  scanMode: publicProbeScanModeSchema.default("standard"),
});

export const publicProbeResponseSchema = z.object({
  ok: z.boolean(),
  targetHost: z.string().min(1),
  model: z.string().min(1),
  connectivity: z.object({
    ok: z.boolean(),
    latencyMs: z.number().int().nonnegative().nullable(),
    ttfbMs: z.number().int().nonnegative().nullable().optional(),
    firstTokenMs: z.number().int().nonnegative().nullable().optional(),
  }),
  protocol: z.object({
    ok: z.boolean(),
    healthStatus: healthStatusSchema,
    httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  }),
  scanMode: publicProbeScanModeSchema.default("standard"),
  compatibilityMode: probeResolvedCompatibilityModeSchema.nullable().optional(),
  detectionMode: probeDetectionModeSchema.optional(),
  usedUrl: z.url({ protocol: /^https$/ }).nullable().optional(),
  matchedModes: z.array(publicProbeMatchedModeSchema).default([]),
  attemptedModes: z.array(probeResolvedCompatibilityModeSchema).default([]),
  attemptTrace: z.array(publicProbeAttemptTraceSchema).default([]),
  message: z.string().min(1).nullable().optional(),
  measuredAt: isoTimestampSchema,
});

export type PublicProbeAttemptTrace = z.infer<typeof publicProbeAttemptTraceSchema>;
export type PublicProbeMatchedMode = z.infer<typeof publicProbeMatchedModeSchema>;
export type ProbeResolvedCompatibilityMode = z.infer<typeof probeResolvedCompatibilityModeSchema>;
export type ProbeCompatibilityMode = z.infer<typeof probeCompatibilityModeSchema>;
export type ProbeDetectionMode = z.infer<typeof probeDetectionModeSchema>;
export type PublicProbeScanMode = z.infer<typeof publicProbeScanModeSchema>;
export type ProbeCredibilityLevel = z.infer<typeof probeCredibilityLevelSchema>;
export type PublicProbeRequest = z.infer<typeof publicProbeRequestSchema>;
export type PublicProbeResponse = z.infer<typeof publicProbeResponseSchema>;
