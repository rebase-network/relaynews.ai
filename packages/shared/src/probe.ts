import { z } from "zod";

import { healthStatusSchema, isoTimestampSchema } from "./common";

export const publicProbeRequestSchema = z.object({
  baseUrl: z.url({ protocol: /^https$/ }),
  apiKey: z.string().min(1),
  model: z.string().min(1),
});

export const publicProbeResponseSchema = z.object({
  ok: z.boolean(),
  targetHost: z.string().min(1),
  model: z.string().min(1),
  connectivity: z.object({
    ok: z.boolean(),
    latencyMs: z.number().int().nonnegative().nullable(),
  }),
  protocol: z.object({
    ok: z.boolean(),
    healthStatus: healthStatusSchema,
    httpStatus: z.number().int().min(100).max(599).nullable().optional(),
  }),
  message: z.string().min(1).nullable().optional(),
  measuredAt: isoTimestampSchema,
});

export type PublicProbeRequest = z.infer<typeof publicProbeRequestSchema>;
export type PublicProbeResponse = z.infer<typeof publicProbeResponseSchema>;
