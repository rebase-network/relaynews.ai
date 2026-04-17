import { z } from "zod";

import { healthStatusSchema, isoTimestampSchema } from "./common";
import {
  probeCompatibilityModeSchema,
  probeDetectionModeSchema,
  probeResolvedCompatibilityModeSchema,
} from "./probe";

const trimString = (value: unknown) => (typeof value === "string" ? value.trim() : value);
const emptyStringToUndefined = (value: unknown) => {
  const trimmed = trimString(value);
  return trimmed === "" ? undefined : trimmed;
};
const requiredHttpsUrlSchema = z.preprocess(trimString, z.url({ protocol: /^https$/ }));
const optionalUrlSchema = z.preprocess(emptyStringToUndefined, z.url().optional());
const optionalNonEmptyStringSchema = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const optionalEmailSchema = z.preprocess(emptyStringToUndefined, z.email().optional());
const requiredNonEmptyStringSchema = z.preprocess(trimString, z.string().min(1));
const internalIdSchema = z.string().min(1);

export const publicSubmissionRequestSchema = z.object({
  relayName: requiredNonEmptyStringSchema,
  baseUrl: requiredHttpsUrlSchema,
  websiteUrl: optionalUrlSchema,
  description: requiredNonEmptyStringSchema,
  submitterName: optionalNonEmptyStringSchema,
  submitterEmail: optionalEmailSchema,
  notes: optionalNonEmptyStringSchema,
  testApiKey: requiredNonEmptyStringSchema,
  testModel: requiredNonEmptyStringSchema,
  compatibilityMode: z.preprocess(trimString, probeCompatibilityModeSchema).default("auto"),
});

export const submissionProbeSummarySchema = z.object({
  ok: z.boolean(),
  healthStatus: healthStatusSchema,
  httpStatus: z.number().int().min(100).max(599).nullable(),
  message: z.string().nullable(),
  verifiedAt: isoTimestampSchema,
  compatibilityMode: probeResolvedCompatibilityModeSchema.nullable().optional(),
  detectionMode: probeDetectionModeSchema.optional(),
});

export const publicSubmissionResponseSchema = z.object({
  ok: z.literal(true),
  id: internalIdSchema,
  status: z.enum(["pending", "approved", "rejected", "archived"]),
  probe: submissionProbeSummarySchema.nullable().optional(),
});

export type PublicSubmissionRequest = z.infer<typeof publicSubmissionRequestSchema>;
export type SubmissionProbeSummary = z.infer<typeof submissionProbeSummarySchema>;
export type PublicSubmissionResponse = z.infer<typeof publicSubmissionResponseSchema>;
