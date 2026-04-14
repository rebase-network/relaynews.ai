import type { Badge, MethodologyResponse } from "@relaynews/shared";

export const METHODOLOGY_WEIGHTS = {
  availability: 35,
  latency: 20,
  consistency: 20,
  value: 15,
  stability: 10,
} as const;

export const BADGE_ORDER: Badge[] = [
  "low-latency",
  "high-stability",
  "high-value",
  "sample-size-low",
  "under-observation",
];

export function getMethodologyPayload(measuredAt: string): MethodologyResponse {
  return {
    weights: { ...METHODOLOGY_WEIGHTS },
    healthStatuses: ["healthy", "degraded", "down", "paused", "unknown"],
    badges: [...BADGE_ORDER],
    notes: [
      "Natural ranking and sponsor placement are separate.",
      "Sample size influences confidence and badge display.",
    ],
    measuredAt,
  };
}
