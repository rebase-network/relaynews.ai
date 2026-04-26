import type { HealthStatus } from "@relaynews/shared";

export type RelayModelDailyAvailabilityRow = {
  dateKey: string;
  availability: number | null;
  sampleCount: number;
};

export type RelayModelStatusTrendPoint = {
  dateKey: string;
  status: HealthStatus;
  availability: number | null;
};

function toUtcDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )).toISOString().slice(0, 10);
}

export function computeHealthStatusFromAvailability(
  availability: number | null,
  sampleCount: number,
): HealthStatus {
  if (availability === null || sampleCount === 0) {
    return "unknown";
  }

  if (availability >= 0.98) {
    return "healthy";
  }

  if (availability > 0) {
    return "degraded";
  }

  return "down";
}

export function buildRelayModelStatusTrend7d(input: {
  measuredAt: string;
  rows: RelayModelDailyAvailabilityRow[];
}) {
  const anchorDateKey = toUtcDateKey(input.measuredAt) ?? toUtcDateKey(new Date())!;
  const anchor = new Date(`${anchorDateKey}T00:00:00.000Z`);
  const rowByDateKey = new Map(input.rows.map((row) => [row.dateKey, row]));

  return Array.from({ length: 7 }, (_, index): RelayModelStatusTrendPoint => {
    const date = new Date(anchor);
    date.setUTCDate(anchor.getUTCDate() - (6 - index));
    const dateKey = date.toISOString().slice(0, 10);
    const row = rowByDateKey.get(dateKey);
    const availability = row?.availability ?? null;
    const sampleCount = row?.sampleCount ?? 0;

    return {
      dateKey,
      status: computeHealthStatusFromAvailability(availability, sampleCount),
      availability,
    };
  });
}
