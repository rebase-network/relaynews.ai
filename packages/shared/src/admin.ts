import { z } from "zod";

import {
  catalogStatusSchema,
  healthStatusSchema,
  isoTimestampSchema,
  relaySummarySchema,
  supportStatusSchema,
} from "./common";
import {
  probeCompatibilityModeSchema,
  probeDetectionModeSchema,
  probeResolvedCompatibilityModeSchema,
} from "./probe";

const internalIdSchema = z.string().min(1);
const trimString = (value: unknown) => (typeof value === "string" ? value.trim() : value);
const emptyStringToUndefined = (value: unknown) => {
  const trimmed = trimString(value);
  return trimmed === "" ? undefined : trimmed;
};
const emptyStringToNull = (value: unknown) => {
  const trimmed = trimString(value);
  return trimmed === "" ? null : trimmed;
};
const requiredUrlSchema = z.preprocess(trimString, z.url());
const requiredHttpsUrlSchema = z.preprocess(trimString, z.url({ protocol: /^https$/ }));
const optionalUrlSchema = z.preprocess(emptyStringToUndefined, z.url().optional());
const nullableUrlSchema = z.preprocess(emptyStringToNull, z.url().nullable());
const optionalNonEmptyStringSchema = z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const optionalEmailSchema = z.preprocess(emptyStringToUndefined, z.email().optional());
const nullableNonEmptyStringSchema = z.preprocess(emptyStringToNull, z.string().min(1).nullable());
const requiredNonEmptyStringSchema = z.preprocess(trimString, z.string().min(1));

export const probeCredentialStatusSchema = z.enum(["active", "rotated", "revoked"]);
export const probeCredentialOwnerTypeSchema = z.enum(["submission", "relay"]);

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

export const adminOverviewResponseSchema = z.object({
  totals: z.object({
    relays: z.number().int().min(0),
    pendingSubmissions: z.number().int().min(0),
    activeSponsors: z.number().int().min(0),
    priceRecords: z.number().int().min(0),
  }),
  measuredAt: isoTimestampSchema,
});

export const adminRelaySchema = z.object({
  id: internalIdSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  baseUrl: requiredUrlSchema,
  providerName: z.string().nullable(),
  websiteUrl: nullableUrlSchema,
  catalogStatus: catalogStatusSchema,
  isFeatured: z.boolean(),
  isSponsored: z.boolean(),
  updatedAt: isoTimestampSchema,
});

export const adminRelaysResponseSchema = z.object({
  rows: z.array(adminRelaySchema),
});

export const adminRelayUpsertSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  baseUrl: requiredUrlSchema,
  providerName: nullableNonEmptyStringSchema.optional(),
  websiteUrl: nullableUrlSchema.optional(),
  catalogStatus: catalogStatusSchema.default("active"),
  isFeatured: z.boolean().default(false),
  isSponsored: z.boolean().default(false),
  description: nullableNonEmptyStringSchema.optional(),
  docsUrl: nullableUrlSchema.optional(),
  notes: nullableNonEmptyStringSchema.optional(),
});

export const adminSubmissionSchema = z.object({
  id: internalIdSchema,
  relayName: z.string().min(1),
  baseUrl: requiredUrlSchema,
  websiteUrl: nullableUrlSchema,
  description: z.string().nullable(),
  submitterName: z.string().nullable(),
  submitterEmail: z.string().email().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected", "archived"]),
  reviewNotes: z.string().nullable(),
  approvedRelay: relaySummarySchema.nullable(),
  probeCredential: z
    .object({
      id: internalIdSchema,
      status: probeCredentialStatusSchema,
      testModel: z.string().min(1),
      compatibilityMode: probeCompatibilityModeSchema,
      apiKeyPreview: z.string().min(1),
      lastVerifiedAt: isoTimestampSchema.nullable(),
      lastProbeOk: z.boolean().nullable(),
      lastHealthStatus: healthStatusSchema.nullable(),
      lastHttpStatus: z.number().int().min(100).max(599).nullable(),
      lastMessage: z.string().nullable(),
    })
    .nullable(),
  createdAt: isoTimestampSchema,
});

export const adminSubmissionsResponseSchema = z.object({
  rows: z.array(adminSubmissionSchema),
});

export const adminSubmissionReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "archived"]),
  reviewNotes: z.string().nullable().optional(),
});

export const adminProbeCredentialSchema = z.object({
  id: internalIdSchema,
  ownerType: probeCredentialOwnerTypeSchema,
  ownerId: internalIdSchema,
  ownerName: z.string().min(1),
  ownerSlug: z.string().min(1).nullable(),
  ownerBaseUrl: requiredUrlSchema,
  status: probeCredentialStatusSchema,
  testModel: z.string().min(1),
  compatibilityMode: probeCompatibilityModeSchema,
  apiKeyPreview: z.string().min(1),
  lastVerifiedAt: isoTimestampSchema.nullable(),
  lastProbeOk: z.boolean().nullable(),
  lastHealthStatus: healthStatusSchema.nullable(),
  lastHttpStatus: z.number().int().min(100).max(599).nullable(),
  lastMessage: z.string().nullable(),
  updatedAt: isoTimestampSchema,
});

export const adminProbeCredentialsResponseSchema = z.object({
  rows: z.array(adminProbeCredentialSchema),
});

