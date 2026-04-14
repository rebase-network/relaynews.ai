import { z } from "zod";

import {
  catalogStatusSchema,
  isoTimestampSchema,
  relaySummarySchema,
  supportStatusSchema,
} from "./common";

const internalIdSchema = z.string().min(1);

export const publicSubmissionRequestSchema = z.object({
  relayName: z.string().min(1),
  baseUrl: z.url(),
  websiteUrl: z.url().optional(),
  submitterName: z.string().min(1).optional(),
  submitterEmail: z.email().optional(),
  notes: z.string().min(1).optional(),
});

export const publicSubmissionResponseSchema = z.object({
  ok: z.literal(true),
  id: internalIdSchema,
  status: z.enum(["pending", "approved", "rejected", "archived"]),
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
  baseUrl: z.url(),
  providerName: z.string().nullable(),
  websiteUrl: z.url().nullable(),
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
  baseUrl: z.url(),
  providerName: z.string().min(1).nullable().optional(),
  websiteUrl: z.url().nullable().optional(),
  catalogStatus: catalogStatusSchema.default("active"),
  isFeatured: z.boolean().default(false),
  isSponsored: z.boolean().default(false),
  description: z.string().nullable().optional(),
  docsUrl: z.url().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const adminSubmissionSchema = z.object({
  id: internalIdSchema,
  relayName: z.string().min(1),
  baseUrl: z.url(),
  websiteUrl: z.url().nullable(),
  submitterName: z.string().nullable(),
  submitterEmail: z.string().email().nullable(),
  notes: z.string().nullable(),
  status: z.enum(["pending", "approved", "rejected", "archived"]),
  reviewNotes: z.string().nullable(),
  createdAt: isoTimestampSchema,
});

export const adminSubmissionsResponseSchema = z.object({
  rows: z.array(adminSubmissionSchema),
});

export const adminSubmissionReviewSchema = z.object({
  status: z.enum(["approved", "rejected", "archived"]),
  reviewNotes: z.string().nullable().optional(),
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
export type AdminOverviewResponse = z.infer<typeof adminOverviewResponseSchema>;
export type AdminRelay = z.infer<typeof adminRelaySchema>;
export type AdminRelaysResponse = z.infer<typeof adminRelaysResponseSchema>;
export type AdminRelayUpsert = z.infer<typeof adminRelayUpsertSchema>;
export type AdminSubmission = z.infer<typeof adminSubmissionSchema>;
export type AdminSubmissionsResponse = z.infer<typeof adminSubmissionsResponseSchema>;
export type AdminSubmissionReview = z.infer<typeof adminSubmissionReviewSchema>;
export type AdminSponsor = z.infer<typeof adminSponsorSchema>;
export type AdminSponsorsResponse = z.infer<typeof adminSponsorsResponseSchema>;
export type AdminSponsorUpsert = z.infer<typeof adminSponsorUpsertSchema>;
export type AdminPriceRecord = z.infer<typeof adminPriceRecordSchema>;
export type AdminPricesResponse = z.infer<typeof adminPricesResponseSchema>;
export type AdminPriceCreate = z.infer<typeof adminPriceCreateSchema>;