export const adminProbeCredentialDetailSchema = adminProbeCredentialSchema.extend({
  apiKey: z.string().min(1),
  lastDetectionMode: probeDetectionModeSchema.nullable(),
  lastUsedUrl: nullableUrlSchema,
  createdAt: isoTimestampSchema,
});

export const adminProbeCredentialCreateSchema = z.object({
  ownerType: probeCredentialOwnerTypeSchema,
  ownerId: internalIdSchema,
  apiKey: requiredNonEmptyStringSchema,
  testModel: requiredNonEmptyStringSchema,
  compatibilityMode: z.preprocess(trimString, probeCompatibilityModeSchema).default("auto"),
});

export const adminProbeCredentialRotateSchema = z.object({
  apiKey: requiredNonEmptyStringSchema,
  testModel: requiredNonEmptyStringSchema,
  compatibilityMode: z.preprocess(trimString, probeCompatibilityModeSchema).default("auto"),
});

export const adminProbeCredentialMutationResponseSchema = z.object({
  ok: z.literal(true),
  id: internalIdSchema,
  probe: submissionProbeSummarySchema.nullable().optional(),
});

export const adminSponsorSchema = z.object({
  id: internalIdSchema,
  name: z.string().min(1),
  placement: z.string().min(1),
  status: z.enum(["draft", "active", "paused", "ended"]),
  startAt: isoTimestampSchema,
  endAt: isoTimestampSchema,
  relay: relaySummarySchema.nullable(),
});

export const adminSponsorsResponseSchema = z.object({
  rows: z.array(adminSponsorSchema),
});

export const adminSponsorUpsertSchema = z.object({
  relayId: internalIdSchema.nullable().optional(),
  name: z.string().min(1),
  placement: z.string().min(1),
  status: z.enum(["draft", "active", "paused", "ended"]).default("active"),
  startAt: isoTimestampSchema,
  endAt: isoTimestampSchema,
});

export const adminPriceRecordSchema = z.object({
  id: internalIdSchema,
  relay: relaySummarySchema,
  modelKey: z.string().min(1),
  modelName: z.string().min(1),
  currency: z.string().min(1),
  inputPricePer1M: z.number().min(0).nullable(),
  outputPricePer1M: z.number().min(0).nullable(),
  source: z.enum(["manual", "scraped", "detected", "api"]),
  effectiveFrom: isoTimestampSchema,
});

export const adminPricesResponseSchema = z.object({
  rows: z.array(adminPriceRecordSchema),
});

export const adminPriceCreateSchema = z
  .object({
    relayId: internalIdSchema,
    modelId: internalIdSchema,
    currency: z.string().min(1).default("USD"),
    inputPricePer1M: z.number().min(0).nullable().optional(),
    outputPricePer1M: z.number().min(0).nullable().optional(),
    effectiveFrom: isoTimestampSchema,
    source: z.enum(["manual", "scraped", "detected", "api"]).default("manual"),
  })
  .refine(
    (value) => value.inputPricePer1M !== null || value.outputPricePer1M !== null,
    {
      message: "At least one price field is required",
      path: ["inputPricePer1M"],
    },
  );

export const adminRelayModelSchema = z.object({
  relayId: internalIdSchema,
  modelId: internalIdSchema,
  supportStatus: supportStatusSchema,
});

export type PublicSubmissionRequest = z.infer<typeof publicSubmissionRequestSchema>;
export type PublicSubmissionResponse = z.infer<typeof publicSubmissionResponseSchema>;
export type SubmissionProbeSummary = z.infer<typeof submissionProbeSummarySchema>;
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;
export type AdminRelay = z.infer<typeof adminRelaySchema>;
export type AdminRelaysResponse = z.infer<typeof adminRelaysResponseSchema>;
export type AdminRelayUpsert = z.infer<typeof adminRelayUpsertSchema>;
export type AdminSubmission = z.infer<typeof adminSubmissionSchema>;
export type AdminSubmissionsResponse = z.infer<typeof adminSubmissionsResponseSchema>;
export type AdminSubmissionReview = z.infer<typeof adminSubmissionReviewSchema>;
export type ProbeCredentialStatus = z.infer<typeof probeCredentialStatusSchema>;
export type ProbeCredentialOwnerType = z.infer<typeof probeCredentialOwnerTypeSchema>;
export type AdminProbeCredential = z.infer<typeof adminProbeCredentialSchema>;
export type AdminProbeCredentialsResponse = z.infer<typeof adminProbeCredentialsResponseSchema>;
export type AdminProbeCredentialDetail = z.infer<typeof adminProbeCredentialDetailSchema>;
export type AdminProbeCredentialCreate = z.infer<typeof adminProbeCredentialCreateSchema>;
export type AdminProbeCredentialRotate = z.infer<typeof adminProbeCredentialRotateSchema>;
export type AdminProbeCredentialMutationResponse = z.infer<typeof adminProbeCredentialMutationResponseSchema>;
export type AdminSponsor = z.infer<typeof adminSponsorSchema>;
export type AdminSponsorsResponse = z.infer<typeof adminSponsorsResponseSchema>;
export type AdminSponsorUpsert = z.infer<typeof adminSponsorUpsertSchema>;
export type AdminPriceRecord = z.infer<typeof adminPriceRecordSchema>;
export type AdminPricesResponse = z.infer<typeof adminPricesResponseSchema>;
export type AdminPriceCreate = z.infer<typeof adminPriceCreateSchema>;
